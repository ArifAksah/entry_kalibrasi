-- Add station_address column to certificate table
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS station_address TEXT;

-- Optional: index if used frequently in searches (commented out by default)
-- CREATE INDEX IF NOT EXISTS idx_certificate_station_address ON certificate(station_address);


