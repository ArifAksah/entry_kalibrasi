-- ============================================================================
-- Atomic Certificate Number Generation (Race-condition safe)
-- ----------------------------------------------------------------------------
-- Masalah yang dipecahkan:
--   Sebelumnya client memanggil /api/certificates/generate-number (SELECT MAX)
--   lalu user mengisi form, baru POST /api/certificates yang INSERT.
--   Dengan banyak user login bersamaan, window SELECT→INSERT menyebabkan
--   DUA user dapat no_order yang SAMA (race condition / TOCTOU).
--
-- Solusi (3 lapis):
--   Lapis 1  UNIQUE constraint di kolom no_certificate sebagai safety net
--            akhir (DB menolak duplikat walaupun aplikasi bug).
--   Lapis 2  PostgreSQL function yang (a) acquire pg_advisory_xact_lock
--            scoped per tahun, (b) compute nomor berikutnya, (c) INSERT row,
--            (d) return row lengkap — semua dalam SATU transaksi atomik.
--            Lock dilepas otomatis di akhir transaksi.
--   Lapis 3  API layer melakukan retry bila ter-catch 23505 unique_violation.
--
-- Cara menjalankan:
--   Jalankan script ini di Supabase SQL Editor. Idempoten (aman dijalankan
--   berkali-kali).
-- ============================================================================

-- -----------------------------------------------------------------------
-- LAPIS 1: UNIQUE constraint + bersihkan potensi duplikat lama
-- -----------------------------------------------------------------------

-- 1a. Cek apakah ada duplikat sebelum constraint (report-only).
--     Jika query ini mengembalikan baris, Anda harus memperbaiki duplikat
--     secara manual sebelum ADD CONSTRAINT di bawah akan berhasil.
DO $$
DECLARE
  v_dup_count INT;
BEGIN
  SELECT COUNT(*) INTO v_dup_count FROM (
    SELECT no_certificate
      FROM certificate
     WHERE no_certificate IS NOT NULL
     GROUP BY no_certificate
    HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE NOTICE 'WARNING: ditemukan % nilai no_certificate duplikat. Jalankan query di komentar di bawah untuk melihatnya.', v_dup_count;
  ELSE
    RAISE NOTICE 'OK: tidak ada duplikat no_certificate.';
  END IF;
END $$;

-- Untuk investigasi manual (jika ada warning di atas):
--   SELECT no_certificate, COUNT(*) c
--     FROM certificate
--    GROUP BY no_certificate
--   HAVING COUNT(*) > 1
--    ORDER BY c DESC;

-- 1b. Tambahkan UNIQUE constraint (idempoten).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'certificate_no_certificate_unique'
  ) THEN
    ALTER TABLE certificate
      ADD CONSTRAINT certificate_no_certificate_unique UNIQUE (no_certificate);
  END IF;
END $$;

-- 1c. Index pendukung untuk query MAX per tahun.
--     CATATAN: `EXTRACT(YEAR FROM created_at)` bersifat STABLE (bukan
--     IMMUTABLE) pada TIMESTAMPTZ karena hasilnya tergantung timezone session,
--     sehingga tidak bisa dipakai sebagai functional index.
--     Cukup index biasa pada created_at; fungsi akan diubah memakai predikat
--     range [tahun, tahun+1) agar index ini termanfaatkan.
CREATE INDEX IF NOT EXISTS idx_certificate_created_at
  ON certificate (created_at);

-- -----------------------------------------------------------------------
-- LAPIS 2: Fungsi atomik untuk menghasilkan nomor + INSERT dalam 1 transaksi
-- -----------------------------------------------------------------------
--
-- Parameter sengaja menggunakan JSONB agar fleksibel terhadap evolusi
-- kolom di tabel certificate. Kolom yang digunakan harus eksis di DB.
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
  roman         TEXT[]      := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  v_next        INT;
  v_padded      TEXT;
  v_no_cert     TEXT;
  v_lock_key    BIGINT;
BEGIN
  -- Kunci skala per-tahun. Request lain untuk tahun sama akan menunggu
  -- sampai transaksi ini selesai (commit atau rollback).
  v_lock_key := ('x' || substr(md5('certificate_no_order_' || cur_year::TEXT), 1, 16))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung no_order berikutnya berdasarkan MAX untuk tahun berjalan.
  -- Range predicate [year_start, year_end) memanfaatkan index idx_certificate_created_at.
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM public.certificate c
   WHERE c.created_at >= year_start
     AND c.created_at <  year_end;

  v_padded  := lpad(v_next::TEXT, 3, '0');
  v_no_cert := 'SERT.FC.AWS/' || v_padded || '/DIK/' || roman[cur_month] || '/' || cur_year;

  RETURN QUERY
  INSERT INTO public.certificate (
    no_certificate,
    no_order,
    no_identification,
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
    NULLIF(p_data->>'no_identification', ''),
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

-- Beri akses execute ke role authenticated & service_role (Supabase).
REVOKE ALL ON FUNCTION public.create_certificate_with_auto_number(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO service_role;

-- -----------------------------------------------------------------------
-- (Opsional) Fungsi preview — hanya untuk ditampilkan di UI saat modal
-- dibuka. Nomor yang ditampilkan TIDAK dijamin final; nomor definitif
-- dihasilkan saat create_certificate_with_auto_number() dipanggil.
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_next_certificate_number()
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
  roman       TEXT[]      := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  v_next      INT;
  v_padded    TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM public.certificate c
   WHERE c.created_at >= year_start
     AND c.created_at <  year_end;

  v_padded := lpad(v_next::TEXT, 3, '0');

  RETURN QUERY SELECT
    v_padded,
    ('SERT.FC.AWS/' || v_padded || '/DIK/' || roman[cur_month] || '/' || cur_year)::TEXT;
END $$;

REVOKE ALL ON FUNCTION public.preview_next_certificate_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_next_certificate_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_certificate_number() TO service_role;
