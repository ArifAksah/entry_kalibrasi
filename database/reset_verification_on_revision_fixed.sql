-- Simplified version of reset verification function
-- This version avoids complex data types that might cause issues

-- Function to reset verification status when certificate is revised
CREATE OR REPLACE FUNCTION reset_verification_on_revision(p_certificate_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_reset_count INTEGER := 0;
BEGIN
  -- Check if certificate exists
  IF NOT EXISTS (SELECT 1 FROM certificate WHERE id = p_certificate_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificate not found');
  END IF;
  
  -- Reset all verification statuses to pending
  UPDATE certificate_verification 
  SET 
    status = 'pending',
    notes = NULL,
    rejection_reason = NULL,
    rejection_reason_detailed = NULL,
    rejection_destination = NULL,
    rejection_timestamp = NULL,
    approval_notes = NULL,
    updated_at = NOW()
  WHERE certificate_id = p_certificate_id;
  
  -- Get count of affected rows
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Update certificate status to 'sent' to indicate it's ready for verification again
  UPDATE certificate 
  SET 
    status = 'sent',
    updated_at = NOW()
  WHERE id = p_certificate_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification status reset successfully',
    'certificate_status', 'sent',
    'reset_count', v_reset_count
  );
END;
$$ LANGUAGE plpgsql;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_verification_on_revision(INTEGER) TO authenticated;

-- Create trigger to automatically reset verification when certificate is updated after rejection
CREATE OR REPLACE FUNCTION trigger_reset_verification_on_revision()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if version increased (indicating revision)
  IF OLD.version < NEW.version THEN
    -- Check if there were any rejections
    IF EXISTS (
      SELECT 1 FROM certificate_verification 
      WHERE certificate_id = NEW.id AND status = 'rejected'
    ) THEN
      -- Reset verification statuses
      PERFORM reset_verification_on_revision(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS certificate_revision_trigger ON certificate;
CREATE TRIGGER certificate_revision_trigger
  AFTER UPDATE ON certificate
  FOR EACH ROW
  EXECUTE FUNCTION trigger_reset_verification_on_revision();

-- Test the function
-- SELECT reset_verification_on_revision(1); -- Replace 1 with actual certificate ID
