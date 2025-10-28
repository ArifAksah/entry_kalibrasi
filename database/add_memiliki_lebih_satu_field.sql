-- Add memiliki_lebih_satu field to instrument table
-- This field controls whether sensor fields should be shown/hidden

-- Add the boolean field to instrument table
ALTER TABLE instrument 
ADD COLUMN memiliki_lebih_satu BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field purpose
COMMENT ON COLUMN instrument.memiliki_lebih_satu IS 'Controls whether sensor fields are active/shown. When true, sensor fields become visible.';

-- Update existing records to have default value
UPDATE instrument 
SET memiliki_lebih_satu = FALSE 
WHERE memiliki_lebih_satu IS NULL;

-- Make the field NOT NULL after setting default values
ALTER TABLE instrument 
ALTER COLUMN memiliki_lebih_satu SET NOT NULL;

-- Show success message
SELECT 'Field memiliki_lebih_satu added successfully to instrument table' as result;
