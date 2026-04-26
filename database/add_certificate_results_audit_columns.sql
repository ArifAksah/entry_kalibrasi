-- ============================================================================
-- B.1 - Certificate Results Audit Columns
-- ----------------------------------------------------------------------------
-- Tujuan:
--   Menyiapkan kolom audit/filter untuk evolusi kontrak `certificate.results`
--   tanpa mengubah flow aplikasi saat ini.
--
-- Kolom baru:
--   1. calibration_kind       : 'FC' | 'LC'
--   2. results_schema_version : versi kontrak JSONB `results`
--   3. results_frozen_at      : kapan `results` dianggap dibekukan
--
-- CATATAN PENTING
-- ---------------
-- - Migration ini TIDAK menghapus / mengganti `calibration_place`.
-- - `calibration_kind` dibackfill dari `calibration_place` agar transisi aman.
-- - Legacy results array (V0, sebelum ada schema_version di JSON) ditandai
--   sebagai `results_schema_version = 0` untuk keperluan audit.
-- - Draft tetap `results_frozen_at = NULL` karena masih boleh diedit.
-- - Jalankan di database development dulu, lalu review hasil backfill.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 1: Tambah kolom baru
-- ---------------------------------------------------------------------------

ALTER TABLE certificate
  ADD COLUMN IF NOT EXISTS calibration_kind       VARCHAR(2),
  ADD COLUMN IF NOT EXISTS results_schema_version INTEGER,
  ADD COLUMN IF NOT EXISTS results_frozen_at      TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- STEP 2: Tambah CHECK constraint (idempoten)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'certificate_calibration_kind_check'
  ) THEN
    ALTER TABLE certificate
      ADD CONSTRAINT certificate_calibration_kind_check
      CHECK (calibration_kind IN ('FC', 'LC'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'certificate_results_schema_version_check'
  ) THEN
    ALTER TABLE certificate
      ADD CONSTRAINT certificate_results_schema_version_check
      CHECK (results_schema_version IS NULL OR results_schema_version >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 3: COMMENT agar niat kolom jelas untuk maintainer berikutnya
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN certificate.calibration_kind IS
  'Discriminator FC/LC untuk kontrak results dan audit. Dibackfill dari calibration_place.';

COMMENT ON COLUMN certificate.results_schema_version IS
  'Versi kontrak JSONB certificate.results. 0 = legacy V0 (array lama), 1 = schema V1 namespaced.';

COMMENT ON COLUMN certificate.results_frozen_at IS
  'Timestamp ketika payload results dianggap dibekukan untuk audit/versioning. NULL = masih editable.';

-- ---------------------------------------------------------------------------
-- STEP 4: Backfill calibration_kind dari kolom yang sudah ada
-- ---------------------------------------------------------------------------
-- Prioritas:
--   1. calibration_place jika valid
--   2. parse no_certificate jika bisa dikenali
--   3. fallback FC

UPDATE certificate
   SET calibration_kind = CASE
         WHEN calibration_place IN ('FC', 'LC') THEN calibration_place
         WHEN no_certificate ~* '\.?LC[\.\- /]' THEN 'LC'
         WHEN no_certificate ~* '\.?FC[\.\- /]' THEN 'FC'
         ELSE 'FC'
       END
 WHERE calibration_kind IS NULL;

-- ---------------------------------------------------------------------------
-- STEP 5: Backfill results_schema_version
-- ---------------------------------------------------------------------------
-- Aturan:
--   - NULL  : tidak ada results
--   - 0     : legacy V0 (results array lama, belum versioned)
--   - >= 1  : baca dari JSON object.schema_version jika tersedia

UPDATE certificate
   SET results_schema_version = CASE
         WHEN results IS NULL THEN NULL
         WHEN jsonb_typeof(results) = 'array' THEN 0
         WHEN jsonb_typeof(results) = 'object'
              AND results ? 'schema_version'
              AND (results->>'schema_version') ~ '^\d+$'
           THEN (results->>'schema_version')::INTEGER
         ELSE NULL
       END
 WHERE results_schema_version IS NULL;

-- ---------------------------------------------------------------------------
-- STEP 6: Backfill results_frozen_at
-- ---------------------------------------------------------------------------
-- Prinsip awal:
--   - draft  => tetap NULL (editable)
--   - selain draft => anggap frozen sejak pertama kali dikirim / terbit
--
-- Prioritas timestamp:
--   1. sent_to_verifiers_at
--   2. pdf_generated_at
--   3. last_rejection_at
--   4. created_at

UPDATE certificate
   SET results_frozen_at = COALESCE(
         sent_to_verifiers_at,
         pdf_generated_at,
         last_rejection_at,
         created_at
       )
 WHERE results_frozen_at IS NULL
   AND COALESCE(status, 'draft') <> 'draft';

-- ---------------------------------------------------------------------------
-- STEP 7: Default untuk data baru
-- ---------------------------------------------------------------------------
-- Mulai sekarang:
--   - calibration_kind default FC (selaras dengan flow current)
--   - results_schema_version default 1 (sesuai writer V1 yang baru)

ALTER TABLE certificate
  ALTER COLUMN calibration_kind SET DEFAULT 'FC';

ALTER TABLE certificate
  ALTER COLUMN results_schema_version SET DEFAULT 1;

-- ---------------------------------------------------------------------------
-- STEP 8: Index untuk filter & audit
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_certificate_calibration_kind
  ON certificate (calibration_kind);

CREATE INDEX IF NOT EXISTS idx_certificate_results_schema_version
  ON certificate (results_schema_version);

CREATE INDEX IF NOT EXISTS idx_certificate_results_frozen_at
  ON certificate (results_frozen_at);

CREATE INDEX IF NOT EXISTS idx_certificate_kind_issue_date
  ON certificate (calibration_kind, issue_date);

-- ---------------------------------------------------------------------------
-- STEP 9: Ringkasan hasil backfill (dibaca di output SQL editor)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_fc_count        INTEGER;
  v_lc_count        INTEGER;
  v_v0_count        INTEGER;
  v_v1_count        INTEGER;
  v_null_ver_count  INTEGER;
  v_frozen_count    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fc_count FROM certificate WHERE calibration_kind = 'FC';
  SELECT COUNT(*) INTO v_lc_count FROM certificate WHERE calibration_kind = 'LC';
  SELECT COUNT(*) INTO v_v0_count FROM certificate WHERE results_schema_version = 0;
  SELECT COUNT(*) INTO v_v1_count FROM certificate WHERE results_schema_version = 1;
  SELECT COUNT(*) INTO v_null_ver_count FROM certificate WHERE results IS NOT NULL AND results_schema_version IS NULL;
  SELECT COUNT(*) INTO v_frozen_count FROM certificate WHERE results_frozen_at IS NOT NULL;

  RAISE NOTICE 'B.1 migration selesai.';
  RAISE NOTICE '  calibration_kind: FC=% | LC=%', v_fc_count, v_lc_count;
  RAISE NOTICE '  results_schema_version: V0=% | V1=% | NULL(non-null results)=%', v_v0_count, v_v1_count, v_null_ver_count;
  RAISE NOTICE '  results_frozen_at terisi pada % row', v_frozen_count;
END $$;

COMMIT;

