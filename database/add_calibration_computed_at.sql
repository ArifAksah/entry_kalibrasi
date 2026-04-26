-- ============================================================================
-- Migration: tambah kolom calibration_computed_at
-- ----------------------------------------------------------------------------
-- Tujuan: menandai apakah user sudah pernah menjalankan
--   "Hitung dan Input Tabel ke Sertifikat" di modal QC Check Data.
--
-- Aturan UX: selama kolom ini NULL, tombol "KIRIM KONSEP" di halaman draft-view
-- akan di-lock, disertai banner checklist yang memandu user.
--
-- Idempoten: aman di-rerun.
-- ============================================================================

ALTER TABLE certificate
  ADD COLUMN IF NOT EXISTS calibration_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN certificate.calibration_computed_at IS
  'Timestamp terakhir kali user menjalankan "Hitung dan Input Tabel ke Sertifikat" '
  'di QC Data Modal. NULL = belum pernah dihitung (KIRIM KONSEP dikunci di UI).';

-- ----------------------------------------------------------------------------
-- Verifikasi
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'certificate'
       AND column_name = 'calibration_computed_at'
  ) THEN
    RAISE EXCEPTION 'Migration gagal: kolom calibration_computed_at tidak terbentuk';
  END IF;
  RAISE NOTICE 'Migration OK: certificate.calibration_computed_at siap dipakai.';
END $$;
