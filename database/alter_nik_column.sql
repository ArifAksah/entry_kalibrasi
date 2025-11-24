-- Alter nik column to support long encrypted strings
ALTER TABLE personel ALTER COLUMN nik TYPE TEXT;

-- Ensure nik_index is also text (it should be from previous migration, but good to be safe)
ALTER TABLE personel ALTER COLUMN nik_index TYPE TEXT;
