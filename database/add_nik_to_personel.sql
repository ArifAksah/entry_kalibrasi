-- Add NIK (Nomor Induk Kependudukan) column to personel table
-- This script adds a new column for National ID number (NIK) to the personel table

-- Add NIK column (nullable, varchar)
ALTER TABLE personel
ADD COLUMN IF NOT EXISTS nik VARCHAR(16);

-- Add comment to the column
COMMENT ON COLUMN personel.nik IS 'Nomor Induk Kependudukan (National ID Number)';

-- Optional: Create index for faster searches if needed
-- CREATE INDEX IF NOT EXISTS idx_personel_nik ON personel(nik);

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'personel' 
    AND column_name = 'nik';

