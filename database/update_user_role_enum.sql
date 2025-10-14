-- Ensure all required roles exist in the user_role enum
-- Run this in Supabase SQL editor if not applied automatically

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'calibrator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'verifikator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assignor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user_station';


