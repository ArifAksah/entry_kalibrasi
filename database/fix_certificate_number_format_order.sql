-- ============================================================================
-- FIX: Format & urutan nomor sertifikat (No. Order sebelum No. Identifikasi)
-- ----------------------------------------------------------------------------
-- MASALAH:
--   Migration `fix_certificate_function_instrument_code.sql` menulis ulang
--   `create_certificate_with_auto_number` dengan format string INLINE yang salah:
--     sert/FC/AWS/{no_ident}/{no_order}/DIK/{Roman}/{Year}
--   Akibatnya nomor jadi:  sert/FC/AWS/002/327/DIK/VI/2026
--     - separator pakai '/' semua, 'sert' huruf kecil
--     - no_identifikasi (002) tampil DULU, baru no_order (327)  -> TERBALIK
--
-- TARGET (sesuai IKK BMKG, No. Order dulu baru No. Identifikasi):
--     Sert.FC-{CODE}/{NoOrder}.{NoIdent}/DIK/{RomanMonth}/{Year}
--   Contoh:
--     Sert.FC-TT/123.001/DIK/VIII/2025
--     Sert.FC-AWS/327.002/DIK/VI/2026
--   (LC: Sert.LC-{CODE}/{NoOrder}/DIK/{RomanMonth}/{Year} — tanpa sub no_ident)
--
-- SOLUSI:
--   1. Perbaiki helper `_format_certificate_no` -> susunan No.Order DULU lalu
--      No.Identifikasi (sebelumnya ident.order).
--   2. Buat ulang `create_certificate_with_auto_number` agar MEMAKAI helper
--      `_format_certificate_no` (bukan format inline) supaya preview & create
--      selalu konsisten, sambil tetap memvalidasi kode alat ke tabel
--      `instrument_code` (sumber master yang aktif).
--
-- CATATAN:
--   - Idempoten (CREATE OR REPLACE). Aman dijalankan ulang.
--   - Sertifikat LAMA yang sudah terlanjur tersimpan dengan format salah TIDAK
--     ikut diubah otomatis (lihat blok backfill opsional di bagian bawah —
--     dikomentari secara default agar tidak mengubah nomor sertifikat terbit).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Helper format — No. Order DULU, baru No. Identifikasi
-- ----------------------------------------------------------------------------
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
    -- Format FC: Sert.FC-CODE/NoOrder.NoIdent/DIK/Roman/Year
    RETURN type_label || '.FC-' || p_code
        || '/' || p_no_order || '.' || p_no_ident
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSIF UPPER(p_place) = 'LC' THEN
    -- Format LC: Sert.LC-CODE/NoOrder/DIK/Roman/Year (tanpa sub no_ident)
    RETURN type_label || '.LC-' || p_code
        || '/' || p_no_order
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSE
    RAISE EXCEPTION 'Unsupported calibration_place: %', p_place;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Function utama — pakai helper, validasi ke tabel instrument_code
-- ----------------------------------------------------------------------------
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

  -- Validasi kode alat menggunakan tabel master instrument_code.
  IF NOT EXISTS (
    SELECT 1 FROM instrument_code
     WHERE code_alat IS NOT NULL AND UPPER(code_alat) = UPPER(v_code)
     LIMIT 1
  ) THEN
    RAISE EXCEPTION 'instrument_code tidak terdaftar di master kode alat: %', v_code;
  END IF;

  -- Untuk FC no_identification wajib (dipakai di format). Untuk LC opsional.
  IF v_place = 'FC' AND v_no_ident IS NULL THEN
    RAISE EXCEPTION 'no_identification wajib untuk calibration_place=FC';
  END IF;

  -- Advisory lock scoped per (year, place). FC & LC tidak saling blocking.
  v_lock_key := (cur_year::BIGINT << 32) | (CASE WHEN v_place = 'FC' THEN 1 ELSE 2 END);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung no_order berikutnya dalam tahun ini untuk place ini.
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM certificate c
   WHERE c.created_at        >= year_start
     AND c.created_at        <  year_end
     AND c.calibration_place  = v_place;

  v_padded := LPAD(v_next::TEXT, 3, '0');

  -- Format final via helper (konsisten dengan preview_next_certificate_number).
  v_no_cert := public._format_certificate_no(
                 v_cert_type, v_place, v_code, v_no_ident, v_padded, cur_month, cur_year);

  -- INSERT row baru dengan nomor definitif.
  RETURN QUERY
  INSERT INTO certificate (
    no_certificate,
    no_order,
    certificate_type,
    calibration_place,
    instrument_code,
    no_identification,
    issue_date,
    station,
    instrument,
    authorized_by,
    verifikator_1,
    verifikator_2,
    verifikator_3,
    assignor,
    station_address,
    results,
    sent_by,
    created_by
  )
  VALUES (
    v_no_cert,
    v_padded,
    v_cert_type,
    v_place,
    v_code,
    v_no_ident,
    CASE
      WHEN NULLIF(p_data->>'issue_date', '') IS NULL THEN NULL
      ELSE (p_data->>'issue_date')::DATE
    END,
    NULLIF((p_data->>'station')::INT, 0),
    NULLIF((p_data->>'instrument')::INT, 0),
    NULLIF(p_data->>'authorized_by', '')::UUID,
    NULLIF(p_data->>'verifikator_1', '')::UUID,
    NULLIF(p_data->>'verifikator_2', '')::UUID,
    NULLIF(p_data->>'verifikator_3', '')::UUID,
    NULLIF(p_data->>'assignor', '')::UUID,
    NULLIF(p_data->>'station_address', ''),
    p_data->'results',
    NULLIF(p_data->>'sent_by', '')::UUID,
    NULLIF(p_data->>'created_by', '')::UUID
  )
  RETURNING *;
END;
$$;

REVOKE ALL    ON FUNCTION public.create_certificate_with_auto_number(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO service_role;

COMMENT ON FUNCTION public.create_certificate_with_auto_number(JSONB) IS
'Creates certificate with auto-generated number. Format: Sert.<Place>-<Code>/<NoOrder>.<NoIdent>/DIK/<RomanMonth>/<Year> (No. Order sebelum No. Identifikasi). Validasi kode alat via tabel instrument_code.';

-- ----------------------------------------------------------------------------
-- STEP 3 (OPSIONAL): Backfill nomor sertifikat DRAFT lama ke format baru.
-- ----------------------------------------------------------------------------
-- HATI-HATI: Hanya jalankan jika ingin memperbaiki nomor sertifikat yang masih
-- berstatus 'draft'. JANGAN ubah sertifikat yang sudah terbit/ditandatangani
-- karena nomor sertifikat adalah identitas dokumen resmi.
--
-- Uncomment blok di bawah bila perlu:
--
-- UPDATE certificate c
--    SET no_certificate = public._format_certificate_no(
--          COALESCE(c.certificate_type, 'sert'),
--          COALESCE(c.calibration_place, 'FC'),
--          c.instrument_code,
--          c.no_identification,
--          c.no_order,
--          EXTRACT(MONTH FROM c.created_at)::INT,
--          EXTRACT(YEAR  FROM c.created_at)::INT
--        )
--  WHERE c.status = 'draft'
--    AND c.instrument_code   IS NOT NULL
--    AND c.no_identification IS NOT NULL
--    AND c.no_order          IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Verifikasi cepat (preview format baru untuk FC, code AWS, no_ident 002)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_sample TEXT;
BEGIN
  v_sample := public._format_certificate_no('sert', 'FC', 'AWS', '002', '327', 6, 2026);
  RAISE NOTICE 'Contoh format baru: %', v_sample;  -- Sert.FC-AWS/327.002/DIK/VI/2026
END $$;
