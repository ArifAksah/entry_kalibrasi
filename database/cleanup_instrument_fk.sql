-- ============================================================================
-- CLEANUP: Fix Foreign Key Constraints pada tabel instrument
-- ============================================================================
-- Masalah: Delete pada tabel `instrument_code` gagal karena FK constraint
-- dari tabel `instrument` (instrument_instrument_names_id_fkey).
--
-- Script ini:
-- 1. Menampilkan instrumen yang masih reference ke instrument_code/instrument_names
--    yang mungkin ingin dihapus
-- 2. Mengubah FK constraint menjadi ON DELETE SET NULL agar delete tidak gagal
--    (instrumen tetap ada, hanya referensi-nya jadi NULL)
-- ============================================================================

-- STEP 1: Cek instrumen yang reference ke instrument_names (kolom "names")
-- Jalankan ini dulu untuk lihat data yang terdampak
SELECT 
  i.id AS instrument_id,
  i.name_alias,
  i.names AS instrument_names_id,
  n.names AS instrument_name,
  n.code_alat
FROM instrument i
LEFT JOIN instrument_names n ON i.names = n.id
WHERE i.names IS NOT NULL
ORDER BY i.names;

-- STEP 2: Cek instrumen yang reference ke instrument_code (kolom "instrument_code_id")
SELECT 
  i.id AS instrument_id,
  i.name_alias,
  i.instrument_code_id,
  c.code_alat,
  c.names AS code_name
FROM instrument i
LEFT JOIN instrument_code c ON i.instrument_code_id = c.id
WHERE i.instrument_code_id IS NOT NULL
ORDER BY i.instrument_code_id;

-- ============================================================================
-- STEP 3: Ubah FK constraint agar ON DELETE SET NULL
-- Ini memungkinkan delete instrument_code/instrument_names tanpa error,
-- instrumen yang reference akan otomatis di-set NULL pada kolom FK-nya.
-- ============================================================================

-- Drop dan recreate FK untuk instrument.names → instrument_names
-- (Nama constraint mungkin berbeda di DB kamu, cek dengan query di bawah)

-- Cek nama constraint yang ada:
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'instrument' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================================================
-- STEP 4: Jalankan ALTER TABLE untuk ubah FK menjadi ON DELETE SET NULL
-- Sesuaikan nama constraint dengan hasil query di atas!
-- ============================================================================

-- FK: instrument.names → instrument_names.id
ALTER TABLE instrument 
  DROP CONSTRAINT IF EXISTS instrument_instrument_names_id_fkey;

ALTER TABLE instrument
  ADD CONSTRAINT instrument_instrument_names_id_fkey
  FOREIGN KEY (names) REFERENCES instrument_names(id)
  ON DELETE SET NULL;

-- FK: instrument.instrument_code_id → instrument_code.id
ALTER TABLE instrument 
  DROP CONSTRAINT IF EXISTS instrument_instrument_code_id_fkey;

ALTER TABLE instrument
  ADD CONSTRAINT instrument_instrument_code_id_fkey
  FOREIGN KEY (instrument_code_id) REFERENCES instrument_code(id)
  ON DELETE SET NULL;

-- ============================================================================
-- DONE! Sekarang delete instrument_code atau instrument_names tidak akan error.
-- Instrumen yang reference akan otomatis di-set NULL pada kolom FK-nya.
-- ============================================================================
