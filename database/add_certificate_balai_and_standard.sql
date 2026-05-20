-- Migration: Add balai_id and is_standard columns to certificate table
-- Purpose: Support flexible certificate types (Balai variants and Standard certificates)
-- Run this in Supabase SQL Editor

-- Add balai_id column (1-5, references which Balai/UPT issues the certificate)
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS balai_id INTEGER NULL;

-- Add is_standard column (marks standard calibration certificates)
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS is_standard BOOLEAN DEFAULT FALSE;

-- Add CHECK constraint to ensure balai_id is between 1 and 5 when not null
ALTER TABLE certificate ADD CONSTRAINT chk_certificate_balai_id
  CHECK (balai_id IS NULL OR (balai_id >= 1 AND balai_id <= 5));

-- Add comments for documentation
COMMENT ON COLUMN certificate.balai_id IS 'Balai/UPT identifier (1-5). NULL means BMKG pusat. 1=Wilayah I (Medan), 2=Wilayah II (Tangerang Selatan), 3=Wilayah III (Denpasar), 4=Wilayah IV (Makassar), 5=Wilayah V (Jayapura).';
COMMENT ON COLUMN certificate.is_standard IS 'When TRUE, this certificate uses the Standard calibration template regardless of calibration_place or balai_id.';

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================
-- To rollback this migration, run the following SQL:
--
-- ALTER TABLE certificate DROP CONSTRAINT IF EXISTS chk_certificate_balai_id;
-- ALTER TABLE certificate DROP COLUMN IF EXISTS is_standard;
-- ALTER TABLE certificate DROP COLUMN IF EXISTS balai_id;
-- ============================================================
