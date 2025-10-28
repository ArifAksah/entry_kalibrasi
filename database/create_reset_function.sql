-- Simple reset verification function that works with existing database
-- Run this script in Supabase SQL Editor

-- Drop function if exists
DROP FUNCTION IF EXISTS reset_verification_on_revision(INTEGER);

-- Create the function
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

-- Test the function (optional - remove this line after testing)
-- SELECT reset_verification_on_revision(1);
