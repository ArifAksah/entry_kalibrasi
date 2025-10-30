-- Migration script to fix instrument names that are NULL or empty
-- This will update old instruments to have a default name based on their type and manufacturer

-- Step 1: Update instruments with NULL name
-- Set name to concatenation of manufacturer and type
UPDATE instrument
SET name = COALESCE(manufacturer, 'Unknown') || ' ' || COALESCE(type, 'Instrument')
WHERE name IS NULL;

-- Step 2: Update instruments with empty string name
-- Set name to concatenation of manufacturer and type
UPDATE instrument
SET name = COALESCE(manufacturer, 'Unknown') || ' ' || COALESCE(type, 'Instrument')
WHERE name = '';

-- Step 3: Verify the update
SELECT 
  id,
  name,
  manufacturer,
  type,
  serial_number,
  CASE 
    WHEN name IS NULL THEN 'NULL'
    WHEN name = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE'
  END as name_status
FROM instrument
ORDER BY id DESC
LIMIT 20;

-- Step 4: Make sure the name column is NOT NULL in the future (optional, uncomment if needed)
-- ALTER TABLE instrument ALTER COLUMN name SET NOT NULL;




