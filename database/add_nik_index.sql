-- Add nik_index column for blind indexing
ALTER TABLE personel ADD COLUMN IF NOT EXISTS nik_index TEXT;

-- Create an index on the new column for faster searching
CREATE INDEX IF NOT EXISTS idx_personel_nik_index ON personel(nik_index);

-- Comment on columns
COMMENT ON COLUMN personel.nik IS 'Encrypted NIK (AES)';
COMMENT ON COLUMN personel.nik_index IS 'Hashed NIK (HMAC-SHA256) for searching';
