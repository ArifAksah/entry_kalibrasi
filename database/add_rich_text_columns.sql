-- Migration: Add rich text columns to certificate_templates
-- These columns coexist with existing cover_blocks/results_blocks for backward compatibility.
-- The new columns store TipTap JSON documents and page layout settings for the rich text editor.

-- ─── Add Columns ─────────────────────────────────────────────────────────────

-- Stores TipTap JSON document (rich text editor content)
ALTER TABLE certificate_templates
  ADD COLUMN content JSONB DEFAULT NULL;

-- Stores page layout settings (paper size, orientation, margins)
ALTER TABLE certificate_templates
  ADD COLUMN page_settings JSONB DEFAULT NULL;

-- ─── CHECK Constraints ───────────────────────────────────────────────────────

-- Validation: if content is set, it must be a valid TipTap document
-- (root node type = "doc" with content array)
ALTER TABLE certificate_templates
  ADD CONSTRAINT valid_tiptap_content
  CHECK (content IS NULL OR (
    content->>'type' = 'doc' AND
    jsonb_typeof(content->'content') = 'array'
  ));

-- Validation: if page_settings is set, it must have required fields
-- (paperSize, orientation, and margins object)
ALTER TABLE certificate_templates
  ADD CONSTRAINT valid_page_settings
  CHECK (page_settings IS NULL OR (
    page_settings->>'paperSize' IS NOT NULL AND
    page_settings->>'orientation' IS NOT NULL AND
    page_settings->'margins' IS NOT NULL
  ));

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Partial index for fast lookup of active templates that use rich text content
CREATE INDEX idx_templates_has_content ON certificate_templates (certificate_type, is_active)
  WHERE content IS NOT NULL AND is_active = TRUE;
