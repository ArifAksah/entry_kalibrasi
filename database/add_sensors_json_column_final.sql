-- =====================================================
-- Script untuk menambahkan kolom sensors_data ke tabel instrument
-- dengan RLS policies sesuai role yang ada
-- =====================================================

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

-- 4. Tambahkan komentar
COMMENT ON COLUMN public.instrument.sensors_data IS 'JSON data untuk menyimpan informasi sensor jika memiliki lebih dari satu sensor';

-- 5. Tampilkan pesan sukses
SELECT 'Kolom sensors_data berhasil ditambahkan ke tabel instrument dengan RLS policies untuk role admin, assignor, calibrator, dan verifikator!' as message;
