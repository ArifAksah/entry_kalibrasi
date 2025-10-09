-- SQL Script untuk menambahkan kolom verifikasi dan perbaikan ke database
-- Jalankan script ini di Supabase SQL Editor

-- 1. Tambahkan kolom ke tabel certificate
ALTER TABLE certificate 
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS repair_notes TEXT,
ADD COLUMN IF NOT EXISTS repair_status VARCHAR(20) DEFAULT 'none' CHECK (repair_status IN ('none', 'pending', 'completed', 'rejected')),
ADD COLUMN IF NOT EXISTS repair_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Tambahkan kolom ke tabel certificate_verification
ALTER TABLE certificate_verification 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- 3. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_certificate_repair_status ON certificate(repair_status);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_notes ON certificate(verification_notes);
CREATE INDEX IF NOT EXISTS idx_certificate_verification_rejection ON certificate_verification(rejection_reason);

-- 4. Buat fungsi untuk meminta perbaikan sertifikat
CREATE OR REPLACE FUNCTION request_certificate_repair(
  p_certificate_id INTEGER,
  p_repair_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Update status perbaikan
  UPDATE certificate 
  SET 
    repair_status = 'pending',
    repair_notes = p_repair_notes,
    repair_requested_at = NOW()
  WHERE id = p_certificate_id;
  
  -- Cek apakah update berhasil
  IF FOUND THEN
    result := json_build_object(
      'success', true,
      'message', 'Permintaan perbaikan berhasil dikirim',
      'certificate_id', p_certificate_id
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Sertifikat tidak ditemukan'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. Buat fungsi untuk menyelesaikan perbaikan sertifikat
CREATE OR REPLACE FUNCTION complete_certificate_repair(
  p_certificate_id INTEGER,
  p_completion_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Update status perbaikan menjadi completed
  UPDATE certificate 
  SET 
    repair_status = 'completed',
    repair_completed_at = NOW(),
    repair_notes = COALESCE(p_completion_notes, repair_notes)
  WHERE id = p_certificate_id AND repair_status = 'pending';
  
  -- Cek apakah update berhasil
  IF FOUND THEN
    result := json_build_object(
      'success', true,
      'message', 'Perbaikan berhasil diselesaikan',
      'certificate_id', p_certificate_id
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Sertifikat tidak ditemukan atau tidak dalam status pending'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Buat fungsi untuk reset verifikasi sertifikat
CREATE OR REPLACE FUNCTION reset_certificate_verification(
  p_certificate_id INTEGER
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  deleted_count INTEGER;
BEGIN
  -- Hapus semua verifikasi untuk sertifikat ini
  DELETE FROM certificate_verification WHERE certificate_id = p_certificate_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Reset status perbaikan
  UPDATE certificate 
  SET 
    repair_status = 'none',
    repair_notes = NULL,
    repair_requested_at = NULL,
    repair_completed_at = NULL,
    verification_notes = NULL,
    rejection_reason = NULL
  WHERE id = p_certificate_id;
  
  -- Cek apakah update berhasil
  IF FOUND THEN
    result := json_build_object(
      'success', true,
      'message', 'Verifikasi berhasil direset',
      'certificate_id', p_certificate_id,
      'deleted_verifications', deleted_count
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Sertifikat tidak ditemukan'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Buat view untuk melihat status verifikasi yang lengkap
CREATE OR REPLACE VIEW certificate_verification_status AS
SELECT 
  c.id as certificate_id,
  c.no_certificate,
  c.no_order,
  c.repair_status,
  c.repair_notes,
  c.repair_requested_at,
  c.repair_completed_at,
  c.verification_notes,
  c.rejection_reason,
  -- Status verifikator 1
  v1.status as verifikator_1_status,
  v1.notes as verifikator_1_notes,
  v1.rejection_reason as verifikator_1_rejection_reason,
  v1.approval_notes as verifikator_1_approval_notes,
  v1.created_at as verifikator_1_created_at,
  -- Status verifikator 2
  v2.status as verifikator_2_status,
  v2.notes as verifikator_2_notes,
  v2.rejection_reason as verifikator_2_rejection_reason,
  v2.approval_notes as verifikator_2_approval_notes,
  v2.created_at as verifikator_2_created_at,
  -- Status authorized by
  v3.status as authorized_by_status,
  v3.notes as authorized_by_notes,
  v3.rejection_reason as authorized_by_rejection_reason,
  v3.approval_notes as authorized_by_approval_notes,
  v3.created_at as authorized_by_created_at,
  -- Overall status
  CASE 
    WHEN v1.status = 'rejected' OR v2.status = 'rejected' OR v3.status = 'rejected' THEN 'rejected'
    WHEN v3.status = 'approved' THEN 'approved'
    WHEN v2.status = 'approved' THEN 'pending_v3'
    WHEN v1.status = 'approved' THEN 'pending_v2'
    ELSE 'pending_v1'
  END as overall_status
FROM certificate c
LEFT JOIN certificate_verification v1 ON c.id = v1.certificate_id AND v1.verification_level = 1
LEFT JOIN certificate_verification v2 ON c.id = v2.certificate_id AND v2.verification_level = 2
LEFT JOIN certificate_verification v3 ON c.id = v3.certificate_id AND v3.verification_level = 3;

-- 8. Berikan permission untuk menggunakan fungsi-fungsi
GRANT EXECUTE ON FUNCTION request_certificate_repair(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_certificate_repair(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_certificate_verification(INTEGER) TO authenticated;
GRANT SELECT ON certificate_verification_status TO authenticated;

-- 9. Tampilkan pesan sukses
SELECT 'Database schema berhasil diperbarui! Kolom verifikasi dan perbaikan telah ditambahkan.' as message;
