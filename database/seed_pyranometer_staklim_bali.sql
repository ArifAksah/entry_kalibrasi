-- ============================================================================
-- DATA PYRANOMETER — STASIUN KLIMATOLOGI BALI
-- Rujukan: workbook `pyranometer.xlsx` (order 079, Sert.FC-SR / 079.023 / XI / 2025)
--
-- Hasil pembandingan workbook vs master SIMKAL:
--   ▪ UUT  (instrument 102 ASRS Jembrana, station 854 = Stasiun Klimatologi Bali)
--       sensor 165 Pyranometer Global  : EKO MS-802, SN F22045R, 0-2000 W/m2, resolusi 0.1  ✔ sama
--       sensor 166 Pyranometer Diffuse : EKO MS-802, SN -       , 0-2000 W/m2, resolusi 0.1  ✔ sama
--       (workbook juga mencantumkan SENSITIVITAS 7.22 & 7.01 µV/Wm-2 — belum ada kolomnya di SIMKAL)
--   ▪ STANDAR (instrument 103 ASRS STD01, sensor 167)
--       Kipp&Zonen CMP3, SN 164097, resolusi 0.01, u95_general 2.1 %  ✔ sama
--       yang perlu diselaraskan: DRIFT (master 0 → workbook 3 % = ISO 9060 Class C,
--       lihat sheet Brief: Class C = 3 % untuk CMP3/SPLite2/QMS101/QMS102)
--   ▪ Tabel titik (setpoint/correction/u95) memang TIDAK dipakai pyranometer:
--     workbook memakai U95 standar FLAT = 2.1 % ("Sertifikat Standar, a = 2.1").
--
-- Acuan hasil (untuk verifikasi petugas saat kalibrasi Bali):
--   Global  : uc 2.025466278 %  · k 1.988609667 · U95 = 4.02786182 %
--   Diffuse : uc 2.025468869 %  · k 1.986978700 · U95 = 4.024563498 %
-- ============================================================================

BEGIN;

-- Cadangan nilai lama
DROP TABLE IF EXISTS public.pyranometer_bali_backup_2026;
CREATE TABLE public.pyranometer_bali_backup_2026 AS
SELECT id, instrument_id, name, serial_number, range_capacity_unit, resolution, is_standard
FROM public.sensor WHERE id IN (165, 166, 167);

DROP TABLE IF EXISTS public.cert_standard_bali_backup_2026;
CREATE TABLE public.cert_standard_bali_backup_2026 AS
SELECT * FROM public.certificate_standard WHERE sensor_id = 167;

-- ---------------------------------------------------------------------------
-- A. UUT — Stasiun Klimatologi Bali (instrument 102)
--    Nilai sensitivitas diambil dari workbook (sheet Input Data):
--      Pyranometer Global  = 7.22 µV/Wm-2
--      Pyranometer Diffuse = 7.01 µV/Wm-2
-- ---------------------------------------------------------------------------
UPDATE public.sensor SET
  sensitivity = 7.22               -- µV/Wm-2 (workbook: "Sensifitas")
WHERE id = 165 AND instrument_id = 102;

UPDATE public.sensor SET
  sensitivity = 7.01               -- µV/Wm-2 (workbook)
WHERE id = 166 AND instrument_id = 102;

UPDATE public.sensor SET
  range_capacity_unit = 'W/m^2'
WHERE id IN (165, 166) AND instrument_id = 102
  AND coalesce(nullif(trim(range_capacity_unit), ''), '') = '';

-- ---------------------------------------------------------------------------
-- B. STANDAR — ASRS STD01 (instrument 103, sensor 167)
--    Sensitivitas standar dari workbook: 12.5 µV/Wm-2 (Kipp&Zonen CMP3)
-- ---------------------------------------------------------------------------
UPDATE public.sensor SET
  sensitivity = 12.5,
  range_capacity_unit = 'W/m^2'
WHERE id = 167;

UPDATE public.certificate_standard SET
  drift         = 3.0,        -- ISO 9060 Class C (CMP3) — workbook sheet "Hit U"
  resolution    = 0.01,       -- W/m2
  u95_general   = 2.1,        -- % — U95 sertifikat standar (dipakai flat oleh pyranometer)
  range         = '0-2000'
WHERE sensor_id = 167;

COMMIT;

-- ===========================================================================
-- VERIFIKASI
-- ===========================================================================
-- SELECT i.id AS instrumen, i.name_alias, i.station_id, s.id AS sensor, s.name,
--        s.type, s.serial_number, s.range_capacity, s.range_capacity_unit,
--        s.resolution, s.is_standard
-- FROM public.sensor s JOIN public.instrument i ON i.id = s.instrument_id
-- WHERE i.id IN (102, 103) ORDER BY i.id, s.id;
--
-- SELECT id, sensor_id, no_certificate, drift, resolution, u95_general, range
-- FROM public.certificate_standard WHERE sensor_id = 167;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- UPDATE public.sensor s SET range_capacity_unit = b.range_capacity_unit
--   FROM public.pyranometer_bali_backup_2026 b WHERE s.id = b.id;
-- UPDATE public.certificate_standard c SET drift = b.drift, resolution = b.resolution,
--        u95_general = b.u95_general, range = b.range
--   FROM public.cert_standard_bali_backup_2026 b WHERE c.id = b.id;
