-- ============================================================
-- Perbaikan Manajemen Personel: kolom update + soft delete
-- Jalankan di Supabase SQL Editor.
--
-- 1. Kolom yang dipakai form edit personel (balai & penandatangan).
-- 2. Kolom soft-delete (is_active, deleted_at).
-- ============================================================

ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS balai_id integer;
ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS signer_title text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_personel_balai_id'
  ) THEN
    ALTER TABLE public.personel
      ADD CONSTRAINT chk_personel_balai_id
      CHECK (balai_id IS NULL OR (balai_id >= 1 AND balai_id <= 5));
  END IF;
END $$;

ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_personel_active
  ON public.personel (is_active)
  WHERE is_active = true;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE public.personel DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.personel DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE public.personel DROP CONSTRAINT IF EXISTS chk_personel_balai_id;
-- ALTER TABLE public.personel DROP COLUMN IF EXISTS signer_title;
-- ALTER TABLE public.personel DROP COLUMN IF EXISTS balai_id;
-- ============================================================
