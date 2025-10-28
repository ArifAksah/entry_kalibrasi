-- Simple rejection flow setup for Supabase
-- Run this script step by step in Supabase SQL Editor

-- Step 1: Add columns to certificate_verification table
ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_destination VARCHAR(20) DEFAULT 'creator';

ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_reason_detailed TEXT;

ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Add columns to certificate table
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS last_rejection_by UUID REFERENCES personel(id);

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS last_rejection_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS rejection_history JSONB DEFAULT '[]'::jsonb;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_certificate_verification_rejection_destination 
ON certificate_verification(rejection_destination);

CREATE INDEX IF NOT EXISTS idx_certificate_rejection_count 
ON certificate(rejection_count);

-- Step 4: Add constraint
ALTER TABLE certificate_verification 
ADD CONSTRAINT IF NOT EXISTS check_rejection_destination 
CHECK (rejection_destination IN ('creator', 'verifikator_1'));

-- Step 5: Verify setup
SELECT 'Rejection flow columns added successfully!' as message;
