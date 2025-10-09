-- Script untuk memperbaiki masalah data Hasil Kalibrasi Sensor
-- Jalankan di Supabase SQL Editor

-- 1. Tambahkan kolom results jika belum ada
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS results JSONB;

-- 2. Tambahkan index untuk performa query JSONB
CREATE INDEX IF NOT EXISTS idx_certificate_results ON certificate USING GIN (results);

-- 3. Cek struktur tabel certificate
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'certificate' 
AND column_name IN ('results', 'no_certificate', 'no_order')
ORDER BY ordinal_position;

-- 4. Cek data sample dari tabel certificate
SELECT 
  id, 
  no_certificate, 
  no_order, 
  CASE 
    WHEN results IS NULL THEN 'NULL'
    WHEN results = '[]'::jsonb THEN 'Empty Array'
    WHEN jsonb_array_length(results) > 0 THEN 'Has Data (' || jsonb_array_length(results) || ' items)'
    ELSE 'Other'
  END as results_status,
  results
FROM certificate 
ORDER BY created_at DESC
LIMIT 10;

-- 5. Tampilkan pesan sukses
SELECT 'Script selesai! Kolom results sudah ditambahkan dan data dicek.' as message;
