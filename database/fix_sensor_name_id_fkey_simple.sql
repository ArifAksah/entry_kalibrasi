-- =====================================================
-- Fix sensor_name_id foreign key constraint (SIMPLE)
-- =====================================================
-- This script sets orphaned sensor_name_id to NULL and fixes the constraint

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

-- Step 2: Find orphaned sensor_name_id values
DO $$
DECLARE
  orphaned_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM sensor s
  LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
  WHERE s.sensor_name_id IS NOT NULL
    AND n.id IS NULL;
  
  RAISE NOTICE 'Step 2: Found % orphaned sensor_name_id records', orphaned_count;
  
  -- Display the orphaned records
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Orphaned sensor records:';
    FOR rec IN
      SELECT s.id, s.sensor_name_id, s.name
      FROM sensor s
      LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
      WHERE s.sensor_name_id IS NOT NULL
        AND n.id IS NULL
      LIMIT 10
    LOOP
      RAISE NOTICE '  - Sensor ID: %, sensor_name_id: %, name: %', rec.id, rec.sensor_name_id, rec.name;
    END LOOP;
  END IF;
END $$;

-- Step 3: Set orphaned sensor_name_id to NULL
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 3: Setting orphaned sensor_name_id to NULL...';
  
  UPDATE sensor 
  SET sensor_name_id = NULL
  WHERE sensor_name_id IS NOT NULL 
    AND sensor_name_id NOT IN (SELECT id FROM instrument_names);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % records (set sensor_name_id to NULL)', updated_count;
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
    RAISE EXCEPTION 'Still have % orphaned records after cleanup!', remaining_orphaned;
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
  total_sensors INTEGER;
  sensors_with_name_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sensors FROM sensor;
  SELECT COUNT(*) INTO sensors_with_name_id FROM sensor WHERE sensor_name_id IS NOT NULL;
  
  SELECT COUNT(*) INTO orphaned_count
  FROM sensor s
  LEFT JOIN instrument_names n ON s.sensor_name_id = n.id
  WHERE s.sensor_name_id IS NOT NULL 
    AND n.id IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE!';
  RAISE NOTICE 'Total sensors: %', total_sensors;
  RAISE NOTICE 'Sensors with sensor_name_id: %', sensors_with_name_id;
  RAISE NOTICE 'Orphaned records: %', orphaned_count;
  RAISE NOTICE 'Constraint now references: instrument_names';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Made with Bob
