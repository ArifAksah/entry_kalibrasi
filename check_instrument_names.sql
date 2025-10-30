-- Cek apakah ada instrument dengan name NULL atau kosong
SELECT 
  id,
  name,
  manufacturer,
  type,
  serial_number,
  CASE 
    WHEN name IS NULL THEN 'NULL'
    WHEN name = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE'
  END as name_status
FROM instrument
ORDER BY id DESC
LIMIT 20;

-- Count berapa banyak instrument dengan name NULL atau kosong
SELECT 
  COUNT(*) FILTER (WHERE name IS NULL) as null_count,
  COUNT(*) FILTER (WHERE name = '') as empty_count,
  COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') as has_value_count,
  COUNT(*) as total
FROM instrument;




