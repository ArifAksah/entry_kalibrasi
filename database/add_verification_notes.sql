-- Add verification notes and repair functionality to certificate system

-- Add verification notes columns to certificate table
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_notes TEXT;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_status VARCHAR(20) DEFAULT 'none' CHECK (repair_status IN ('none', 'pending', 'completed', 'rejected'));
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_repair_status ON certificate(repair_status);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_notes ON certificate(verification_notes);

-- Update certificate_verification table to include more detailed notes
ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Create a view for certificate verification status with notes
CREATE OR REPLACE VIEW certificate_verification_status AS
SELECT 
  c.id as certificate_id,
  c.no_certificate,
  c.no_order,
  c.no_identification,
  c.issue_date,
  c.verification_notes,
  c.rejection_reason,
  c.repair_notes,
  c.repair_status,
  c.repair_requested_at,
  c.repair_completed_at,
  -- Verification level 1 (Verifikator 1)
  v1.status as verifikator_1_status,
  v1.notes as verifikator_1_notes,
  v1.rejection_reason as verifikator_1_rejection_reason,
  v1.approval_notes as verifikator_1_approval_notes,
  v1.created_at as verifikator_1_created_at,
  p1.name as verifikator_1_name,
  -- Verification level 2 (Verifikator 2)
  v2.status as verifikator_2_status,
  v2.notes as verifikator_2_notes,
  v2.rejection_reason as verifikator_2_rejection_reason,
  v2.approval_notes as verifikator_2_approval_notes,
  v2.created_at as verifikator_2_created_at,
  p2.name as verifikator_2_name,
  -- Verification level 3 (Authorized By)
  v3.status as authorized_by_status,
  v3.notes as authorized_by_notes,
  v3.rejection_reason as authorized_by_rejection_reason,
  v3.approval_notes as authorized_by_approval_notes,
  v3.created_at as authorized_by_created_at,
  p3.name as authorized_by_name,
  -- Overall status calculation
  CASE 
    WHEN v1.status = 'rejected' OR v2.status = 'rejected' OR v3.status = 'rejected' THEN 'rejected'
    WHEN v1.status = 'approved' AND v2.status = 'approved' AND v3.status = 'approved' THEN 'approved'
    WHEN v1.status = 'pending' OR v2.status = 'pending' OR v3.status = 'pending' THEN 'pending'
    ELSE 'pending'
  END as overall_status
FROM certificate c
LEFT JOIN certificate_verification v1 ON c.id = v1.certificate_id AND v1.verification_level = 1
LEFT JOIN certificate_verification v2 ON c.id = v2.certificate_id AND v2.verification_level = 2
LEFT JOIN certificate_verification v3 ON c.id = v3.certificate_id AND v3.verification_level = 3
LEFT JOIN personel p1 ON v1.verified_by = p1.id
LEFT JOIN personel p2 ON v2.verified_by = p2.id
LEFT JOIN personel p3 ON v3.verified_by = p3.id;

-- Grant permissions for the view
GRANT SELECT ON certificate_verification_status TO authenticated;

-- Create function to request certificate repair
CREATE OR REPLACE FUNCTION request_certificate_repair(
  cert_id INTEGER,
  repair_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE certificate 
  SET 
    repair_status = 'pending',
    repair_notes = repair_notes,
    repair_requested_at = NOW()
  WHERE id = cert_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to complete certificate repair
CREATE OR REPLACE FUNCTION complete_certificate_repair(
  cert_id INTEGER,
  completion_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE certificate 
  SET 
    repair_status = 'completed',
    repair_notes = COALESCE(completion_notes, repair_notes),
    repair_completed_at = NOW()
  WHERE id = cert_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset certificate verification (for repair)
CREATE OR REPLACE FUNCTION reset_certificate_verification(
  cert_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delete existing verifications
  DELETE FROM certificate_verification WHERE certificate_id = cert_id;
  
  -- Reset certificate verification fields
  UPDATE certificate 
  SET 
    verification_notes = NULL,
    rejection_reason = NULL,
    repair_status = 'none',
    repair_notes = NULL,
    repair_requested_at = NULL,
    repair_completed_at = NULL
  WHERE id = cert_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION request_certificate_repair TO authenticated;
GRANT EXECUTE ON FUNCTION complete_certificate_repair TO authenticated;
GRANT EXECUTE ON FUNCTION reset_certificate_verification TO authenticated;
