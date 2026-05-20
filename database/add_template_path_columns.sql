-- Migration: Add .docx template file path columns to certificate_templates table
-- These columns store the relative path to .docx template files on the PDF Template Service filesystem.
-- When these columns are populated, the system uses the Python PDF Template Service (docxtpl + LibreOffice)
-- instead of the legacy Playwright HTML rendering approach.

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS cover_template_path VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS results_template_path VARCHAR(500) DEFAULT NULL;

-- Documentation comments
COMMENT ON COLUMN certificate_templates.cover_template_path IS
  'Path relatif ke file .docx template cover di PDF Template Service (e.g. "tmpl-uuid-123/cover.docx"). Jika terisi, sistem menggunakan PDF Template Service untuk generate PDF cover.';

COMMENT ON COLUMN certificate_templates.results_template_path IS
  'Path relatif ke file .docx template hasil di PDF Template Service (e.g. "tmpl-uuid-123/results.docx"). Jika terisi, sistem menggunakan PDF Template Service untuk generate PDF halaman hasil.';

-- ─── Rollback Instructions ─────────────────────────────────────────────────────
-- To rollback this migration, run the following SQL:
--
-- ALTER TABLE certificate_templates DROP COLUMN IF EXISTS cover_template_path;
-- ALTER TABLE certificate_templates DROP COLUMN IF EXISTS results_template_path;
--
-- Note: Rollback will permanently remove any stored template paths.
-- Ensure no active templates rely on these columns before rolling back.
-- ────────────────────────────────────────────────────────────────────────────────
