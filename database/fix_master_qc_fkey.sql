-- Fix master_qc foreign key constraint
-- The constraint should reference instrument_names.id, not instrument_code.id

-- Drop the incorrect foreign key constraint
ALTER TABLE master_qc 
DROP CONSTRAINT IF EXISTS master_qc_instrument_name_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE master_qc 
ADD CONSTRAINT master_qc_instrument_name_id_fkey 
FOREIGN KEY (instrument_name_id) 
REFERENCES instrument_names(id) 
ON DELETE CASCADE;

-- Verify the constraint
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

-- Made with Bob
