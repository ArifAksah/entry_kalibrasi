-- =====================================================
-- Script untuk membuat tabel instrument_sensors
-- dengan RLS policies sesuai role yang ada
-- =====================================================

-- 1. Buat tabel instrument_sensors
CREATE TABLE IF NOT EXISTS public.instrument_sensors (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER NOT NULL REFERENCES public.instrument(id) ON DELETE CASCADE,
  sensor_id INTEGER NOT NULL REFERENCES public.sensor(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination
  UNIQUE(instrument_id, sensor_id)
);

-- 2. Buat index untuk performa
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_instrument_id ON public.instrument_sensors(instrument_id);
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_sensor_id ON public.instrument_sensors(sensor_id);

-- 3. Enable RLS
ALTER TABLE public.instrument_sensors ENABLE ROW LEVEL SECURITY;

-- 4. Buat RLS policies sesuai role yang ada
-- Policy untuk admin (akses penuh)
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

-- Policy untuk assignor (akses penuh)
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

-- Policy untuk calibrator (akses penuh)
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

-- Policy untuk verifikator (hanya read)
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

-- 5. Tambahkan komentar
COMMENT ON TABLE public.instrument_sensors IS 'Tabel junction untuk relasi instrument-sensor (jika memiliki lebih dari satu sensor)';
COMMENT ON COLUMN public.instrument_sensors.instrument_id IS 'ID instrumen yang memiliki sensor';
COMMENT ON COLUMN public.instrument_sensors.sensor_id IS 'ID sensor yang terkait dengan instrumen';

-- 6. Tampilkan pesan sukses
SELECT 'Tabel instrument_sensors berhasil dibuat dengan RLS policies untuk role admin, assignor, calibrator, dan verifikator!' as message;
