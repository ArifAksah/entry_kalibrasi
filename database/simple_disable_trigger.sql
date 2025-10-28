-- Simple script to disable the problematic trigger
-- Run this in Supabase SQL Editor to fix the error

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS certificate_revision_trigger ON certificate;

-- Drop the trigger function if it exists  
DROP FUNCTION IF EXISTS trigger_reset_verification_on_revision();

-- Drop the main function if it exists
DROP FUNCTION IF EXISTS reset_verification_on_revision(INTEGER);

-- Show success message
SELECT 'Triggers and functions removed successfully' as result;
