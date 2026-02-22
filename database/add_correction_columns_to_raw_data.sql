
-- Menambahkan kolom koreksi yang dibutuhkan oleh trigger hitung_koreksi
ALTER TABLE raw_data
ADD COLUMN IF NOT EXISTS std_correction NUMERIC,
ADD COLUMN IF NOT EXISTS std_corrected NUMERIC,
ADD COLUMN IF NOT EXISTS uut_correction NUMERIC;

-- Opsional: Memastikan trigger ada (jika belum)
-- CREATE OR REPLACE TRIGGER trigger_hitung_koreksi
-- BEFORE INSERT OR UPDATE ON raw_data
-- FOR EACH ROW EXECUTE FUNCTION hitung_koreksi();
