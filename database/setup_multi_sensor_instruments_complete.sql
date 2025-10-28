-- =====================================================
-- Script lengkap untuk multi-sensor instruments
-- Pilih salah satu pendekatan: Tabel Junction atau JSON Column
-- =====================================================

-- =====================================================
-- OPSI 1: MENGGUNAKAN TABEL JUNCTION (RECOMMENDED)
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

-- =====================================================
-- OPSI 2: MENGGUNAKAN JSON COLUMN (ALTERNATIVE)
-- =====================================================

-- Uncomment bagian ini jika ingin menggunakan pendekatan JSON column
/*
-- 1. Tambahkan kolom sensors_data ke tabel instrument
ALTER TABLE public.instrument 
ADD COLUMN IF NOT EXISTS sensors_data JSONB DEFAULT '[]'::jsonb;

-- 2. Buat index untuk performa query JSON
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_data ON public.instrument USING GIN (sensors_data);

-- 3. Buat RLS policies untuk akses kolom sensors_data
-- Policy untuk admin (akses penuh)
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

-- Policy untuk assignor (akses penuh)
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

-- Policy untuk calibrator (akses penuh)
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

-- Policy untuk verifikator (hanya read)
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
*/

-- =====================================================
-- FUNGSI HELPER UNTUK TABEL JUNCTION
-- =====================================================

-- Fungsi untuk menambah sensor ke instrument
CREATE OR REPLACE FUNCTION add_sensor_to_instrument(
  p_instrument_id INTEGER,
  p_sensor_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_multiple BOOLEAN;
BEGIN
  -- Check if instrument has memiliki_lebih_satu = TRUE
  SELECT memiliki_lebih_satu INTO v_has_multiple
  FROM public.instrument 
  WHERE id = p_instrument_id;
  
  IF NOT v_has_multiple THEN
    RAISE EXCEPTION 'Instrument tidak memiliki flag memiliki_lebih_satu = TRUE';
  END IF;
  
  -- Insert relationship
  INSERT INTO public.instrument_sensors (instrument_id, sensor_id)
  VALUES (p_instrument_id, p_sensor_id)
  ON CONFLICT (instrument_id, sensor_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk menghapus sensor dari instrument
CREATE OR REPLACE FUNCTION remove_sensor_from_instrument(
  p_instrument_id INTEGER,
  p_sensor_id INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM public.instrument_sensors 
  WHERE instrument_id = p_instrument_id AND sensor_id = p_sensor_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER UNTUK KONSISTENSI DATA
-- =====================================================

-- Trigger untuk memastikan konsistensi data
CREATE OR REPLACE FUNCTION check_instrument_sensor_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika memiliki_lebih_satu = FALSE, hapus semua relasi sensor
  IF NEW.memiliki_lebih_satu = FALSE THEN
    DELETE FROM public.instrument_sensors WHERE instrument_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_instrument_sensor_consistency
  AFTER UPDATE ON public.instrument
  FOR EACH ROW
  EXECUTE FUNCTION check_instrument_sensor_consistency();

-- =====================================================
-- KOMENTAR DAN PESAN SUKSES
-- =====================================================

-- Tambahkan komentar
COMMENT ON TABLE public.instrument_sensors IS 'Tabel junction untuk relasi instrument-sensor (jika memiliki lebih dari satu sensor)';
COMMENT ON COLUMN public.instrument_sensors.instrument_id IS 'ID instrumen yang memiliki sensor';
COMMENT ON COLUMN public.instrument_sensors.sensor_id IS 'ID sensor yang terkait dengan instrumen';

-- Tampilkan pesan sukses
SELECT 'Multi-sensor instruments setup berhasil dibuat dengan RLS policies untuk role admin, assignor, calibrator, dan verifikator!' as message;
