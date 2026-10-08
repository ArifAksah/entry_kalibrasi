BEGIN;

-- Surat Keterangan multi-sensor: hasil pemeriksaan dikaitkan ke sensor tertentu.
ALTER TABLE public.letter_inspection_results
  ADD COLUMN IF NOT EXISTS sensor_id bigint REFERENCES public.sensor(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS letter_inspection_results_sensor_idx
  ON public.letter_inspection_results (letter_id, sensor_id, sort_order);

COMMIT;
