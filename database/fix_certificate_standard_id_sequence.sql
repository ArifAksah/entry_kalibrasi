-- Fix auto-increment/default sequence for public.certificate_standard.id.
-- Run this in Supabase SQL Editor if saving a standard certificate fails with:
-- null value in column "id" of relation "certificate_standard" violates not-null constraint

CREATE SEQUENCE IF NOT EXISTS public.certificate_standard_id_seq;

SELECT setval(
  'public.certificate_standard_id_seq',
  COALESCE((SELECT MAX(id) FROM public.certificate_standard), 0) + 1,
  false
);

ALTER TABLE public.certificate_standard
  ALTER COLUMN id SET DEFAULT nextval('public.certificate_standard_id_seq'::regclass);

ALTER SEQUENCE public.certificate_standard_id_seq
  OWNED BY public.certificate_standard.id;
