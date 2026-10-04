-- ============================================================================
-- Calibration Order — 04: FK personel untuk calibration_order_personnel
-- ----------------------------------------------------------------------------
-- Menambahkan foreign key `calibration_order_personnel.personel_id -> personel.id`.
-- Tanpa FK ini, embed PostgREST `personel(name, nip)` pada detail order selalu
-- kosong sehingga "Tim Order" tidak tampil walau data tersimpan.
--
-- Idempoten: aman dijalankan berkali-kali.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calibration_order_personnel_personel_id_fkey'
  ) THEN
    ALTER TABLE public.calibration_order_personnel
      ADD CONSTRAINT calibration_order_personnel_personel_id_fkey
      FOREIGN KEY (personel_id) REFERENCES public.personel(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;

-- Muat ulang skema PostgREST agar relasi baru dikenali (opsional; biasanya
-- otomatis, tapi aman dipanggil).
NOTIFY pgrst, 'reload schema';
