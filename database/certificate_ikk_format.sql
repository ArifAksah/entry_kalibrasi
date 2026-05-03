-- ============================================================================
-- Certificate Number Format — sesuai IKK BMKG
-- ----------------------------------------------------------------------------
-- PRASYARAT: Migration `atomic_certificate_no_order.sql` sudah dijalankan.
--            (UNIQUE constraint + advisory lock infrastructure sudah ada)
--
-- Format nomor certificate (sesuai IKK):
--   Sert.{Place}-{Code}/{NoIdent}.{NoOrder}/DIK/{RomanMonth}/{Year}
--
-- Contoh:
--   Sert.FC-AWS/032.001/DIK/IV/2026
--   Sert.FC-TT/045.002/DIK/IV/2026
--   (LC nanti: Sert.LC-TT/123/DIK/VIII/2025 — tanpa NoOrder sub)
--
-- Komponen:
--   CertType   : 'sert' → "Sert", 's_ket' → "S.Ket"
--   Place      : 'FC' (Field Calibration) atau 'LC' (Lab Calibration)
--   Code       : kode alat dari master (AWS, TT, PP, ...)
--   NoIdent    : input manual (nomor urut alat yg dikalibrasi)
--   NoOrder    : atomic counter per (year, place), reset tiap tahun
--
-- Perubahan vs versi sebelumnya:
--   - Counter no_order sekarang PER-PLACE (FC & LC terpisah)
--   - Tambah kolom certificate_type, calibration_place, instrument_code
--   - Master kode alat memakai tabel `instrument_names` (kolom `code_alat`)
--     yang sudah dikelola admin di menu "Master Daftar Alat"
--   - Format string dinamis berdasarkan place
-- ============================================================================

-- -----------------------------------------------------------------------
-- STEP 1: Tambah kolom baru di certificate
-- -----------------------------------------------------------------------

ALTER TABLE certificate
  ADD COLUMN IF NOT EXISTS certificate_type  TEXT       DEFAULT 'sert',
  ADD COLUMN IF NOT EXISTS calibration_place VARCHAR(2) DEFAULT 'FC',
  ADD COLUMN IF NOT EXISTS instrument_code   TEXT;

-- CHECK constraints (idempoten)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificate_type_check') THEN
    ALTER TABLE certificate
      ADD CONSTRAINT certificate_type_check
      CHECK (certificate_type IN ('sert', 's_ket'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificate_place_check') THEN
    ALTER TABLE certificate
      ADD CONSTRAINT certificate_place_check
      CHECK (calibration_place IN ('FC', 'LC'));
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- STEP 2: Sumber master kode alat
-- -----------------------------------------------------------------------
-- CATATAN: Master kode alat TIDAK dibuat terpisah di migration ini.
-- Admin sudah mengelolanya via tabel `instrument_names` (kolom `code_alat`)
-- di halaman "Master Daftar Alat". Validasi kode di fungsi DB mengecek ke
-- tabel tersebut. Pastikan admin sudah mengisi `code_alat` sesuai IKK
-- (25 kode: TT, PP, RH, RR, VA, AWS, PWS, AWOS, TH, TR, Pev, PTRH, UU,
-- PTRV, VT, VTR, PT, FR, SR, SM, MC, FT, SEIS, GB, EP).

-- Index supaya lookup code_alat cepat di validasi function.
CREATE INDEX IF NOT EXISTS idx_instrument_names_code_alat
  ON instrument_names (code_alat)
 WHERE code_alat IS NOT NULL;

-- -----------------------------------------------------------------------
-- STEP 3: Backfill data lama — isi calibration_place & instrument_code
-- -----------------------------------------------------------------------
-- Data existing memiliki no_certificate seperti:
--   'SERT.FC.AWS/301/DIK/IV/2026'
--   'Sert.FC-AWOS / 032.001 / DIK / VII / 2025'
-- Coba ekstrak place & code dengan regex; fallback ke FC & NULL.

UPDATE certificate
   SET calibration_place =
         CASE
           WHEN no_certificate ~* '\.?FC[\.\- ]'   THEN 'FC'
           WHEN no_certificate ~* '\.?LC[\.\- ]'   THEN 'LC'
           ELSE 'FC'
         END,
       instrument_code =
         -- Tangkap kode setelah FC. atau FC- atau LC. atau LC-, sebelum / atau spasi
         SUBSTRING(no_certificate FROM '[FL]C[\.\- ]*([A-Za-z]+)')
 WHERE instrument_code IS NULL AND no_certificate IS NOT NULL;

-- -----------------------------------------------------------------------
-- STEP 4: Index pendukung counter per (year, place)
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_certificate_place_created
  ON certificate (calibration_place, created_at);

-- -----------------------------------------------------------------------
-- STEP 5: Drop function lama (signature berubah) dan buat ulang
-- -----------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_certificate_with_auto_number(JSONB);
DROP FUNCTION IF EXISTS public.preview_next_certificate_number();
DROP FUNCTION IF EXISTS public.preview_next_certificate_number(TEXT, TEXT, TEXT, TEXT);

-- Helper: format certificate_type label
CREATE OR REPLACE FUNCTION public._cert_type_label(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_type, 'sert'))
           WHEN 'sert'  THEN 'Sert'
           WHEN 's_ket' THEN 'S.Ket'
           ELSE 'Sert'
         END
$$;

-- Helper: format final no_certificate string
CREATE OR REPLACE FUNCTION public._format_certificate_no(
  p_cert_type TEXT,
  p_place     TEXT,
  p_code      TEXT,
  p_no_ident  TEXT,
  p_no_order  TEXT,
  p_month     INT,
  p_year      INT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  roman TEXT[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  type_label TEXT := public._cert_type_label(p_cert_type);
BEGIN
  IF UPPER(p_place) = 'FC' THEN
    -- Format FC: Sert.FC-CODE/NoIdent.NoOrder/DIK/Roman/Year
    RETURN type_label || '.FC-' || p_code
        || '/' || p_no_ident || '.' || p_no_order
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSIF UPPER(p_place) = 'LC' THEN
    -- Format LC (per IKK): Sert.LC-CODE/NoOrder/DIK/Roman/Year
    -- (Sesuaikan ketika teknisi konfirmasi format LC final)
    RETURN type_label || '.LC-' || p_code
        || '/' || p_no_order
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSE
    RAISE EXCEPTION 'Unsupported calibration_place: %', p_place;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- FUNCTION UTAMA: create_certificate_with_auto_number
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_certificate_with_auto_number(p_data JSONB)
RETURNS SETOF public.certificate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_year      INT         := EXTRACT(YEAR  FROM NOW())::INT;
  cur_month     INT         := EXTRACT(MONTH FROM NOW())::INT;
  year_start    TIMESTAMPTZ := make_timestamptz(cur_year,     1, 1, 0, 0, 0);
  year_end      TIMESTAMPTZ := make_timestamptz(cur_year + 1, 1, 1, 0, 0, 0);
  v_cert_type   TEXT        := COALESCE(NULLIF(p_data->>'certificate_type',''), 'sert');
  v_place       TEXT        := UPPER(COALESCE(NULLIF(p_data->>'calibration_place',''), 'FC'));
  v_code        TEXT        := NULLIF(p_data->>'instrument_code','');
  v_no_ident    TEXT        := NULLIF(p_data->>'no_identification','');
  v_next        INT;
  v_padded      TEXT;
  v_no_cert     TEXT;
  v_lock_key    BIGINT;
BEGIN
  -- Validasi input wajib
  IF v_place NOT IN ('FC', 'LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC atau LC, got: %', v_place;
  END IF;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'instrument_code wajib diisi';
  END IF;

  -- Validasi: kode alat harus terdaftar di master `instrument_names.code_alat`
  -- (dikelola admin di halaman "Master Daftar Alat").
  IF NOT EXISTS (
    SELECT 1 FROM instrument_names
     WHERE code_alat IS NOT NULL AND UPPER(code_alat) = UPPER(v_code)
     LIMIT 1
  ) THEN
    RAISE EXCEPTION 'instrument_code tidak terdaftar di master daftar alat: %', v_code;
  END IF;

  -- Untuk FC no_identification wajib (dipakai di format). Untuk LC opsional.
  IF v_place = 'FC' AND v_no_ident IS NULL THEN
    RAISE EXCEPTION 'no_identification wajib untuk calibration_place=FC';
  END IF;

  -- Advisory lock scoped per (year, place). FC & LC tidak saling blocking.
  v_lock_key := ('x' || substr(md5('cert_no_order_' || cur_year::TEXT || '_' || v_place), 1, 16))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung no_order berikutnya: counter PER (tahun, place)
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM public.certificate c
   WHERE c.created_at         >= year_start
     AND c.created_at         <  year_end
     AND c.calibration_place  = v_place;

  v_padded  := lpad(v_next::TEXT, 3, '0');
  v_no_cert := public._format_certificate_no(
                 v_cert_type, v_place, v_code, v_no_ident, v_padded, cur_month, cur_year);

  RETURN QUERY
  INSERT INTO public.certificate (
    no_certificate,
    no_order,
    no_identification,
    certificate_type,
    calibration_place,
    instrument_code,
    authorized_by,
    verifikator_1,
    verifikator_2,
    verifikator_3,
    assignor,
    issue_date,
    station,
    instrument,
    station_address,
    results,
    version,
    status,
    draft_created_at,
    sent_by,
    created_by
  ) VALUES (
    v_no_cert,
    v_padded,
    v_no_ident,
    v_cert_type,
    v_place,
    v_code,
    NULLIF(p_data->>'authorized_by', '')::UUID,
    NULLIF(p_data->>'verifikator_1',  '')::UUID,
    NULLIF(p_data->>'verifikator_2',  '')::UUID,
    NULLIF(p_data->>'verifikator_3',  '')::UUID,
    NULLIF(p_data->>'assignor',       '')::UUID,
    NULLIF(p_data->>'issue_date',     '')::DATE,
    NULLIF(p_data->>'station',        '')::INT,
    NULLIF(p_data->>'instrument',     '')::INT,
    NULLIF(p_data->>'station_address',''),
    COALESCE(p_data->'results', 'null'::jsonb),
    1,
    'draft',
    NOW(),
    NULLIF(p_data->>'sent_by',    '')::UUID,
    NULLIF(p_data->>'created_by', '')::UUID
  )
  RETURNING *;
END $$;

REVOKE ALL    ON FUNCTION public.create_certificate_with_auto_number(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO service_role;

-- -----------------------------------------------------------------------
-- FUNCTION PREVIEW: preview_next_certificate_number
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_next_certificate_number(
  p_cert_type TEXT DEFAULT 'sert',
  p_place     TEXT DEFAULT 'FC',
  p_code      TEXT DEFAULT NULL,
  p_no_ident  TEXT DEFAULT NULL
)
RETURNS TABLE (no_order TEXT, no_certificate TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_year    INT         := EXTRACT(YEAR  FROM NOW())::INT;
  cur_month   INT         := EXTRACT(MONTH FROM NOW())::INT;
  year_start  TIMESTAMPTZ := make_timestamptz(cur_year,     1, 1, 0, 0, 0);
  year_end    TIMESTAMPTZ := make_timestamptz(cur_year + 1, 1, 1, 0, 0, 0);
  v_place     TEXT        := UPPER(COALESCE(NULLIF(p_place,''), 'FC'));
  v_code      TEXT        := COALESCE(NULLIF(p_code,''), 'XXX');
  v_ident     TEXT        := COALESCE(NULLIF(p_no_ident,''), 'NNN');
  v_next      INT;
  v_padded    TEXT;
BEGIN
  IF v_place NOT IN ('FC', 'LC') THEN
    v_place := 'FC';
  END IF;

  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM public.certificate c
   WHERE c.created_at         >= year_start
     AND c.created_at         <  year_end
     AND c.calibration_place  = v_place;

  v_padded := lpad(v_next::TEXT, 3, '0');

  RETURN QUERY SELECT
    v_padded::TEXT,
    public._format_certificate_no(
      COALESCE(p_cert_type, 'sert'), v_place, v_code, v_ident, v_padded, cur_month, cur_year
    )::TEXT;
END $$;

REVOKE ALL    ON FUNCTION public.preview_next_certificate_number(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_next_certificate_number(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_certificate_number(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------
-- Verifikasi akhir
-- -----------------------------------------------------------------------
DO $$
DECLARE
  v_code_count      INT;
  v_backfilled_rows INT;
BEGIN
  SELECT COUNT(DISTINCT code_alat)
    INTO v_code_count
    FROM instrument_names
   WHERE code_alat IS NOT NULL AND TRIM(code_alat) <> '';

  SELECT COUNT(*)
    INTO v_backfilled_rows
    FROM certificate
   WHERE instrument_code IS NOT NULL;

  RAISE NOTICE 'Migration IKK format selesai.';
  RAISE NOTICE '  - % kode alat unik terdaftar di master (instrument_names.code_alat)', v_code_count;
  RAISE NOTICE '  - % baris certificate sudah punya instrument_code (hasil backfill)', v_backfilled_rows;

  IF v_code_count = 0 THEN
    RAISE WARNING 'Belum ada code_alat terisi di instrument_names. Minta admin isi via menu "Master Daftar Alat" sebelum create certificate baru.';
  END IF;
END $$;
