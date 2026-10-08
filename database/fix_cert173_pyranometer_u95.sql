BEGIN;

-- ============================================================================
-- Perbaiki hasil pyranometer pada sertifikat 173 (Sert.IFC-SR/001.001/DIK/X/2026)
--
-- Nilai lama tersimpan dihitung TANPA komponen drift ISO 9060
-- (uncertaintyMeta.drift_class = null, drift_value_percent = 0) sehingga
-- U95 = 2.109099... %. Nilai yang benar (dihitung dengan kode terbaru:
-- drift standar CMP3 = Class C 3 %) = 4.029298... %.
-- ============================================================================

DROP TABLE IF EXISTS public.cert173_results_backup;
CREATE TABLE public.cert173_results_backup AS
SELECT id, results, updated_at FROM public.certificate WHERE id = 173;

UPDATE public.certificate c
SET results = jsonb_set(
      jsonb_set(
        jsonb_set(c.results::jsonb,
          '{sensors,0,display,tables,0,rows,0,value}', '"4.0292980226852055"'::jsonb, false),
        '{sensors,0,display,tables,0,rows,0,uncertaintyMeta,raw_u95}', '4.0292980226852055'::jsonb, false),
      '{sensors,0,display,tables,0,rows,0,uncertaintyMeta,reported_u95}', '4.0292980226852055'::jsonb, false
    )::json,
    updated_at = now()
WHERE c.id = 173;

UPDATE public.certificate c
SET results = jsonb_set(
      jsonb_set(
        jsonb_set(c.results::jsonb,
          '{sensors,1,display,tables,0,rows,0,value}', '"4.0292983001453315"'::jsonb, false),
        '{sensors,1,display,tables,0,rows,0,uncertaintyMeta,raw_u95}', '4.0292983001453315'::jsonb, false),
      '{sensors,1,display,tables,0,rows,0,uncertaintyMeta,reported_u95}', '4.0292983001453315'::jsonb, false
    )::json,
    updated_at = now()
WHERE c.id = 173;

-- Tandai kelas drift yang benar (Class C / 3 %) pada kedua sensor
UPDATE public.certificate c
SET results = jsonb_set(
      jsonb_set(c.results::jsonb,
        '{sensors,0,display,tables,0,rows,0,uncertaintyMeta,drift_class}', '"C"'::jsonb, false),
        '{sensors,0,display,tables,0,rows,0,uncertaintyMeta,drift_value_percent}', '3'::jsonb, false
    )::json
WHERE c.id = 173;

UPDATE public.certificate c
SET results = jsonb_set(
      jsonb_set(c.results::jsonb,
        '{sensors,1,display,tables,0,rows,0,uncertaintyMeta,drift_class}', '"C"'::jsonb, false),
        '{sensors,1,display,tables,0,rows,0,uncertaintyMeta,drift_value_percent}', '3'::jsonb, false
    )::json
WHERE c.id = 173;

COMMIT;

-- Verifikasi:
-- SELECT jsonb_path_query_array(results::jsonb, '$.sensors[*].snapshot.name') nama,
--        jsonb_path_query_array(results::jsonb, '$.sensors[*].display.tables[*].rows[*].unit') cf,
--        jsonb_path_query_array(results::jsonb, '$.sensors[*].display.tables[*].rows[*].value') u95,
--        jsonb_path_query_array(results::jsonb, '$.sensors[*].display.tables[*].rows[*].uncertaintyMeta.drift_class') drift
-- FROM public.certificate WHERE id = 173;
