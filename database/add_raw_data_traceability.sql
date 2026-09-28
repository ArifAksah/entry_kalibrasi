ALTER TABLE public.raw_data
ADD COLUMN IF NOT EXISTS source_row_index integer,
ADD COLUMN IF NOT EXISTS standard_certificate_id bigint;

WITH ranked_rows AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY session_id, COALESCE(sheet_name, '')
            ORDER BY id
        )::integer AS source_row_index
    FROM public.raw_data
)
UPDATE public.raw_data AS raw
SET source_row_index = ranked.source_row_index
FROM ranked_rows AS ranked
WHERE raw.id = ranked.id
  AND raw.source_row_index IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'raw_data'
          AND constraint_name = 'raw_data_standard_certificate_id_fkey'
    ) THEN
        ALTER TABLE public.raw_data
        ADD CONSTRAINT raw_data_standard_certificate_id_fkey
        FOREIGN KEY (standard_certificate_id)
        REFERENCES public.certificate_standard(id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raw_data_session_source_row
ON public.raw_data(session_id, sheet_name, source_row_index);

CREATE INDEX IF NOT EXISTS idx_raw_data_standard_certificate
ON public.raw_data(standard_certificate_id);
