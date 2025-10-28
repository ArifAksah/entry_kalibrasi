-- Fix rejection flow SQL script for Supabase
-- Run this script in Supabase SQL Editor

-- Step 1: Add rejection destination columns to certificate_verification table
ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_destination VARCHAR(20) DEFAULT 'creator';

ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_reason_detailed TEXT;

ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Add rejection flow tracking to certificate table
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS last_rejection_by UUID REFERENCES personel(id);

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS last_rejection_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS rejection_history JSONB DEFAULT '[]'::jsonb;

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_verification_rejection_destination 
ON certificate_verification(rejection_destination);

CREATE INDEX IF NOT EXISTS idx_certificate_verification_rejection_timestamp 
ON certificate_verification(rejection_timestamp);

CREATE INDEX IF NOT EXISTS idx_certificate_rejection_count 
ON certificate(rejection_count);

CREATE INDEX IF NOT EXISTS idx_certificate_last_rejection_by 
ON certificate(last_rejection_by);

-- Step 4: Add constraint for rejection_destination
ALTER TABLE certificate_verification 
ADD CONSTRAINT IF NOT EXISTS check_rejection_destination 
CHECK (rejection_destination IN ('creator', 'verifikator_1'));

-- Step 5: Create a simple view for rejection flow tracking
CREATE OR REPLACE VIEW certificate_rejection_flow AS
SELECT 
  c.id as certificate_id,
  c.no_certificate,
  c.no_order,
  c.status,
  c.rejection_count,
  c.last_rejection_by,
  c.last_rejection_at,
  c.rejection_history,
  -- Verifikator 1 rejection info
  cv1.id as verifikator_1_verification_id,
  cv1.status as verifikator_1_status,
  cv1.rejection_destination as verifikator_1_rejection_destination,
  cv1.rejection_reason_detailed as verifikator_1_rejection_reason,
  cv1.rejection_timestamp as verifikator_1_rejection_timestamp,
  -- Verifikator 2 rejection info
  cv2.id as verifikator_2_verification_id,
  cv2.status as verifikator_2_status,
  cv2.rejection_destination as verifikator_2_rejection_destination,
  cv2.rejection_reason_detailed as verifikator_2_rejection_reason,
  cv2.rejection_timestamp as verifikator_2_rejection_timestamp,
  -- Creator info
  c.sent_by as creator_id,
  p_creator.name as creator_name,
  -- Verifikator info
  c.verifikator_1,
  p_v1.name as verifikator_1_name,
  c.verifikator_2,
  p_v2.name as verifikator_2_name
FROM certificate c
LEFT JOIN certificate_verification cv1 ON c.id = cv1.certificate_id AND cv1.verification_level = 1
LEFT JOIN certificate_verification cv2 ON c.id = cv2.certificate_id AND cv2.verification_level = 2
LEFT JOIN personel p_creator ON c.sent_by = p_creator.id
LEFT JOIN personel p_v1 ON c.verifikator_1 = p_v1.id
LEFT JOIN personel p_v2 ON c.verifikator_2 = p_v2.id;

-- Step 6: Create function to handle rejection flow
CREATE OR REPLACE FUNCTION handle_certificate_rejection(
  p_certificate_id INTEGER,
  p_verification_level INTEGER,
  p_rejection_reason TEXT,
  p_rejection_destination VARCHAR(20) DEFAULT 'creator'
)
RETURNS JSONB AS $$
DECLARE
  v_certificate RECORD;
  v_verification RECORD;
  v_rejection_history JSONB;
  v_new_rejection_entry JSONB;
BEGIN
  -- Get certificate info
  SELECT * INTO v_certificate FROM certificate WHERE id = p_certificate_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificate not found');
  END IF;
  
  -- Get verification info
  SELECT * INTO v_verification 
  FROM certificate_verification 
  WHERE certificate_id = p_certificate_id AND verification_level = p_verification_level;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification not found');
  END IF;
  
  -- Create new rejection entry
  v_new_rejection_entry := jsonb_build_object(
    'verification_level', p_verification_level,
    'rejection_reason', p_rejection_reason,
    'rejection_destination', p_rejection_destination,
    'rejection_timestamp', NOW(),
    'rejected_by', v_verification.verified_by
  );
  
  -- Update rejection history
  v_rejection_history := COALESCE(v_certificate.rejection_history, '[]'::jsonb);
  v_rejection_history := v_rejection_history || v_new_rejection_entry;
  
  -- Update certificate with rejection info
  UPDATE certificate 
  SET 
    rejection_count = rejection_count + 1,
    last_rejection_by = v_verification.verified_by,
    last_rejection_at = NOW(),
    rejection_history = v_rejection_history,
    status = CASE 
      WHEN p_rejection_destination = 'creator' THEN 'draft'
      WHEN p_rejection_destination = 'verifikator_1' THEN 'sent'
      ELSE 'draft'
    END
  WHERE id = p_certificate_id;
  
  -- Update verification record
  UPDATE certificate_verification 
  SET 
    status = 'rejected',
    rejection_reason_detailed = p_rejection_reason,
    rejection_destination = p_rejection_destination,
    rejection_timestamp = NOW(),
    updated_at = NOW()
  WHERE certificate_id = p_certificate_id AND verification_level = p_verification_level;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rejection processed successfully',
    'certificate_status', CASE 
      WHEN p_rejection_destination = 'creator' THEN 'draft'
      WHEN p_rejection_destination = 'verifikator_1' THEN 'sent'
      ELSE 'draft'
    END,
    'rejection_destination', p_rejection_destination
  );
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to get rejection options for verifikator 2
CREATE OR REPLACE FUNCTION get_rejection_options(p_certificate_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_certificate RECORD;
  v_options JSONB;
BEGIN
  -- Get certificate info
  SELECT * INTO v_certificate FROM certificate WHERE id = p_certificate_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificate not found');
  END IF;
  
  -- Build rejection options
  v_options := jsonb_build_object(
    'success', true,
    'options', jsonb_build_array(
      jsonb_build_object(
        'value', 'creator',
        'label', 'Kembali ke Pembuat Sertifikat',
        'description', 'Sertifikat akan dikembalikan ke pembuat untuk diperbaiki'
      ),
      jsonb_build_object(
        'value', 'verifikator_1',
        'label', 'Kembali ke Verifikator 1',
        'description', 'Sertifikat akan dikembalikan ke Verifikator 1 untuk review ulang'
      )
    ),
    'certificate_info', jsonb_build_object(
      'id', v_certificate.id,
      'no_certificate', v_certificate.no_certificate,
      'creator_id', v_certificate.sent_by,
      'verifikator_1_id', v_certificate.verifikator_1
    )
  );
  
  RETURN v_options;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Test the setup
SELECT 'Rejection flow setup completed successfully!' as message;

-- Step 9: Verify the new columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'certificate_verification' 
AND column_name IN ('rejection_destination', 'rejection_reason_detailed', 'rejection_timestamp')
ORDER BY ordinal_position;

SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'certificate' 
AND column_name IN ('rejection_count', 'last_rejection_by', 'last_rejection_at', 'rejection_history')
ORDER BY ordinal_position;
