BEGIN;

-- Penugasan dokumen yang dipilih BERSAMAAN saat memesan order. Nilai ini
-- berlaku sebagai default: setiap identifikasi (order item) yang dibuat
-- sesudahnya mewarisi penugasan ini dan masih bisa disesuaikan per alat.
ALTER TABLE public.calibration_orders
  ADD COLUMN IF NOT EXISTS default_verifikator_1 uuid REFERENCES public.personel(id),
  ADD COLUMN IF NOT EXISTS default_verifikator_2 uuid REFERENCES public.personel(id),
  ADD COLUMN IF NOT EXISTS default_verifikator_3 uuid REFERENCES public.personel(id),
  ADD COLUMN IF NOT EXISTS default_authorized_by uuid REFERENCES public.personel(id);

COMMIT;
