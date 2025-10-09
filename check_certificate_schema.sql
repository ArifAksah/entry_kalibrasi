-- Script untuk mengecek schema tabel certificate
-- Jalankan di Supabase SQL Editor

-- 1. Cek struktur tabel certificate
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'certificate' 
ORDER BY ordinal_position;

-- 2. Cek apakah kolom results ada
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'certificate' 
  AND column_name = 'results'
) as has_results_column;

-- 3. Cek data sample dari tabel certificate
SELECT id, no_certificate, no_order, results
FROM certificate 
LIMIT 5;
