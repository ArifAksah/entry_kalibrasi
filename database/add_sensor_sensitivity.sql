BEGIN;

-- ============================================================================
-- Tambah kolom SENSITIVITAS pada master sensor (pyranometer).
--
-- Menurut workbook kalibrasi pyranometer (mis. pyranometer.xlsx):
--   Sensitivitas = INPUT spesifikasi alat (µV/Wm-2), dicatat per sensor
--   (UUT Global, UUT Diffuse, dan alat standar) — mis. 7.22 / 7.01 / 12.5.
-- Nilai ini TIDAK dipakai dalam budget uncertainty (U95), hanya identitas alat
-- dan dasar perhitungan "sensitivitas baru" untuk pyranometer analog.
-- ============================================================================

ALTER TABLE public.sensor ADD COLUMN IF NOT EXISTS sensitivity double precision;

COMMIT;

-- Verifikasi:
-- SELECT id, name, type, serial_number, resolution, sensitivity
-- FROM public.sensor WHERE name ILIKE '%yranometer%' ORDER BY id;
