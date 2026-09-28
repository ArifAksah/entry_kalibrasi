-- ============================================================================
-- Deduplikasi stasiun berdasarkan WMO (station.station_id) + unique index
-- ============================================================================
--
-- Latar belakang:
--   Tabel `station` tidak memiliki unique constraint pada `station_id`.
--   Import berulang dan input manual menghasilkan banyak row dengan WMO yang
--   sama namun nama berbeda (contoh: 96013 Aceh Besar).
--
-- Catatan penting:
--   Merge data sudah dijalankan lewat scripts/merge-duplicate-stations.mjs.
--   File ini adalah langkah FINAL: memasang unique index agar duplikasi tidak
--   terulang. HANYA jalankan setelah memastikan tidak ada lagi duplikat.
--
-- Pemakaian (setelah merge selesai):
--   psql "$DATABASE_URL" -f database/dedupe_station_wmo_and_unique.sql
--
-- Idempotent: aman dijalankan berulang.
-- ============================================================================

BEGIN;

-- 1. Cek duplikat tersisa. Bila ada, transaksi digagalkan agar aman.
DO $$
DECLARE
  dup_count integer;
  sample text;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT btrim(station_id) AS sid
    FROM public.station
    WHERE station_id IS NOT NULL AND btrim(station_id) <> ''
    GROUP BY btrim(station_id)
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    SELECT string_agg(sid || ' (' || cnt || 'x)', ', ' ORDER BY cnt DESC)
      INTO sample
    FROM (
      SELECT btrim(station_id) AS sid, count(*) AS cnt
      FROM public.station
      WHERE station_id IS NOT NULL AND btrim(station_id) <> ''
      GROUP BY btrim(station_id)
      HAVING count(*) > 1
      LIMIT 10
    ) s;

    RAISE EXCEPTION
      'Masih ada % grup WMO duplikat: %. Jalankan scripts/merge-duplicate-stations.mjs --apply terlebih dahulu.',
      dup_count, sample;
  END IF;
END $$;

-- 2. Normalisasi nilai station_id agar konsisten (trim).
UPDATE public.station
SET station_id = btrim(station_id)
WHERE station_id IS NOT NULL AND station_id <> btrim(station_id);

-- 3. Ubah string kosong menjadi NULL agar index parsial bekerja.
UPDATE public.station
SET station_id = NULL
WHERE station_id IS NOT NULL AND btrim(station_id) = '';

-- 4. Unique index parsial pada station_id (WMO).
DROP INDEX IF EXISTS public.station_station_id_unique;
CREATE UNIQUE INDEX station_station_id_unique
  ON public.station (btrim(station_id))
  WHERE station_id IS NOT NULL AND btrim(station_id) <> '';

COMMIT;

-- Verifikasi
-- SELECT btrim(station_id) AS wmo, count(*)
-- FROM public.station
-- WHERE station_id IS NOT NULL
-- GROUP BY 1 HAVING count(*) > 1;
