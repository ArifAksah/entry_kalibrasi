-- Link Certificate to Calibration Session
-- Corrected table name: calibration_session (singular)
ALTER TABLE public.certificate
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.calibration_session(id) ON DELETE SET NULL;
