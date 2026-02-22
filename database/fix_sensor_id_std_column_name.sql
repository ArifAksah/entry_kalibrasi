-- Rename the column 'sensor id_std' to 'sensor_id_std'
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name = 'raw_data' AND column_name = 'sensor id_std')
  THEN
      ALTER TABLE public.raw_data RENAME COLUMN "sensor id_std" TO sensor_id_std;
  END IF;
END $$;
