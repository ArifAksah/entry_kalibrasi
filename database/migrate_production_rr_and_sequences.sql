-- ============================================================================
-- MIGRASI PRODUCTION — jalankan di Supabase production (SQL Editor / psql)
-- ----------------------------------------------------------------------------
-- Tujuan: menyiapkan database production agar kompatibel dengan kode terbaru:
--   1) kolom `sensor.parameter_code` (klasifikasi peran standar VL/LN untuk fitur
--      Tipping Bucket / RR);
--   2) profil CMC `VL` (Volume) dan `LN` (Panjang) di Master CMC;
--   3) default `nextval` + sinkronisasi sequence untuk kolom `id` yang belum
--      memilikinya (memperbaiki INSERT yang gagal: "null value in column id").
--
-- Sifat: IDEMPOTEN. Aman dijalankan berkali-kali.
-- Catatan: tidak menghapus/mengubah data existing.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Kolom klasifikasi peran pada sensor. Menunjuk kosakata Master CMC.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sensor
  ADD COLUMN IF NOT EXISTS parameter_code varchar(20);

COMMENT ON COLUMN public.sensor.parameter_code IS
  'Kuantitas yang diukur sensor (kosakata Master CMC: TT, RH, PP, WS, WD, RR, SR, WL, VL, LN).';

-- ---------------------------------------------------------------------------
-- 2) Profil CMC Volume (VL) dan Panjang (LN) untuk standar RR.
-- ---------------------------------------------------------------------------
INSERT INTO public.cmc_profiles
  (code, name, parameter_code, calibration_method, source_document, version, effective_from, is_active)
VALUES
  ('CMC-VL', 'Standar Volume (Gelas Ukur)', 'VL', 'MK 06 - Penakar Hujan', 'Workbook CMC BMKG 2026', 1, '2026-01-01', true),
  ('CMC-LN', 'Standar Panjang (Jangka Sorong)', 'LN', 'MK 06 - Penakar Hujan', 'Workbook CMC BMKG 2026', 1, '2026-01-01', true)
ON CONFLICT (code, version) DO UPDATE SET
  name = EXCLUDED.name,
  parameter_code = EXCLUDED.parameter_code,
  source_document = EXCLUDED.source_document,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.cmc_values (cmc_profile_id, range_min, range_max, cmc_value, unit, sequence)
SELECT p.id, seed.range_min, seed.range_max, seed.cmc_value, seed.unit, 1
FROM (VALUES
  ('CMC-VL', 0::numeric, 250::numeric, 0.2::numeric, 'ml'),
  ('CMC-LN', 0, 250, 0.0018, 'mm')
) AS seed(code, range_min, range_max, cmc_value, unit)
JOIN public.cmc_profiles p ON p.code = seed.code AND p.version = 1
ON CONFLICT (cmc_profile_id, sequence) DO UPDATE SET
  range_min = EXCLUDED.range_min,
  range_max = EXCLUDED.range_max,
  cmc_value = EXCLUDED.cmc_value,
  unit = EXCLUDED.unit;

-- ---------------------------------------------------------------------------
-- 3) Default `nextval` + sinkronisasi sequence untuk kolom `id`.
--    Production saat ini tidak memiliki DEFAULT pada banyak kolom `id`,
--    sehingga INSERT tanpa `id` eksplisit gagal: "null value in column id".
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_max bigint;
  v_seq text;
BEGIN
  FOR r IN
    SELECT c.table_name AS tbl
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'id'
      AND c.is_identity = 'NO'
      AND EXISTS (
        SELECT 1 FROM pg_class s
        JOIN pg_namespace n ON n.oid = s.relnamespace
        WHERE s.relkind = 'S'
          AND n.nspname = 'public'
          AND s.relname = c.table_name || '_id_seq'
      )
    ORDER BY c.table_name
  LOOP
    v_seq := format('public.%I_id_seq', r.tbl);

    -- Pasang DEFAULT bila belum ada.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl
        AND column_name = 'id' AND column_default IS NOT NULL
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
        r.tbl, v_seq
      );
    END IF;

    -- Ikat sequence ke kolomnya.
    EXECUTE format('ALTER SEQUENCE %s OWNED BY public.%I.id', v_seq, r.tbl);

    -- Sinkronkan nilai sequence dengan MAX(id) existing.
    EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM public.%I', r.tbl) INTO v_max;
    EXECUTE format('SELECT setval(%L, %s, false)', v_seq, GREATEST(v_max, 0) + 1);
  END LOOP;
END $$;

COMMIT;

-- Verifikasi (opsional):
--   SELECT code, parameter_code FROM cmc_profiles WHERE code IN ('CMC-VL','CMC-LN');
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='sensor' AND column_name='parameter_code';
