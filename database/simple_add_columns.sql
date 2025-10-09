-- Script SQL Sederhana - Hanya menambahkan kolom yang diperlukan
-- Jalankan script ini di Supabase SQL Editor

-- 1. Tambahkan kolom ke tabel certificate
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS repair_notes TEXT,
ADD COLUMN IF NOT EXISTS repair_status VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS repair_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Tambahkan kolom ke tabel certificate_verification
ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- 3. Buat index untuk performa
CREATE INDEX IF NOT EXISTS idx_certificate_repair_status ON certificate(repair_status);

-- 4. Tampilkan pesan sukses
SELECT 'Kolom berhasil ditambahkan!' as message;
