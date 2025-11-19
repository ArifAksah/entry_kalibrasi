-- Test certificate_verification table functionality
-- This script tests if the table works correctly

-- Test 1: Check if table exists and has correct structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'certificate_verification' 
ORDER BY ordinal_position;

-- Test 2: Check if there are any existing verification records
SELECT COUNT(*) as total_verifications FROM certificate_verification;

-- Test 3: Check if there are any certificates with verifikator_1 and verifikator_2
SELECT 
  id,
  no_certificate,
  verifikator_1,
  verifikator_2,
  assignor,
  status,
  version
FROM certificate 
WHERE verifikator_1 IS NOT NULL 
AND verifikator_2 IS NOT NULL 
AND status = 'draft'
LIMIT 5;

-- Test 4: Check if verifikator IDs exist in personel table
SELECT 
  c.id as certificate_id,
  c.no_certificate,
  c.verifikator_1,
  c.verifikator_2,
  p1.name as verifikator_1_name,
  p2.name as verifikator_2_name
FROM certificate c
LEFT JOIN personel p1 ON c.verifikator_1 = p1.id
LEFT JOIN personel p2 ON c.verifikator_2 = p2.id
WHERE c.verifikator_1 IS NOT NULL 
AND c.verifikator_2 IS NOT NULL 
AND c.status = 'draft'
LIMIT 5;

-- Test 5: Try to insert a test verification record (this will fail if there are issues)
-- Uncomment the lines below to test insertion
/*
INSERT INTO certificate_verification (
  certificate_id,
  verification_level,
  status,
  verified_by,
  certificate_version
) VALUES (
  1, -- Replace with actual certificate ID
  1,
  'pending',
  'test-user-id', -- Replace with actual user ID
  1
);
*/

-- Test 6: Check for any constraint violations
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'certificate_verification'::regclass;













