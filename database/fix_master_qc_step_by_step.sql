-- Step-by-step fix for master_qc table
-- Run each step one by one

-- ============================================
-- STEP 1: Check current invalid data
-- ============================================
SELECT 
    mq.id,
    mq.instrument_name_id,
    mq.nilai_batas_koreksi,
    mq.catatan,
    mq.created_at
FROM master_qc mq
LEFT JOIN instrument_names ins ON mq.instrument_name_id = ins.id
WHERE ins.id IS NULL
ORDER BY mq.id;

-- ============================================
-- STEP 2: Backup invalid data (optional)
-- ============================================
-- CREATE TABLE master_qc_backup_invalid AS
-- SELECT * FROM master_qc mq
-- LEFT JOIN instrument_names ins ON mq.instrument_name_id = ins.id
-- WHERE ins.id IS NULL;

-- ============================================
-- STEP 3: Delete invalid data
-- ============================================
DELETE FROM master_qc
WHERE instrument_name_id NOT IN (SELECT id FROM instrument_names);

-- ============================================
-- STEP 4: Verify no invalid data remains
-- ============================================
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT instrument_name_id) as unique_instruments
FROM master_qc;

-- Should return 0 invalid records
SELECT 
    COUNT(*) as invalid_records
FROM master_qc mq
LEFT JOIN instrument_names ins ON mq.instrument_name_id = ins.id
WHERE ins.id IS NULL;

-- ============================================
-- STEP 5: Now drop and recreate the constraint
-- ============================================
-- Drop existing constraint
ALTER TABLE master_qc 
DROP CONSTRAINT IF EXISTS master_qc_instrument_name_id_fkey;

-- Add correct constraint
ALTER TABLE master_qc 
ADD CONSTRAINT master_qc_instrument_name_id_fkey 
FOREIGN KEY (instrument_name_id) 
REFERENCES instrument_names(id) 
ON DELETE CASCADE;

-- ============================================
-- STEP 6: Verify constraint is correct
-- ============================================
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='master_qc'
  AND kcu.column_name='instrument_name_id';

-- Expected result: foreign_table_name should be 'instrument_names', not 'instrument_code'

-- Made with Bob
