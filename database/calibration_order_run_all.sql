-- ============================================================================
-- Calibration Order — RUNNER
-- Jalankan file ini SEKALI untuk membuat seluruh modul order kalibrasi.
-- Idempotent: aman dijalankan berulang.
--
-- Urutan WAJIB:
--   1) calibration_order_01_schema.sql
--   2) calibration_order_02_rpc.sql
--   3) calibration_order_03_link_certificate.sql
--
-- Cara pakai (Supabase Docker dev):
--   # 1) copy file ke container (karena \ir butuh file di sisi psql)
--   sg docker -c "docker exec supabase-db mkdir -p /tmp/ordermig"
--   for f in calibration_order_0*.sql calibration_order_run_all.sql; do \
--     sg docker -c "docker cp $f supabase-db:/tmp/ordermig/"; done
--   # 2) jalankan runner
--   sg docker -c "docker exec supabase-db psql -U postgres -v ON_ERROR_STOP=1 \
--     -f /tmp/ordermig/calibration_order_run_all.sql"
--
--   # Alternatif tanpa runner (pipe per file dari host):
--   sg docker -c "docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1" \
--     < database/calibration_order_01_schema.sql
--   sg docker -c "docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1" \
--     < database/calibration_order_02_rpc.sql
--   sg docker -c "docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1" \
--     < database/calibration_order_03_link_certificate.sql
--
-- Catatan:
--   - Counter di-seed dari MAX(no_order) historis certificate agar tidak
--     menabrak nomor yang sudah terpakai.
--   - Reset tahunan otomatis: counter ber-key (tahun, FC/LC), tahun baru = 001.
--   - Hard reset turun di bawah nomor terpakai DITOLAK oleh admin_reset_order_counter.
-- ============================================================================

\ir calibration_order_01_schema.sql
\ir calibration_order_02_rpc.sql
\ir calibration_order_03_link_certificate.sql
