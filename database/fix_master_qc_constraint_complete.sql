-- Complete fix for master_qc foreign key constraint
-- This script will fix the constraint that incorrectly references instrument_code instead of instrument_names

-- Step 1: Check current constraint
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

-- Step 2: Drop ALL foreign key constraints on instrument_name_id column
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name='master_qc'
          AND kcu.column_name='instrument_name_id'
    LOOP
        EXECUTE format('ALTER TABLE master_qc DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Step 3: Add the CORRECT foreign key constraint
ALTER TABLE master_qc 
ADD CONSTRAINT master_qc_instrument_name_id_fkey 
FOREIGN KEY (instrument_name_id) 
REFERENCES instrument_names(id) 
ON DELETE CASCADE;

-- Step 4: Verify the new constraint is correct
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

-- Step 5: Test the constraint by checking if all existing data is valid
SELECT 
    COUNT(*) as total_master_qc_records,
    COUNT(DISTINCT mq.instrument_name_id) as unique_instrument_names,
    COUNT(CASE WHEN ins.id IS NULL THEN 1 END) as invalid_references
FROM master_qc mq
LEFT JOIN instrument_names ins ON mq.instrument_name_id = ins.id;

-- Made with Bob
