-- Ensure certificate_verification.id auto-increments in environments
-- where the column exists but its sequence/default was not attached.

CREATE SEQUENCE IF NOT EXISTS public.certificate_verification_id_seq;

ALTER SEQUENCE public.certificate_verification_id_seq
OWNED BY public.certificate_verification.id;

ALTER TABLE public.certificate_verification
ALTER COLUMN id SET DEFAULT nextval('public.certificate_verification_id_seq'::regclass);

SELECT setval(
  'public.certificate_verification_id_seq',
  COALESCE((SELECT MAX(id) FROM public.certificate_verification), 1),
  (SELECT COUNT(*) > 0 FROM public.certificate_verification)
);

GRANT USAGE, SELECT ON SEQUENCE public.certificate_verification_id_seq TO authenticated;
