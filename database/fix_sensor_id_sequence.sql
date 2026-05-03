-- Fix auto-increment/default sequence for public.sensor.id.
-- Run this in Supabase SQL Editor if adding instrument sensors fails with:
-- null value in column "id" of relation "sensor" violates not-null constraint

CREATE SEQUENCE IF NOT EXISTS public.sensor_id_seq;

SELECT setval(
  'public.sensor_id_seq',
  COALESCE((SELECT MAX(id) FROM public.sensor), 0) + 1,
  false
);

ALTER TABLE public.sensor
  ALTER COLUMN id SET DEFAULT nextval('public.sensor_id_seq'::regclass);

ALTER SEQUENCE public.sensor_id_seq
  OWNED BY public.sensor.id;
