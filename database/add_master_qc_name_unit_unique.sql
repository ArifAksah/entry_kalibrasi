-- Master QC berlaku satu kali untuk setiap pasangan nama instrumen + satuan.
-- Kode instrumen hanya dipakai untuk memfilter pilihan nama di UI.
-- Script berhenti dan rollback jika data lama benar-benar duplikat.

BEGIN;

DO $$
DECLARE
  duplicate_pairs text;
BEGIN
  SELECT string_agg(
    format(
      'instrument_name_id=%s unit_id=%s ids=%s',
      instrument_name_id,
      unit_id,
      master_qc_ids
    ),
    '; '
  )
  INTO duplicate_pairs
  FROM (
    SELECT
      instrument_name_id,
      unit_id,
      array_agg(id ORDER BY id)::text AS master_qc_ids
    FROM public.master_qc
    GROUP BY instrument_name_id, unit_id
    HAVING count(*) > 1
  ) conflicts;

  IF duplicate_pairs IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration dibatalkan karena pasangan nama instrumen+satuan duplikat: %',
      duplicate_pairs;
  END IF;
END
$$;

ALTER TABLE public.master_qc
  DROP CONSTRAINT IF EXISTS master_qc_instrument_name_unit_unique;

ALTER TABLE public.master_qc
  ADD CONSTRAINT master_qc_instrument_name_unit_unique
  UNIQUE (instrument_name_id, unit_id);

COMMIT;
