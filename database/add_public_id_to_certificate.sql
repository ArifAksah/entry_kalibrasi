-- Add public_id column to certificate table for secure public access
-- Using gen_random_uuid() to automatically generate unique IDs for existing and new rows

ALTER TABLE public.certificate 
ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add unique constraint to ensure no duplicates
ALTER TABLE public.certificate 
ADD CONSTRAINT certificate_public_id_key UNIQUE (public_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_certificate_public_id ON public.certificate(public_id);
