-- Create certificate_verification table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_verification_certificate_id ON certificate_verification(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_verified_by ON certificate_verification(verified_by);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_status ON certificate_verification(status);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_level ON certificate_verification(verification_level);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_certificate_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_certificate_verification_updated_at
  BEFORE UPDATE ON certificate_verification
  FOR EACH ROW
  EXECUTE FUNCTION update_certificate_verification_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE certificate_verification ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view verifications for certificates they are assigned to verify
CREATE POLICY "Users can view assigned certificate verifications" ON certificate_verification
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM certificate c 
      WHERE c.id = certificate_verification.certificate_id 
      AND (c.verifikator_1 = auth.uid() OR c.verifikator_2 = auth.uid() OR c.authorized_by = auth.uid())
    )
  );

-- Policy: Users can create verifications for certificates they are assigned to verify
CREATE POLICY "Users can create assigned certificate verifications" ON certificate_verification
  FOR INSERT WITH CHECK (
    verified_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM certificate c 
      WHERE c.id = certificate_verification.certificate_id 
      AND (
        (c.verifikator_1 = auth.uid() AND verification_level = 1) OR
        (c.verifikator_2 = auth.uid() AND verification_level = 2) OR
        (c.authorized_by = auth.uid() AND verification_level = 3)
      )
    )
  );

-- Policy: Users can update their own verifications
CREATE POLICY "Users can update their own verifications" ON certificate_verification
  FOR UPDATE USING (verified_by = auth.uid());

-- Policy: Users can delete their own verifications
CREATE POLICY "Users can delete their own verifications" ON certificate_verification
  FOR DELETE USING (verified_by = auth.uid());

-- Grant necessary permissions
GRANT ALL ON certificate_verification TO authenticated;
GRANT USAGE ON SEQUENCE certificate_verification_id_seq TO authenticated;
