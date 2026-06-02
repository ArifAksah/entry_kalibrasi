-- =====================================================
-- Fix sensor_name_id foreign key constraint (AUTO)
-- =====================================================
-- This script automatically migrates data and fixes the constraint

BEGIN;

-- Step 1: Check current constraint
DO $$
BEGIN
  RAISE NOTICE 'Step 1: Checking current constraint...';
END $$;

SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conname = 'sensor_sensor_name_id_fkey';

-- Step 2: Find and display orphaned sensor_name_id values
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM sensor s
  LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
  WHERE s.sensor_name_id IS NOT NULL 
    AND n.id IS NULL;
  
  RAISE NOTICE 'Step 2: Found % orphaned sensor_name_id records', orphaned_count;
END $$;

-- Step 3: Migrate orphaned data from instrument_code to instrument_names
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 3: Migrating orphaned data to instrument_names...';
  
  -- Insert missing entries in instrument_names based on instrument_code
  WITH to_migrate AS (
    SELECT DISTINCT 
      ic.id,
      ic.name,
      ic.id AS instrument_code_id
    FROM sensor s
    JOIN instrument_code ic ON s.sensor_name_id = ic.id
    LEFT JOIN instrument_names n ON ic.id = n.id
    WHERE s.sensor_name_id IS NOT NULL 
      AND n.id IS NULL
  )
  INSERT INTO instrument_names (id, name, instrument_code_id, created_at)
  SELECT id, name, instrument_code_id, NOW()
  FROM to_migrate
  ON CONFLICT (id) DO NOTHING;
  
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % records to instrument_names', migrated_count;
END $$;

-- Step 4: Verify no orphaned records remain
DO $$
DECLARE
  remaining_orphaned INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_orphaned
  FROM sensor s
  LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
  WHERE s.sensor_name_id IS NOT NULL 
    AND n.id IS NULL;
  
  IF remaining_orphaned > 0 THEN
    RAISE EXCEPTION 'Still have % orphaned records after migration!', remaining_orphaned;
  END IF;
  
  RAISE NOTICE 'Step 4: Verified - no orphaned records remain';
END $$;

-- Step 5: Drop the old constraint
DO $$
BEGIN
  RAISE NOTICE 'Step 5: Dropping old constraint...';
  ALTER TABLE sensor DROP CONSTRAINT IF EXISTS sensor_sensor_name_id_fkey;
  RAISE NOTICE 'Old constraint dropped';
END $$;

-- Step 6: Add new correct constraint
DO $$
BEGIN
  RAISE NOTICE 'Step 6: Adding new constraint...';
  ALTER TABLE sensor 
    ADD CONSTRAINT sensor_sensor_name_id_fkey 
    FOREIGN KEY (sensor_name_id) 
    REFERENCES instrument_names(id) 
    ON DELETE SET NULL;
  RAISE NOTICE 'New constraint added successfully';
END $$;

-- Step 7: Verify the fix
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conname = 'sensor_sensor_name_id_fkey';

-- Step 8: Final verification
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM sensor s
  LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
  WHERE s.sensor_name_id IS NOT NULL 
    AND n.id IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE!';
  RAISE NOTICE 'Orphaned records: %', orphaned_count;
  RAISE NOTICE 'Constraint now references: instrument_names';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Made with Bob
