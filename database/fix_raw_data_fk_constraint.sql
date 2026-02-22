-- Fix Foreign Key Constraint for raw_data.sensor_id_std
-- Corrected: references 'sensor' table (singular)

DO $$
BEGIN
    -- 1. Drop the incorrect foreign key constraint (if any exist)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'raw_data_sensor id_std_fkey') THEN
        ALTER TABLE public.raw_data DROP CONSTRAINT "raw_data_sensor id_std_fkey";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'raw_data_sensor_id_std_fkey') THEN
        ALTER TABLE public.raw_data DROP CONSTRAINT "raw_data_sensor_id_std_fkey";
    END IF;

    -- 2. Add the correct foreign key constraint (referencing sensor table)
    ALTER TABLE public.raw_data
    ADD CONSTRAINT raw_data_sensor_id_std_fkey
    FOREIGN KEY (sensor_id_std)
    REFERENCES public.sensor(id)
    ON DELETE SET NULL;

END $$;
