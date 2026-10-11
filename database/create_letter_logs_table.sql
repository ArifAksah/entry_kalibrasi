-- =====================================================
-- Letter Logs — mirror dari certificate_logs untuk Surat Keterangan
-- =====================================================

CREATE TABLE IF NOT EXISTS public.letter_logs (
  id SERIAL PRIMARY KEY,
  letter_id BIGINT NOT NULL REFERENCES public.letter(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  notes TEXT,
  rejection_reason TEXT,
  approval_notes TEXT,
  verification_level INTEGER,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_letter_logs_letter_id ON public.letter_logs(letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_logs_performed_by ON public.letter_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_letter_logs_action ON public.letter_logs(action);
CREATE INDEX IF NOT EXISTS idx_letter_logs_created_at ON public.letter_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letter_logs_letter_action ON public.letter_logs(letter_id, action);

ALTER TABLE public.letter_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_letter_logs ON public.letter_logs;
CREATE POLICY admin_all_letter_logs ON public.letter_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

DROP POLICY IF EXISTS assignor_all_letter_logs ON public.letter_logs;
CREATE POLICY assignor_all_letter_logs ON public.letter_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'assignor'));

DROP POLICY IF EXISTS calibrator_all_letter_logs ON public.letter_logs;
CREATE POLICY calibrator_all_letter_logs ON public.letter_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'calibrator'));

DROP POLICY IF EXISTS verifikator_select_letter_logs ON public.letter_logs;
CREATE POLICY verifikator_select_letter_logs ON public.letter_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'verifikator'));

DROP POLICY IF EXISTS verifikator_insert_letter_logs ON public.letter_logs;
CREATE POLICY verifikator_insert_letter_logs ON public.letter_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'verifikator')
    AND EXISTS (
      SELECT 1 FROM public.letter l
      WHERE l.id = letter_logs.letter_id
        AND (l.verifikator_1 = auth.uid() OR l.verifikator_2 = auth.uid() OR l.verifikator_3 = auth.uid() OR l.authorized_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS user_station_select_letter_logs ON public.letter_logs;
CREATE POLICY user_station_select_letter_logs ON public.letter_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.letter l ON l.owner = (
        SELECT station_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'user_station' LIMIT 1
      )
      WHERE ur.user_id = auth.uid() AND ur.role = 'user_station' AND l.id = letter_logs.letter_id
    )
  );

COMMENT ON TABLE public.letter_logs IS 'Log semua aktivitas dan perubahan status pada Surat Keterangan';
COMMENT ON COLUMN public.letter_logs.action IS 'created, sent, approved_v1, approved_v2, approved_v3, rejected_v1, rejected_v2, rejected_v3, signed, updated, deleted';

-- Auto-fill performed_by_name dari personel
CREATE OR REPLACE FUNCTION public.update_letter_log_performed_by_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT name INTO NEW.performed_by_name FROM public.personel WHERE id = NEW.performed_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_letter_log_performed_by_name ON public.letter_logs;
CREATE TRIGGER trigger_update_letter_log_performed_by_name
  BEFORE INSERT OR UPDATE ON public.letter_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_letter_log_performed_by_name();
