-- Create instrument_sensors table for multi-sensor instruments
CREATE TABLE IF NOT EXISTS public.instrument_sensors (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER NOT NULL REFERENCES public.instrument(id) ON DELETE CASCADE,
  sensor_id INTEGER NOT NULL REFERENCES public.sensor(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination
  UNIQUE(instrument_id, sensor_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_instrument_id ON public.instrument_sensors(instrument_id);
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_sensor_id ON public.instrument_sensors(sensor_id);

-- Add RLS policies for security
ALTER TABLE public.instrument_sensors ENABLE ROW LEVEL SECURITY;

-- Policy for admin (full access)
CREATE POLICY admin_all_instrument_sensors ON public.instrument_sensors 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policy for assignor (read and write access)
CREATE POLICY assignor_all_instrument_sensors ON public.instrument_sensors 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'assignor'
    )
  );

-- Policy for calibrator (read and write access)
CREATE POLICY calibrator_all_instrument_sensors ON public.instrument_sensors 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'calibrator'
    )
  );

-- Policy for verifikator (read access only)
CREATE POLICY verifikator_select_instrument_sensors ON public.instrument_sensors 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'verifikator'
    )
  );

-- Add comment
COMMENT ON TABLE public.instrument_sensors IS 'Tabel junction untuk relasi instrument-sensor (jika memiliki lebih dari satu sensor)';

-- Show success message
SELECT 'Tabel instrument_sensors berhasil dibuat!' as message;
