-- Fix relationship between personel and user_roles tables
-- This script creates the proper foreign key relationship

-- First, let's ensure the user_roles table has the correct structure
-- The user_id should reference the personel.id field

-- Check if foreign key constraint already exists, if not create it
DO $$ 
BEGIN
  -- Add foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_user_id_fkey' 
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles 
    ADD CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES personel(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better performance on joins
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Ensure personel table has proper structure (if needed)
-- Add any missing columns that might be referenced
DO $$ 
BEGIN
  -- Check if created_at column exists in personel table, add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'personel' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE personel ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Check if updated_at column exists, add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'personel' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE personel ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply trigger to personel table
DROP TRIGGER IF EXISTS update_personel_updated_at ON personel;
CREATE TRIGGER update_personel_updated_at
    BEFORE UPDATE ON personel
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Apply trigger to user_roles table (if it has updated_at column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
    CREATE TRIGGER update_user_roles_updated_at
        BEFORE UPDATE ON user_roles
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- Verify the relationship is working
-- This query should work without errors after running the above
SELECT 
  p.id,
  p.name,
  p.email,
  ur.role
FROM personel p
LEFT JOIN user_roles ur ON p.id = ur.user_id
LIMIT 5;