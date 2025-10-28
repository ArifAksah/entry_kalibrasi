-- Fix certificate_verification table issues
-- This script ensures the table exists and has the correct structure

-- Create certificate_verification table if it doesn't exist
CREATE TABLE IF NOT EXISTS certificate_verification (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES certificate(id) ON DELETE CASCADE,
  verification_level INTEGER NOT NULL CHECK (verification_level IN (1, 2, 3)),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  verified_by UUID NOT NULL REFERENCES personel(id) ON DELETE CASCADE,
  certificate_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one verification per certificate per level
  UNIQUE(certificate_id, verification_level, certificate_version)
);

-- Add certificate_version column if it doesn't exist
ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS certificate_version INTEGER NOT NULL DEFAULT 1;

-- Update existing records to have certificate_version = 1
UPDATE certificate_verification SET certificate_version = 1 WHERE certificate_version IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_verification_certificate_id ON certificate_verification(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_verified_by ON certificate_verification(verified_by);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_status ON certificate_verification(status);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_level ON certificate_verification(verification_level);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_certificate_version ON certificate_verification(certificate_version);

-- Update the unique constraint to include certificate_version
ALTER TABLE certificate_verification DROP CONSTRAINT IF EXISTS certificate_verification_certificate_id_verification_level_key;
ALTER TABLE certificate_verification ADD CONSTRAINT certificate_verification_certificate_id_verification_level_version_key 
  UNIQUE (certificate_id, verification_level, certificate_version);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_certificate_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_certificate_verification_updated_at ON certificate_verification;
CREATE TRIGGER trigger_update_certificate_verification_updated_at
  BEFORE UPDATE ON certificate_verification
  FOR EACH ROW
  EXECUTE FUNCTION update_certificate_verification_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE certificate_verification ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view assigned certificate verifications" ON certificate_verification;
DROP POLICY IF EXISTS "Users can update assigned certificate verifications" ON certificate_verification;
DROP POLICY IF EXISTS "Users can create certificate verifications" ON certificate_verification;

-- Policy: Users can view verifications for certificates they are assigned to verify
CREATE POLICY "Users can view assigned certificate verifications" ON certificate_verification
  FOR SELECT
  USING (
    -- Verifikator can view their assigned verifications
    verified_by = auth.uid() OR
    -- Admin can view all verifications
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Users can update verifications they are assigned to
CREATE POLICY "Users can update assigned certificate verifications" ON certificate_verification
  FOR UPDATE
  USING (
    -- Verifikator can update their assigned verifications
    verified_by = auth.uid() OR
    -- Admin can update all verifications
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Users can create verifications (system only)
CREATE POLICY "Users can create certificate verifications" ON certificate_verification
  FOR INSERT
  WITH CHECK (
    -- Only system can create verifications
    verified_by = auth.uid() OR
    -- Admin can create verifications
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'certificate_verification' 
ORDER BY ordinal_position;

-- Check if there are any existing verification records
SELECT COUNT(*) as total_verifications FROM certificate_verification;

-- Show sample data if any exists
SELECT * FROM certificate_verification LIMIT 5;
