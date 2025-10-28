-- Add draft status and workflow columns to certificate table
-- This supports the new workflow where certificates go to draft first before being sent to verifiers

-- Add draft status column
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'verified', 'rejected', 'completed'));

-- Add workflow tracking columns
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS draft_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS sent_to_verifiers_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES personel(id);

-- Add assignor column for the new workflow
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS assignor UUID REFERENCES personel(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_status ON certificate(status);
CREATE INDEX IF NOT EXISTS idx_certificate_draft_created_at ON certificate(draft_created_at);
CREATE INDEX IF NOT EXISTS idx_certificate_sent_to_verifiers_at ON certificate(sent_to_verifiers_at);
CREATE INDEX IF NOT EXISTS idx_certificate_sent_by ON certificate(sent_by);
CREATE INDEX IF NOT EXISTS idx_certificate_assignor ON certificate(assignor);

-- Update existing certificates to have 'draft' status if they don't have verifikator_1 and verifikator_2 assigned
UPDATE certificate 
SET status = 'draft' 
WHERE status IS NULL 
AND (verifikator_1 IS NULL OR verifikator_2 IS NULL);

-- Update existing certificates to have 'sent' status if they have verifikator_1 and verifikator_2 assigned
UPDATE certificate 
SET status = 'sent' 
WHERE status IS NULL 
AND verifikator_1 IS NOT NULL 
AND verifikator_2 IS NOT NULL;

-- Create a view for certificate workflow status
CREATE OR REPLACE VIEW certificate_workflow_status AS
SELECT 
  c.id as certificate_id,
  c.no_certificate,
  c.no_order,
  c.status,
  c.draft_created_at,
  c.sent_to_verifiers_at,
  c.sent_by,
  c.assignor,
  c.verifikator_1,
  c.verifikator_2,
  c.authorized_by,
  -- Verifikator 1 status
  CASE 
    WHEN cv1.status = 'approved' THEN 'approved'
    WHEN cv1.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END as verifikator_1_status,
  -- Verifikator 2 status
  CASE 
    WHEN cv2.status = 'approved' THEN 'approved'
    WHEN cv2.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END as verifikator_2_status,
  -- Overall verification status
  CASE 
    WHEN cv1.status = 'rejected' OR cv2.status = 'rejected' THEN 'rejected'
    WHEN cv1.status = 'approved' AND cv2.status = 'approved' THEN 'approved'
    ELSE 'pending'
  END as overall_verification_status
FROM certificate c
LEFT JOIN certificate_verification cv1 ON c.id = cv1.certificate_id AND cv1.verification_level = 1
LEFT JOIN certificate_verification cv2 ON c.id = cv2.certificate_id AND cv2.verification_level = 2;

-- Add RLS policies for the new columns
ALTER TABLE certificate ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view certificates based on their role and assignment
CREATE POLICY "Users can view assigned certificates" ON certificate
  FOR SELECT
  USING (
    -- Draft creators can view their drafts
    (status = 'draft' AND sent_by = auth.uid()) OR
    -- Verifikator 1 can view certificates assigned to them
    (verifikator_1 = auth.uid()) OR
    -- Verifikator 2 can view certificates assigned to them
    (verifikator_2 = auth.uid()) OR
    -- Assignor can view certificates assigned to them
    (assignor = auth.uid()) OR
    -- Authorized by can view certificates they authorized
    (authorized_by = auth.uid()) OR
    -- Admin can view all certificates
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Users can update certificates based on their role
CREATE POLICY "Users can update assigned certificates" ON certificate
  FOR UPDATE
  USING (
    -- Draft creators can update their drafts
    (status = 'draft' AND sent_by = auth.uid()) OR
    -- Verifikator 1 can update certificates assigned to them
    (verifikator_1 = auth.uid()) OR
    -- Verifikator 2 can update certificates assigned to them
    (verifikator_2 = auth.uid()) OR
    -- Assignor can update certificates assigned to them
    (assignor = auth.uid()) OR
    -- Admin can update all certificates
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Users can insert certificates (create drafts)
CREATE POLICY "Users can create certificate drafts" ON certificate
  FOR INSERT
  WITH CHECK (
    -- Users can create drafts
    status = 'draft' AND sent_by = auth.uid()
  );
