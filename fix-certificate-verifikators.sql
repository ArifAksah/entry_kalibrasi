-- Script untuk memperbaiki certificate yang belum ada verifikator
-- Jalankan di Supabase SQL Editor

-- 1. Cek certificate yang belum ada verifikator
SELECT 
  id, 
  no_certificate, 
  verifikator_1, 
  verifikator_2,
  created_at
FROM certificate 
WHERE verifikator_1 IS NULL OR verifikator_2 IS NULL
ORDER BY created_at DESC;

-- 2. Update certificate dengan verifikator default (ganti dengan ID personel yang ada)
-- UNCOMMENT dan ganti dengan ID personel yang valid:

-- UPDATE certificate 
-- SET 
--   verifikator_1 = 'uuid-personel-1',  -- ganti dengan ID personel yang valid
--   verifikator_2 = 'uuid-personel-2'   -- ganti dengan ID personel yang valid
-- WHERE verifikator_1 IS NULL OR verifikator_2 IS NULL;

-- 3. Cek personel yang tersedia
SELECT id, name FROM personel ORDER BY created_at DESC LIMIT 10;

-- 4. Verifikasi update berhasil
SELECT 
  id, 
  no_certificate, 
  verifikator_1, 
  verifikator_2
FROM certificate 
WHERE id IN (SELECT id FROM certificate WHERE verifikator_1 IS NULL OR verifikator_2 IS NULL);

