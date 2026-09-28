-- ============================================================================
-- ADMINISTRATIVE: reset SATU sertifikat agar dapat di-TTE ulang
-- ============================================================================
-- Jalankan lewat Supabase SQL Editor sebagai database administrator.
--
-- Sebelum Run, ganti HANYA nilai berikut:
--   v_certificate_no : nomor sertifikat yang akan di-TTE ulang
--
-- Yang dilakukan:
--   1. Mengunci row sertifikat selama transaction (mencegah race).
--   2. Memastikan approval level 1, 2, dan 3 pada versi aktif masih lengkap.
--   3. Menghapus approval/TTE level 4 HANYA pada versi aktif.
--   4. Mengubah status certificate menjadi `sent`.
--   5. Mengosongkan pdf_path, pdf_generated_at, dan issue_date supaya proses
--      TTE berikutnya menghasilkan PDF baru dengan tanggal penerbitan baru.
--
-- Yang TIDAK dilakukan:
--   - Tidak mengubah results, raw_data, version, verifikator, authorized_by,
--     user_roles, atau approval level 1-3.
--   - Tidak menghapus file PDF lama dari Storage. File lama dipertahankan
--     sebagai bukti/arsip.
--   - Tidak membuat certificate_logs karena SQL Editor tidak menyediakan
--     identitas user aplikasi yang menjalankannya. Ini menghindari pencatatan
--     pelaksana yang tidak akurat.
--
-- Aman dijalankan ulang: jika sertifikat sudah berada pada kondisi siap TTE
-- ulang, script berhenti tanpa membuat perubahan kedua.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _resign_reset_result (
  certificate_id bigint PRIMARY KEY
) ON COMMIT DROP;
TRUNCATE _resign_reset_result;

DO $$
DECLARE
  -- WAJIB DIGANTI sebelum Run:
  v_certificate_no text := 'GANTI_NOMOR_SERTIFIKAT';

  v_certificate public.certificate%ROWTYPE;
  v_approved_levels integer;
  v_has_level_4 boolean;
BEGIN
  IF btrim(v_certificate_no) = ''
     OR v_certificate_no LIKE 'GANTI\_%' ESCAPE '\' THEN
    RAISE EXCEPTION 'Isi v_certificate_no terlebih dahulu';
  END IF;

  -- Lock row sampai COMMIT. INTO STRICT mencegah nomor tidak ada/duplikat.
  BEGIN
    SELECT c.*
      INTO STRICT v_certificate
    FROM public.certificate c
    WHERE c.no_certificate = btrim(v_certificate_no)
    FOR UPDATE;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE EXCEPTION 'Sertifikat % tidak ditemukan', v_certificate_no;
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Nomor sertifikat % duplikat; reset dibatalkan', v_certificate_no;
  END;

  IF v_certificate.authorized_by IS NULL THEN
    RAISE EXCEPTION 'Sertifikat % belum memiliki penandatangan (authorized_by)',
      v_certificate_no;
  END IF;

  -- Approval level 1-3 versi aktif harus tetap utuh agar yang diulang hanya TTE.
  SELECT count(DISTINCT cv.verification_level)
    INTO v_approved_levels
  FROM public.certificate_verification cv
  WHERE cv.certificate_id = v_certificate.id
    AND cv.certificate_version = COALESCE(v_certificate.version, 1)
    AND cv.verification_level BETWEEN 1 AND 3
    AND cv.status = 'approved';

  IF v_approved_levels <> 3 THEN
    RAISE EXCEPTION
      'Approval level 1-3 versi % tidak lengkap (%/3). Reset TTE dibatalkan',
      COALESCE(v_certificate.version, 1), v_approved_levels;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.certificate_verification cv
    WHERE cv.certificate_id = v_certificate.id
      AND cv.certificate_version = COALESCE(v_certificate.version, 1)
      AND cv.verification_level = 4
      AND cv.status = 'approved'
  ) INTO v_has_level_4;

  -- Idempotency guard: jangan log/update lagi jika sudah siap TTE ulang.
  IF NOT v_has_level_4
     AND v_certificate.status = 'sent'
     AND v_certificate.pdf_path IS NULL
     AND v_certificate.pdf_generated_at IS NULL THEN
    RAISE NOTICE 'Sertifikat % sudah siap untuk TTE ulang; tidak ada perubahan',
      v_certificate_no;
    INSERT INTO _resign_reset_result (certificate_id)
    VALUES (v_certificate.id);
    RETURN;
  END IF;

  -- Jangan reset dokumen yang sebenarnya belum pernah selesai ditandatangani.
  IF NOT v_has_level_4
     AND v_certificate.status <> 'completed'
     AND v_certificate.pdf_path IS NULL THEN
    RAISE EXCEPTION
      'Sertifikat % belum completed/TTE level 4; reset dibatalkan',
      v_certificate_no;
  END IF;

  DELETE FROM public.certificate_verification
  WHERE certificate_id = v_certificate.id
    AND certificate_version = COALESCE(v_certificate.version, 1)
    AND verification_level = 4;

  UPDATE public.certificate
  SET status = 'sent',
      pdf_path = NULL,
      pdf_generated_at = NULL,
      issue_date = NULL
  WHERE id = v_certificate.id;

  INSERT INTO _resign_reset_result (certificate_id)
  VALUES (v_certificate.id);

  RAISE NOTICE
    'Reset TTE selesai: certificate_id=%, version=%, authorized_by=%',
    v_certificate.id,
    COALESCE(v_certificate.version, 1),
    v_certificate.authorized_by;
END $$;

-- Hasil akhir. Harus menunjukkan:
--   certificate_status = sent
--   pdf_path / pdf_generated_at / issue_date = NULL
--   level 1-3 = approved
--   level 4 = tidak ada
SELECT
  c.id,
  c.no_certificate,
  c.version AS current_version,
  c.status AS certificate_status,
  c.pdf_path,
  c.pdf_generated_at,
  c.issue_date,
  c.authorized_by,
  p.name AS signer_name,
  p.email AS signer_email,
  jsonb_agg(
    jsonb_build_object(
      'level', cv.verification_level,
      'status', cv.status,
      'verified_by', cv.verified_by
    ) ORDER BY cv.verification_level
  ) FILTER (WHERE cv.id IS NOT NULL) AS active_verifications
FROM _resign_reset_result r
JOIN public.certificate c ON c.id = r.certificate_id
LEFT JOIN public.personel p ON p.id = c.authorized_by
LEFT JOIN public.certificate_verification cv
  ON cv.certificate_id = c.id
 AND cv.certificate_version = COALESCE(c.version, 1)
GROUP BY c.id, c.no_certificate, c.version, c.status, c.pdf_path,
  c.pdf_generated_at, c.issue_date, c.authorized_by, p.name, p.email;

COMMIT;
