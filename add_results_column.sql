-- Script untuk menambahkan kolom results ke tabel certificate
-- Jalankan di Supabase SQL Editor

-- 1. Tambahkan kolom results jika belum ada
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS results JSONB;

-- 2. Tambahkan index untuk performa query JSONB
CREATE INDEX IF NOT EXISTS idx_certificate_results ON certificate USING GIN (results);

-- 3. Tampilkan pesan sukses
SELECT 'Kolom results berhasil ditambahkan ke tabel certificate!' as message;

-- 4. Verifikasi kolom sudah ada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'certificate' 
AND column_name = 'results';
