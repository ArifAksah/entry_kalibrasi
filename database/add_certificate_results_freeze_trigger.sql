-- ============================================================================
-- B.2b - Freeze results saat kirim ke verifikator + block mutation setelah freeze
-- ----------------------------------------------------------------------------
-- Tujuan:
--   1. Mengisi certificate.results_frozen_at otomatis saat row keluar dari draft
--      / pertama kali dikirim ke verifikator.
--   2. Menolak perubahan certificate.results setelah hasil dibekukan.
-- ----------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.certificate_enforce_results_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Freeze: set results_frozen_at saat pertama kali keluar dari draft.
  IF OLD.results_frozen_at IS NULL
     AND NEW.results_frozen_at IS NULL
     AND OLD.sent_to_verifiers_at IS NULL
     AND NEW.sent_to_verifiers_at IS NOT NULL THEN
    NEW.results_frozen_at := NEW.sent_to_verifiers_at;
  ELSIF OLD.results_frozen_at IS NULL
     AND NEW.results_frozen_at IS NULL
     AND COALESCE(OLD.status, 'draft') = 'draft'
     AND COALESCE(NEW.status, 'draft') <> 'draft' THEN
    NEW.results_frozen_at := NOW();
  END IF;

  -- Unfreeze: saat rejection mengembalikan status ke 'draft',
  -- biarkan sertifikat bisa diedit ulang.
  IF OLD.results_frozen_at IS NOT NULL
     AND NEW.results_frozen_at IS NOT DISTINCT FROM OLD.results_frozen_at
     AND COALESCE(OLD.status, 'draft') <> 'draft'
     AND COALESCE(NEW.status, 'draft') = 'draft' THEN
    NEW.results_frozen_at := NULL;
  END IF;

  -- Block mutation results saat masih frozen (belum di-unfreeze oleh rejection).
  IF NEW.results_frozen_at IS NOT NULL
     AND NEW.results IS DISTINCT FROM OLD.results THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'certificate.results is frozen and cannot be changed',
      DETAIL = format(
        'certificate.id=%s results_frozen_at=%s',
        COALESCE(NEW.id, OLD.id),
        NEW.results_frozen_at
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificate_enforce_results_freeze ON public.certificate;

CREATE TRIGGER trg_certificate_enforce_results_freeze
BEFORE UPDATE ON public.certificate
FOR EACH ROW
EXECUTE FUNCTION public.certificate_enforce_results_freeze();

COMMIT;
