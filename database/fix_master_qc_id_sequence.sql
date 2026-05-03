-- Fix auto-increment/default sequence for public.master_qc.id.
-- Run this in Supabase SQL Editor if saving Master QC fails with:
-- duplicate key value violates unique constraint "master_qc_pkey"

CREATE SEQUENCE IF NOT EXISTS public.master_qc_id_seq;

SELECT setval(
  'public.master_qc_id_seq',
  COALESCE((SELECT MAX(id) FROM public.master_qc), 0) + 1,
  false
);

ALTER TABLE public.master_qc
  ALTER COLUMN id SET DEFAULT nextval('public.master_qc_id_seq'::regclass);

ALTER SEQUENCE public.master_qc_id_seq
  OWNED BY public.master_qc.id;
