BEGIN;

-- ============================================================================
-- Perbaiki PRESISI master sertifikat standar "AWS 10"
-- (Vaisala MAWS201 / N4535059, sertifikat: Sert.LC- AWS / 060 / DIK / I / 2026)
--
-- Alasan: nilai yang tersimpan sekarang dibulatkan saat input
--   u95_std       : 3 desimal  (mis. 0.028)
--   correction_std: 4 desimal  (mis. -0.1258)
--   setpoint      : 2 desimal  (mis. 800.21)
-- Nilai presisi penuh diambil dari workbook F.M.2026.037.001 AWOS 30.xlsx,
-- sheet DBSTD (kolom UUT reading / Koreksi / U95 untuk tiap sensor AWS 10).
--
-- Kolomnya bertipe json (tanpa batas desimal), jadi tidak perlu ubah skema.
-- ============================================================================

-- 0) CADANGAN nilai lama, supaya bisa dikembalikan bila ada masalah.
DROP TABLE IF EXISTS public.cert_standard_precision_backup_aws10;
CREATE TABLE public.cert_standard_precision_backup_aws10 AS
SELECT id, sensor_id, no_certificate, setpoint, correction_std, u95_std, drift
FROM public.certificate_standard
WHERE sensor_id IN (147, 148, 149, 150, 151, 152)
  AND no_certificate ILIKE '%AWS%060%';

-- 1) PP — Barometer (sensor 150). drift sudah benar (0.142733477).
UPDATE public.certificate_standard SET
  setpoint = '["700.21","750.21","800.205","850.2175","900.2225","950.2175","1000.2275","1050.1675","1099.9775"]'::json,
  correction_std = '["-0.118989079","-0.113248065","-0.10699804","-0.11899803","-0.12549806","-0.12325377","-0.125256135","-0.132755174","-0.142733477"]'::json,
  u95_std = '["0.029534209","0.029541665","0.026802176","0.027688798","0.027918955","0.02837801","0.02753861","0.033636518","0.026141263"]'::json
WHERE id = 108 AND sensor_id = 150;

-- 2) TT (Sensor Suhu) — sensor 148. Sekalian perbaiki drift yang terbulat (0.108).
UPDATE public.certificate_standard SET
  drift = 0.107834729,
  setpoint = '["0.32","10.264","20.234","30.168","40.172"]'::json,
  correction_std = '["-0.006256004","0.016127244","0.061403154","0.089433039","0.107834729"]'::json,
  u95_std = '["0.165426342","0.165084849","0.165045634","0.165095854","0.165060939"]'::json
WHERE id = 106 AND sensor_id = 148;

-- 3) TT WT (Sensor Suhu Air) — sensor 147
UPDATE public.certificate_standard SET
  setpoint = '["0.39","10.208","20.12","30.02","40.086"]'::json,
  correction_std = '["-0.054660026","-0.062725827","-0.072647683","-0.082","-0.083820227"]'::json,
  u95_std = '["0.013938558","0.014285379","0.013924582","0.013902814","0.014610692"]'::json
WHERE id = 105 AND sensor_id = 147;

-- 4) RH (Sensor Kelembapan) — sensor 149
UPDATE public.certificate_standard SET
  setpoint = '["15.436","19.766","29.834","39.86","49.858","59.792","69.838","79.796","89.622","92.82"]'::json,
  correction_std = '["-0.360171171","-0.29781","-0.226488","-0.10088","0.083864","0.33985","0.74772","1.22024","1.889364706","2.150435294"]'::json,
  u95_std = '["1.1","1.1","1.1","1.1","1.1","1.1","1.1","1.1","1.1","1.1"]'::json
WHERE id = 107 AND sensor_id = 149;

-- 5) WS (Sensor Kecepatan Angin) — sensor 151
UPDATE public.certificate_standard SET
  setpoint = '["0.6","1.6","5.225","7.1","10.8","14.8","20.375"]'::json,
  correction_std = '["0.385","0.3865","0.3275","0.25975","0.02775","0.0825","-0.046"]'::json,
  u95_std = '["0.48","0.48","0.48","0.48","0.48","0.48","0.48"]'::json
WHERE id = 109 AND sensor_id = 151;

-- 6) WD (Sensor Arah Angin) — sensor 152
UPDATE public.certificate_standard SET
  setpoint = '["0","90","179","270"]'::json,
  correction_std = '["0","-0.2","0.7","-0.4"]'::json,
  u95_std = '["1.01324561","1.01324561","1.01324561","1.01324561"]'::json
WHERE id = 110 AND sensor_id = 152;

COMMIT;

-- ============================================================================
-- VERIFIKASI (jalankan setelah COMMIT)
-- ============================================================================
-- SELECT cs.id, s.name, cs.setpoint, cs.correction_std, cs.u95_std
-- FROM public.certificate_standard cs
-- LEFT JOIN public.sensor s ON s.id = cs.sensor_id
-- WHERE cs.sensor_id IN (147,148,149,150,151,152) AND cs.no_certificate ILIKE '%AWS%060%'
-- ORDER BY cs.id;

-- ============================================================================
-- ROLLBACK (bila ingin mengembalikan nilai lama)
-- ============================================================================
-- UPDATE public.certificate_standard c
--    SET setpoint = b.setpoint,
--        correction_std = b.correction_std,
--        u95_std = b.u95_std,
--        drift = b.drift
--   FROM public.cert_standard_precision_backup_aws10 b
--  WHERE c.id = b.id;
