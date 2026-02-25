-- ============================================================
-- Master QC: Schema Update
-- Jalankan script ini di Supabase SQL Editor
-- Tabel instrument_types sudah ada, tidak perlu dibuat ulang
-- ============================================================

-- ============================================================
-- BAGIAN 1: Buat tabel master_qc (jika BELUM ADA)
-- ============================================================
CREATE TABLE IF NOT EXISTS master_qc (
  id                    BIGSERIAL PRIMARY KEY,
  instrument_name_id    BIGINT NOT NULL REFERENCES instrument_names(id) ON DELETE CASCADE,
  alias                 TEXT,
  instrument_type_id    INT REFERENCES instrument_types(id) ON DELETE SET NULL,
  unit_id               BIGINT NOT NULL REFERENCES ref_unit(id) ON DELETE RESTRICT,
  nilai_batas_koreksi   TEXT NOT NULL,
  catatan               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BAGIAN 2: Jika master_qc SUDAH ADA dari script sebelumnya
-- Jalankan ALTER TABLE untuk tambah kolom baru saja
-- ============================================================
-- ALTER TABLE master_qc ADD COLUMN IF NOT EXISTS alias TEXT;
-- ALTER TABLE master_qc ADD COLUMN IF NOT EXISTS instrument_type_id INT REFERENCES instrument_types(id) ON DELETE SET NULL;

-- ============================================================
-- BAGIAN 3: Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_master_qc_instrument ON master_qc(instrument_name_id);
CREATE INDEX IF NOT EXISTS idx_master_qc_unit        ON master_qc(unit_id);
CREATE INDEX IF NOT EXISTS idx_master_qc_type        ON master_qc(instrument_type_id);

-- ============================================================
-- BAGIAN 4: Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_master_qc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_master_qc_updated_at ON master_qc;
CREATE TRIGGER trg_master_qc_updated_at
  BEFORE UPDATE ON master_qc
  FOR EACH ROW EXECUTE FUNCTION update_master_qc_updated_at();

-- ============================================================
-- BAGIAN 5: Row Level Security
-- ============================================================
ALTER TABLE master_qc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_qc_select" ON master_qc;
DROP POLICY IF EXISTS "master_qc_insert" ON master_qc;
DROP POLICY IF EXISTS "master_qc_update" ON master_qc;
DROP POLICY IF EXISTS "master_qc_delete" ON master_qc;

CREATE POLICY "master_qc_select" ON master_qc
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "master_qc_insert" ON master_qc
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "master_qc_update" ON master_qc
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "master_qc_delete" ON master_qc
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- BAGIAN 6: Verifikasi
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'master_qc'
ORDER BY ordinal_position;
