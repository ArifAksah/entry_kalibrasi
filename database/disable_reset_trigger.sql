-- Disable the trigger that calls reset_verification_on_revision function
-- Run this in Supabase SQL Editor to fix the error

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS certificate_revision_trigger ON certificate;

-- Drop the trigger function if it exists  
DROP FUNCTION IF EXISTS trigger_reset_verification_on_revision();

-- Drop the main function if it exists
DROP FUNCTION IF EXISTS reset_verification_on_revision(INTEGER);

-- Verify triggers are removed (simplified query)
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname LIKE '%certificate%' OR t.tgname LIKE '%reset%';
