-- Fix certificate_verification constraints
-- Run this in Supabase SQL Editor to fix constraint issues

-- Drop all existing constraints on certificate_verification
ALTER TABLE certificate_verification DROP CONSTRAINT IF EXISTS certificate_verification_certificate_id_verification_level_key;
ALTER TABLE certificate_verification DROP CONSTRAINT IF EXISTS certificate_verification_certificate_id_verification_level_version_key;
ALTER TABLE certificate_verification DROP CONSTRAINT IF EXISTS certificate_verification_pkey;

-- Add the correct unique constraint
ALTER TABLE certificate_verification ADD CONSTRAINT certificate_verification_unique 
  UNIQUE (certificate_id, verification_level, certificate_version);

-- Add primary key constraint
ALTER TABLE certificate_verification ADD CONSTRAINT certificate_verification_pkey 
  PRIMARY KEY (id);

-- Show the result
SELECT 'Constraints updated successfully' as result;














