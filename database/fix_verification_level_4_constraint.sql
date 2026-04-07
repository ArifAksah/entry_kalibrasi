-- ============================================================
-- MIGRATION: Allow verification_level = 4 for Penandatangan
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Drop the existing check constraint that only allows 1,2,3
ALTER TABLE certificate_verification 
  DROP CONSTRAINT IF EXISTS certificate_verification_verification_level_check;

-- Step 2: Add new constraint that allows 1,2,3,4
ALTER TABLE certificate_verification 
  ADD CONSTRAINT certificate_verification_verification_level_check 
  CHECK (verification_level IN (1, 2, 3, 4));

-- Step 3: Update RLS policies to include level 4 (Penandatangan)
-- Drop old insert policy
DROP POLICY IF EXISTS "Users can create assigned certificate verifications" ON certificate_verification;

-- Recreate insert policy with level 4 support
CREATE POLICY "Users can create assigned certificate verifications" 
  ON certificate_verification
  FOR INSERT WITH CHECK (
    verified_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM certificate c
      WHERE c.id = certificate_verification.certificate_id
      AND (
        (c.verifikator_1 = auth.uid() AND verification_level = 1) OR
        (c.verifikator_2 = auth.uid() AND verification_level = 2) OR
        (c.verifikator_3 = auth.uid() AND verification_level = 3) OR
        (c.authorized_by  = auth.uid() AND verification_level = 4)
      )
    )
  );

-- Step 4: Also update SELECT policy to include level 4
DROP POLICY IF EXISTS "Users can view assigned certificate verifications" ON certificate_verification;

CREATE POLICY "Users can view assigned certificate verifications" 
  ON certificate_verification
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM certificate c
      WHERE c.id = certificate_verification.certificate_id
      AND (
        c.verifikator_1 = auth.uid() OR
        c.verifikator_2 = auth.uid() OR
        c.verifikator_3 = auth.uid() OR
        c.authorized_by  = auth.uid()
      )
    )
  );

-- Verify the changes
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'certificate_verification'::regclass
  AND contype = 'c'
ORDER BY conname;
