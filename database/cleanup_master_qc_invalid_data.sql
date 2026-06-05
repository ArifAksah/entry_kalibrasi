-- Cleanup invalid data in master_qc table
-- Remove records that reference non-existent instrument_names

-- First, check which records are invalid
SELECT 
    mq.id,
    mq.instrument_name_id,
    mq.nilai_batas_koreksi,
    mq.catatan
FROM master_qc mq
LEFT JOIN instrument_names ins ON mq.instrument_name_id = ins.id
WHERE ins.id IS NULL;

-- Delete invalid records (uncomment to execute)
-- DELETE FROM master_qc
-- WHERE instrument_name_id NOT IN (SELECT id FROM instrument_names);

-- Verify all records are now valid
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT instrument_name_id) as unique_instruments
FROM master_qc;

-- Made with Bob
