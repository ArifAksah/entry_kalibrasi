-- Fix auto-increment/default sequence for public.ref_unit.id.
-- Run this in Supabase SQL Editor if inserting Master Satuan fails with:
-- null value in column "id" of relation "ref_unit" violates not-null constraint

CREATE SEQUENCE IF NOT EXISTS public.ref_unit_id_seq;

SELECT setval(
  'public.ref_unit_id_seq',
  COALESCE((SELECT MAX(id) FROM public.ref_unit), 0) + 1,
  false
);

ALTER TABLE public.ref_unit
  ALTER COLUMN id SET DEFAULT nextval('public.ref_unit_id_seq'::regclass);

ALTER SEQUENCE public.ref_unit_id_seq
  OWNED BY public.ref_unit.id;
