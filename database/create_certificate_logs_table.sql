-- =====================================================
-- Create Certificate Logs Table
-- Tabel untuk menyimpan log semua aktivitas certificate
-- =====================================================

-- 1. Buat tabel certificate_logs
CREATE TABLE IF NOT EXISTS public.certificate_logs (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES public.certificate(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'sent', 'approved_v1', 'approved_v2', 'approved_assignor', 'rejected_v1', 'rejected_v2', 'rejected_assignor', 'updated', 'deleted'
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT, -- Nama user untuk referensi cepat
  notes TEXT, -- Catatan/notes dari action
  rejection_reason TEXT, -- Alasan penolakan jika action adalah rejected
  approval_notes TEXT, -- Catatan persetujuan
  verification_level INTEGER, -- 1 = verifikator 1, 2 = verifikator 2, 3 = assignor/authorized_by
  previous_status VARCHAR(50), -- Status sebelumnya
  new_status VARCHAR(50), -- Status baru setelah action
  metadata JSONB, -- Data tambahan dalam format JSON (opsional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat index untuk performa query
CREATE INDEX IF NOT EXISTS idx_certificate_logs_certificate_id ON public.certificate_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_logs_performed_by ON public.certificate_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_certificate_logs_action ON public.certificate_logs(action);
CREATE INDEX IF NOT EXISTS idx_certificate_logs_created_at ON public.certificate_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificate_logs_certificate_action ON public.certificate_logs(certificate_id, action);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE public.certificate_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policy untuk admin (akses penuh)
CREATE POLICY admin_all_certificate_logs ON public.certificate_logs 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- 5. Policy untuk assignor (akses penuh)
CREATE POLICY assignor_all_certificate_logs ON public.certificate_logs 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'assignor'
    )
  );

-- 6. Policy untuk calibrator (akses penuh)
CREATE POLICY calibrator_all_certificate_logs ON public.certificate_logs 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'calibrator'
    )
  );

-- 7. Policy untuk verifikator (read only, bisa create log untuk certificate yang ditugaskan)
CREATE POLICY verifikator_select_certificate_logs ON public.certificate_logs 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'verifikator'
    )
  );

CREATE POLICY verifikator_insert_certificate_logs ON public.certificate_logs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'verifikator'
    )
    AND (
      -- Bisa insert log jika certificate ditugaskan ke user ini sebagai verifikator
      EXISTS (
        SELECT 1 FROM public.certificate c
        WHERE c.id = certificate_logs.certificate_id
        AND (c.verifikator_1 = auth.uid() OR c.verifikator_2 = auth.uid() OR c.authorized_by = auth.uid())
      )
    )
  );

-- 8. Policy untuk user_station (read only untuk certificate yang terkait dengan station mereka)
CREATE POLICY user_station_select_certificate_logs ON public.certificate_logs 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.certificate c ON c.station = (
        SELECT station_id FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'user_station' 
        LIMIT 1
      )
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'user_station'
      AND c.id = certificate_logs.certificate_id
    )
  );

-- 9. Comment untuk dokumentasi
COMMENT ON TABLE public.certificate_logs IS 'Log semua aktivitas dan perubahan status pada certificate';
COMMENT ON COLUMN public.certificate_logs.action IS 'Jenis aksi: created, sent, approved_v1, approved_v2, approved_assignor, rejected_v1, rejected_v2, rejected_assignor, updated, deleted';
COMMENT ON COLUMN public.certificate_logs.performed_by IS 'User ID yang melakukan aksi';
COMMENT ON COLUMN public.certificate_logs.performed_by_name IS 'Nama user untuk referensi cepat (denormalized)';
COMMENT ON COLUMN public.certificate_logs.notes IS 'Catatan umum dari action';
COMMENT ON COLUMN public.certificate_logs.rejection_reason IS 'Alasan penolakan jika action adalah rejected';
COMMENT ON COLUMN public.certificate_logs.approval_notes IS 'Catatan persetujuan';
COMMENT ON COLUMN public.certificate_logs.verification_level IS 'Level verifikasi: 1=verifikator_1, 2=verifikator_2, 3=assignor/authorized_by';
COMMENT ON COLUMN public.certificate_logs.previous_status IS 'Status certificate sebelum action';
COMMENT ON COLUMN public.certificate_logs.new_status IS 'Status certificate setelah action';
COMMENT ON COLUMN public.certificate_logs.metadata IS 'Data tambahan dalam format JSON (opsional)';

-- 10. Function untuk auto-fill performed_by_name (opsional, bisa digunakan di trigger)
CREATE OR REPLACE FUNCTION public.update_certificate_log_performed_by_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-fill performed_by_name dari personel table
  SELECT name INTO NEW.performed_by_name
  FROM public.personel
  WHERE id = NEW.performed_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger untuk auto-fill performed_by_name
CREATE TRIGGER trigger_update_certificate_log_performed_by_name
  BEFORE INSERT OR UPDATE ON public.certificate_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_certificate_log_performed_by_name();

