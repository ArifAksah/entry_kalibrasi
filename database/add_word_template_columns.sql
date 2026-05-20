-- Migration: Add Word template HTML columns to certificate_templates table
-- These columns store the converted HTML from uploaded Word (.docx) files
-- for the 3-page Word template approach (cover, results, end).

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS cover_html TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS results_html TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_html TEXT DEFAULT NULL;

-- Add a comment explaining the columns
COMMENT ON COLUMN certificate_templates.cover_html IS 'HTML converted from cover page Word file (halaman pertama sertifikat)';
COMMENT ON COLUMN certificate_templates.results_html IS 'HTML converted from results page Word file (halaman isi/hasil kalibrasi)';
COMMENT ON COLUMN certificate_templates.end_html IS 'HTML converted from end page Word file (halaman akhir)';
