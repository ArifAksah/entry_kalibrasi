-- ============================================================
-- Migrasi data Master CMC dari sheet "CMC" workbook BMKG 2026
--
-- Prasyarat:
--   Jalankan database/create_master_cmc.sql terlebih dahulu.
--
-- Script ini idempotent: aman dijalankan berulang. Profil dan nilai yang
-- sudah ada akan diperbarui, bukan diduplikasi.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cmc_values_profile_sequence_key'
  ) THEN
    ALTER TABLE public.cmc_values
      ADD CONSTRAINT cmc_values_profile_sequence_key
      UNIQUE (cmc_profile_id, sequence);
  END IF;
END $$;

WITH source_profiles (
  code, name, parameter_code, calibration_method, source_document,
  version, effective_from, is_active
) AS (
  VALUES
    ('CMC-TT-DIGITAL', 'Termometer Digital', 'TT', 'MK 01 - Suhu', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-TT-UDARA', 'Termometer Udara', 'TT', 'MK 01 - Suhu', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-TT-ANALOG', 'Termometer Analog', 'TT', 'MK 01 - Suhu', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-TT-GELAS', 'Termometer Gelas', 'TT', 'MK 01 - Suhu', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-RH-DIGITAL', 'Hygrometer Digital', 'RH', 'MK 03 - Kelembapan Udara Relatif', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-PP-DIGITAL', 'Barometer Digital', 'PP', 'MK 02 - Tekanan Udara', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-WS', 'Kecepatan Angin', 'WS', 'MK 04 - Anemometer (Kecepatan Angin)', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-WD', 'Arah Angin', 'WD', 'MK 05 - Anemometer (Arah Angin)', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-RR-ANALOG', 'Penakar Hujan Analog', 'RR', 'MK 06 - Penakar Hujan', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-RR-DIGITAL', 'Penakar Hujan Digital', 'RR', 'MK 06 - Penakar Hujan', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-SR', 'Pyranometer', 'SR', '-', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true),
    ('CMC-WL', 'Water Level', 'WL', '-', 'Workbook CMC BMKG 2026', 1, DATE '2026-01-01', true)
)
INSERT INTO public.cmc_profiles (
  code, name, parameter_code, calibration_method, source_document,
  version, effective_from, is_active
)
SELECT * FROM source_profiles
ON CONFLICT (code, version) DO UPDATE SET
  name = EXCLUDED.name,
  parameter_code = EXCLUDED.parameter_code,
  calibration_method = EXCLUDED.calibration_method,
  source_document = EXCLUDED.source_document,
  effective_from = EXCLUDED.effective_from,
  effective_until = NULL,
  is_active = EXCLUDED.is_active,
  updated_at = now();

WITH source_values (
  code, range_min, range_max, cmc_value, unit, sequence
) AS (
  VALUES
    ('CMC-TT-DIGITAL', 0::numeric, 50::numeric, 0.01::numeric, '°C', 1),
    ('CMC-TT-UDARA', 0, 50, 0.3, '°C', 1),
    ('CMC-TT-ANALOG', 0, 50, 0.071, '°C', 1),
    ('CMC-TT-GELAS', 0, 50, 0.071, '°C', 1),
    ('CMC-RH-DIGITAL', 15, 95, 1.1, '%RH', 1),
    ('CMC-PP-DIGITAL', 700, 1100, 0.026, 'hPa', 1),
    ('CMC-WS', 0.4, 25, 0.48, 'm/s', 1),
    ('CMC-WD', 0, 360, 1, '°', 1),
    ('CMC-RR-ANALOG', 0, 25, 0.29, 'mm', 1),
    ('CMC-RR-DIGITAL', 0, 2.5, 0.19, 'mm', 1)
)
INSERT INTO public.cmc_values (
  cmc_profile_id, range_min, range_max, cmc_value, unit, sequence
)
SELECT
  profile.id,
  value.range_min,
  value.range_max,
  value.cmc_value,
  value.unit,
  value.sequence
FROM source_values value
JOIN public.cmc_profiles profile
  ON profile.code = value.code AND profile.version = 1
ON CONFLICT (cmc_profile_id, sequence) DO UPDATE SET
  range_min = EXCLUDED.range_min,
  range_max = EXCLUDED.range_max,
  cmc_value = EXCLUDED.cmc_value,
  unit = EXCLUDED.unit;

-- Verifikasi hasil migrasi. Target: 12 profil, 10 nilai CMC.
SELECT
  profile.code,
  profile.name,
  profile.parameter_code,
  profile.calibration_method,
  profile.version,
  profile.is_active,
  value.range_min,
  value.range_max,
  value.cmc_value,
  value.unit
FROM public.cmc_profiles profile
LEFT JOIN public.cmc_values value ON value.cmc_profile_id = profile.id
WHERE profile.source_document = 'Workbook CMC BMKG 2026'
ORDER BY profile.parameter_code, profile.code, value.sequence;
