-- Master QC berlaku satu kali untuk setiap pasangan kode instrumen + satuan.
-- Script berhenti dan rollback jika data lama tidak dapat dipetakan atau duplikat.

BEGIN;

ALTER TABLE public.master_qc
  ADD COLUMN IF NOT EXISTS instrument_code_id bigint;

UPDATE public.master_qc mq
SET instrument_code_id = instrument_name.instrument_code_id
FROM public.instrument_names instrument_name
WHERE instrument_name.id = mq.instrument_name_id
  AND mq.instrument_code_id IS NULL;

DO $$
DECLARE
  missing_count integer;
  duplicate_pairs text;
BEGIN
  SELECT count(*)
  INTO missing_count
  FROM public.master_qc
  WHERE instrument_code_id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'Migration dibatalkan: % Master QC tidak memiliki pemetaan instrument_code_id',
      missing_count;
  END IF;

  SELECT string_agg(
    format('code_id=%s unit_id=%s count=%s', instrument_code_id, unit_id, row_count),
    '; '
  )
  INTO duplicate_pairs
  FROM (
    SELECT instrument_code_id, unit_id, count(*) AS row_count
    FROM public.master_qc
    GROUP BY instrument_code_id, unit_id
    HAVING count(*) > 1
  ) conflicts;

  IF duplicate_pairs IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration dibatalkan karena pasangan kode+satuan duplikat: %',
      duplicate_pairs;
  END IF;
END
$$;

ALTER TABLE public.master_qc
  ALTER COLUMN instrument_code_id SET NOT NULL;

ALTER TABLE public.master_qc
  DROP CONSTRAINT IF EXISTS master_qc_instrument_code_id_fkey;

ALTER TABLE public.master_qc
  ADD CONSTRAINT master_qc_instrument_code_id_fkey
  FOREIGN KEY (instrument_code_id)
  REFERENCES public.instrument_code(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE public.master_qc
  DROP CONSTRAINT IF EXISTS master_qc_instrument_code_unit_unique;

ALTER TABLE public.master_qc
  ADD CONSTRAINT master_qc_instrument_code_unit_unique
  UNIQUE (instrument_code_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_master_qc_instrument_code_id
  ON public.master_qc(instrument_code_id);

COMMIT;
