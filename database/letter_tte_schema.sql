BEGIN;

ALTER TABLE public.letter
  ADD COLUMN IF NOT EXISTS public_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_verifiers_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS results_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_data jsonb,
  ADD COLUMN IF NOT EXISTS timestamp_data jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rejection_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_status varchar(20) NOT NULL DEFAULT 'none';

UPDATE public.letter SET public_id = gen_random_uuid() WHERE public_id IS NULL;
ALTER TABLE public.letter ALTER COLUMN public_id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS letter_public_id_key ON public.letter (public_id);
CREATE INDEX IF NOT EXISTS idx_letter_public_id ON public.letter (public_id);

CREATE TABLE IF NOT EXISTS public.letter_verification (
  id serial PRIMARY KEY,
  letter_id bigint NOT NULL REFERENCES public.letter(id) ON DELETE CASCADE,
  verification_level integer NOT NULL CHECK (verification_level IN (1, 2, 3, 4)),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  verified_by uuid NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  letter_version integer NOT NULL DEFAULT 1,
  signature_data jsonb,
  timestamp_data jsonb,
  signed_at timestamptz,
  rejection_reason text,
  rejection_reason_detailed text,
  rejection_destination varchar(20) CHECK (rejection_destination IN ('creator', 'verifikator_1')),
  rejection_timestamp timestamptz,
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (letter_id, verification_level, letter_version)
);

CREATE INDEX IF NOT EXISTS idx_letter_verification_letter_id ON public.letter_verification (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_verification_verified_by ON public.letter_verification (verified_by);
CREATE INDEX IF NOT EXISTS idx_letter_verification_level ON public.letter_verification (verification_level);
CREATE INDEX IF NOT EXISTS idx_letter_verification_status ON public.letter_verification (status);

CREATE OR REPLACE FUNCTION public.update_letter_verification_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trigger_update_letter_verification_updated_at ON public.letter_verification;
CREATE TRIGGER trigger_update_letter_verification_updated_at
  BEFORE UPDATE ON public.letter_verification
  FOR EACH ROW EXECUTE FUNCTION public.update_letter_verification_updated_at();

CREATE OR REPLACE FUNCTION public.letter_enforce_results_freeze()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.results_frozen_at IS NULL
     AND NEW.results_frozen_at IS NULL
     AND OLD.sent_to_verifiers_at IS NULL
     AND NEW.sent_to_verifiers_at IS NOT NULL THEN
    NEW.results_frozen_at := NEW.sent_to_verifiers_at;
  ELSIF OLD.results_frozen_at IS NULL
     AND NEW.results_frozen_at IS NULL
     AND COALESCE(OLD.status, 'draft') = 'draft'
     AND COALESCE(NEW.status, 'draft') <> 'draft' THEN
    NEW.results_frozen_at := now();
  END IF;

  IF OLD.results_frozen_at IS NOT NULL
     AND NEW.results_frozen_at IS NOT DISTINCT FROM OLD.results_frozen_at
     AND COALESCE(OLD.status, 'draft') <> 'draft'
     AND COALESCE(NEW.status, 'draft') = 'draft' THEN
    NEW.results_frozen_at := NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_letter_enforce_results_freeze ON public.letter;
CREATE TRIGGER trg_letter_enforce_results_freeze
  BEFORE UPDATE ON public.letter
  FOR EACH ROW EXECUTE FUNCTION public.letter_enforce_results_freeze();

CREATE OR REPLACE FUNCTION public.letter_inspection_results_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  v_letter_id bigint := COALESCE(NEW.letter_id, OLD.letter_id);
  v_frozen timestamptz;
BEGIN
  SELECT results_frozen_at INTO v_frozen FROM public.letter WHERE id = v_letter_id;
  IF v_frozen IS NOT NULL THEN
    RAISE EXCEPTION 'Hasil pemeriksaan Surat Keterangan sudah dibekukan dan tidak dapat diubah';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_letter_inspection_results_guard ON public.letter_inspection_results;
CREATE TRIGGER trg_letter_inspection_results_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.letter_inspection_results
  FOR EACH ROW EXECUTE FUNCTION public.letter_inspection_results_guard();

ALTER TABLE public.letter_verification ENABLE ROW LEVEL SECURITY;

COMMIT;
