BEGIN;

-- ============================================================================
-- Menyatukan "graduating" ke "resolution"
--
-- Petugas kalibrasi menyatakan graduating = resolution, sehingga mulai sekarang
-- hanya "resolution" yang diisi di menu. Skrip ini memindahkan nilai lama agar
-- tidak ada data yang menggantung, sebelum field-nya benar-benar ditinggalkan.
--
-- 1) Nilai  : graduating -> resolution (hanya bila resolution kosong/0)
-- 2) Satuan : graduating_unit -> range_capacity_unit (hanya bila kosong)
-- Kolom graduating tetap ada (tidak dihapus) supaya aman.
-- ============================================================================

-- Cadangan nilai lama
DROP TABLE IF EXISTS public.sensor_graduating_backup;
CREATE TABLE public.sensor_graduating_backup AS
SELECT id, resolution, graduating, range_capacity_unit, graduating_unit
FROM public.sensor;

-- 1) Nilai graduating -> resolution
UPDATE public.sensor
SET resolution = regexp_replace(trim(graduating), ',', '.', 'g')::double precision
WHERE (resolution IS NULL OR resolution = 0)
  AND regexp_replace(trim(coalesce(graduating, '')), ',', '.', 'g') ~ '^[0-9]+(\.[0-9]+)?$';

-- 2) Satuan graduating_unit -> range_capacity_unit
UPDATE public.sensor
SET range_capacity_unit = trim(graduating_unit)
WHERE coalesce(nullif(trim(range_capacity_unit), ''), '') = ''
  AND coalesce(nullif(trim(graduating_unit), ''), '') <> '';

COMMIT;

-- ============================================================================
-- VERIFIKASI (jalankan setelah COMMIT)
-- ============================================================================
-- SELECT count(*) AS sisa_perlu_resolusi FROM public.sensor
--  WHERE coalesce(nullif(regexp_replace(trim(coalesce(graduating,'')), ',', '.', 'g'), ''), '') <> ''
--    AND (resolution IS NULL OR resolution = 0);

-- ROLLBACK (bila perlu):
-- UPDATE public.sensor s SET resolution = b.resolution,
--        range_capacity_unit = b.range_capacity_unit
--   FROM public.sensor_graduating_backup b WHERE s.id = b.id;
