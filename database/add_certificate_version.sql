-- Add version column to certificate table
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add certificate_version column to certificate_verification table if it doesn't exist
ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS certificate_version INTEGER NOT NULL DEFAULT 1;

-- Update existing certificate_verification records to have certificate_version = 1
UPDATE certificate_verification SET certificate_version = 1 WHERE certificate_version IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_verification_certificate_version ON certificate_verification(certificate_version);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_level_version ON certificate_verification(verification_level, certificate_version);

-- Update the unique constraint to include certificate_version
ALTER TABLE certificate_verification DROP CONSTRAINT IF EXISTS certificate_verification_certificate_id_verification_level_key;
ALTER TABLE certificate_verification ADD CONSTRAINT certificate_verification_certificate_id_verification_level_version_key 
  UNIQUE (certificate_id, verification_level, certificate_version);








