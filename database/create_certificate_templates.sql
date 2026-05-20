-- Migration: Create certificate_templates table for block-based template editor
-- This table stores certificate template configurations as ordered JSONB block arrays,
-- enabling runtime modification without redeployment.

-- ─── Table: certificate_templates ────────────────────────────────────────────

CREATE TABLE certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  certificate_type VARCHAR(50) NOT NULL,
  cover_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  results_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one version per certificate_type
  CONSTRAINT unique_type_version UNIQUE (certificate_type, version),

  -- Ensure JSONB columns contain arrays
  CONSTRAINT valid_cover_blocks CHECK (jsonb_typeof(cover_blocks) = 'array'),
  CONSTRAINT valid_results_blocks CHECK (jsonb_typeof(results_blocks) = 'array')
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Partial index for fast lookup of active templates per type
CREATE INDEX idx_templates_type_active ON certificate_templates (certificate_type, is_active)
  WHERE is_active = TRUE;

-- Index for version history queries (descending version order)
CREATE INDEX idx_templates_type_version ON certificate_templates (certificate_type, version DESC);

-- ─── Alter existing certificate table ────────────────────────────────────────

-- Track which template version was used when a certificate was issued
ALTER TABLE certificate ADD COLUMN template_version INTEGER;
