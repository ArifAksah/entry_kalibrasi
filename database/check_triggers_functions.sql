-- Check for any triggers or functions that might interfere
-- Run this in Supabase SQL Editor

-- Check triggers on certificate_verification table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'certificate_verification';

-- Check if there are any functions that might be called
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%certificate%' OR routine_name LIKE '%verification%';





