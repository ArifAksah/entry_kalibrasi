-- Add PDF path column to certificate table
-- This stores the path to the PDF file in Supabase storage after level 3 is approved

ALTER TABLE certificate ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE certificate ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_pdf_path ON certificate(pdf_path);

-- Add comment to explain the column
COMMENT ON COLUMN certificate.pdf_path IS 'Path to the generated PDF file in Supabase storage. Generated automatically when level 3 verification is approved.';
COMMENT ON COLUMN certificate.pdf_generated_at IS 'Timestamp when the PDF was generated.';

