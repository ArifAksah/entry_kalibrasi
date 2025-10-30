-- Fix assignor synchronization issue
-- This script updates existing certificates to have assignor field populated

-- Update certificates where assignor is NULL but authorized_by is not NULL
UPDATE certificate 
SET assignor = authorized_by 
WHERE assignor IS NULL 
AND authorized_by IS NOT NULL;

-- Update certificates where assignor is NULL and authorized_by is also NULL
-- Set assignor to the user who created the certificate (sent_by)
UPDATE certificate 
SET assignor = sent_by 
WHERE assignor IS NULL 
AND authorized_by IS NULL 
AND sent_by IS NOT NULL;

-- For certificates that still have NULL assignor, set it to a default user
-- You may need to replace 'default-user-id' with an actual user ID from your personel table
-- UPDATE certificate 
-- SET assignor = 'default-user-id' 
-- WHERE assignor IS NULL;

-- Verify the update
SELECT 
  id,
  no_certificate,
  authorized_by,
  assignor,
  verifikator_1,
  verifikator_2,
  status,
  CASE 
    WHEN assignor IS NULL THEN 'MISSING ASSIGNOR'
    WHEN assignor = authorized_by THEN 'ASSIGNOR = AUTHORIZED_BY'
    WHEN assignor = sent_by THEN 'ASSIGNOR = SENT_BY'
    ELSE 'ASSIGNOR SET'
  END as assignor_status
FROM certificate 
ORDER BY created_at DESC
LIMIT 10;




