-- Check existing constraints on certificate_verification table
-- Run this in Supabase SQL Editor to see what constraints exist

SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'certificate_verification'
ORDER BY tc.constraint_name, kcu.ordinal_position;











