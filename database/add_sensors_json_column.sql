-- Add sensors JSON column to instrument table for multi-sensor support
ALTER TABLE public.instrument 
ADD COLUMN IF NOT EXISTS sensors_data JSONB DEFAULT '[]'::jsonb;

-- Create index for JSON queries
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_data ON public.instrument USING GIN (sensors_data);

-- Add RLS policies for sensors_data column access
-- Policy for admin (full access)
CREATE POLICY admin_access_sensors_data ON public.instrument 
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
CREATE POLICY assignor_access_sensors_data ON public.instrument 
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
CREATE POLICY calibrator_access_sensors_data ON public.instrument 
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
CREATE POLICY verifikator_select_sensors_data ON public.instrument 
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
COMMENT ON COLUMN public.instrument.sensors_data IS 'JSON data untuk menyimpan informasi sensor jika memiliki lebih dari satu sensor';

-- Show success message
SELECT 'Kolom sensors_data berhasil ditambahkan ke tabel instrument dengan RLS policies!' as message;
