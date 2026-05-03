-- Fix auto-increment/default sequence for public.instrument.id.
-- Run this in Supabase SQL Editor if adding an instrument fails with:
-- null value in column "id" of relation "instrument" violates not-null constraint

CREATE SEQUENCE IF NOT EXISTS public.instrument_id_seq;

SELECT setval(
  'public.instrument_id_seq',
  COALESCE((SELECT MAX(id) FROM public.instrument), 0) + 1,
  false
);

ALTER TABLE public.instrument
  ALTER COLUMN id SET DEFAULT nextval('public.instrument_id_seq'::regclass);

ALTER SEQUENCE public.instrument_id_seq
  OWNED BY public.instrument.id;
