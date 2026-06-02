-- =====================================================
-- Fix sensor_name_id foreign key constraint
-- =====================================================
-- Problem: sensor.sensor_name_id FK references instrument_code
-- Solution: Change it to reference instrument_names (as per schema)

-- Step 1: Check current constraint
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conname = 'sensor_sensor_name_id_fkey';

-- Step 2: Find orphaned sensor_name_id values (not in instrument_names)
SELECT 
  s.id,
  s.sensor_name_id,
  s.name AS sensor_name,
  i.name_alias AS instrument_name
FROM sensor s
LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
LEFT JOIN instrument i ON s.instrument_id = i.id
WHERE s.sensor_name_id IS NOT NULL 
  AND n.id IS NULL
ORDER BY s.id;

-- Step 3: Check if these sensor_name_id exist in instrument_code
SELECT 
  s.id AS sensor_id,
  s.sensor_name_id,
  s.name AS sensor_name,
  ic.id AS instrument_code_id,
  ic.name AS instrument_code_name
FROM sensor s
LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
LEFT JOIN instrument_code ic ON s.sensor_name_id = ic.id
WHERE s.sensor_name_id IS NOT NULL 
  AND n.id IS NULL
  AND ic.id IS NOT NULL
ORDER BY s.id;

-- Step 4: Option A - Set orphaned sensor_name_id to NULL
-- Uncomment this if you want to clean up orphaned references
/*
UPDATE sensor 
SET sensor_name_id = NULL
WHERE sensor_name_id IS NOT NULL 
  AND sensor_name_id NOT IN (SELECT id FROM instrument_names);
*/

-- Step 5: Option B - Migrate data from instrument_code to instrument_names
-- This creates missing entries in instrument_names based on instrument_code
-- Uncomment this if you want to preserve the relationships
/*
INSERT INTO instrument_names (id, name, instrument_code_id, created_at)
SELECT DISTINCT 
  ic.id,
  ic.name,
  ic.id,
  NOW()
FROM sensor s
JOIN instrument_code ic ON s.sensor_name_id = ic.id
LEFT JOIN instrument_names n ON ic.id = n.id
WHERE s.sensor_name_id IS NOT NULL 
  AND n.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- Step 6: Drop the incorrect constraint
ALTER TABLE sensor 
  DROP CONSTRAINT IF EXISTS sensor_sensor_name_id_fkey;

-- Step 7: Add correct constraint referencing instrument_names
ALTER TABLE sensor 
  ADD CONSTRAINT sensor_sensor_name_id_fkey 
  FOREIGN KEY (sensor_name_id) 
  REFERENCES instrument_names(id) 
  ON DELETE SET NULL;

-- Step 8: Verify the fix
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conname = 'sensor_sensor_name_id_fkey';

-- Step 9: Verify no orphaned records remain
SELECT COUNT(*) AS orphaned_count
FROM sensor s
LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
WHERE s.sensor_name_id IS NOT NULL 
  AND n.id IS NULL;

-- Done! 
-- If orphaned_count > 0, you need to run Option A or B above first.

-- Made with Bob
