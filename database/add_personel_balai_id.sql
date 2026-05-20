-- Migration: Add balai_id to personel table
-- Purpose: Associate personel with a specific Balai for auto-suggest penandatangan
-- Run this in Supabase SQL Editor

-- Add balai_id column (1-5, NULL means BMKG Pusat)
ALTER TABLE personel ADD COLUMN IF NOT EXISTS balai_id INTEGER NULL;

-- Add CHECK constraint
ALTER TABLE personel ADD CONSTRAINT chk_personel_balai_id
  CHECK (balai_id IS NULL OR (balai_id >= 1 AND balai_id <= 5));

-- Add signer_title column for the official title shown on certificates
ALTER TABLE personel ADD COLUMN IF NOT EXISTS signer_title VARCHAR NULL;

COMMENT ON COLUMN personel.balai_id IS 'Balai/UPT assignment (1-5). NULL means BMKG pusat.';
COMMENT ON COLUMN personel.signer_title IS 'Official title for certificate signing (e.g., "Kepala Balai Besar MKG Wilayah IV", "Direktur Instrumentasi dan Kalibrasi")';

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================
-- ALTER TABLE personel DROP CONSTRAINT IF EXISTS chk_personel_balai_id;
-- ALTER TABLE personel DROP COLUMN IF EXISTS signer_title;
-- ALTER TABLE personel DROP COLUMN IF EXISTS balai_id;
-- ============================================================
