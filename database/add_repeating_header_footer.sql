-- Migration: Add repeating header/footer columns to certificate_templates
-- These columns store HTML templates that appear on every page of the generated PDF
-- via Playwright's headerTemplate and footerTemplate PDF options.

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS repeating_header TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeating_footer TEXT DEFAULT NULL;

COMMENT ON COLUMN certificate_templates.repeating_header IS 'HTML template for repeating header on every PDF page';
COMMENT ON COLUMN certificate_templates.repeating_footer IS 'HTML template for repeating footer on every PDF page';
