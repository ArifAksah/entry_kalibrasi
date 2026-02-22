-- Rename 'sensor id_uut' to 'sensor_id_uut' if it exists with a space
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name = 'raw_data' AND column_name = 'sensor id_uut')
  THEN
      ALTER TABLE public.raw_data RENAME COLUMN "sensor id_uut" TO sensor_id_uut;
  END IF;
END $$;
