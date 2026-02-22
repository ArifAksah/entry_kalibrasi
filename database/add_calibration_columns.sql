-- Add calculated columns to raw_data table
ALTER TABLE public.raw_data
ADD COLUMN IF NOT EXISTS std_correction DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS std_corrected DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS uut_correction DOUBLE PRECISION;
