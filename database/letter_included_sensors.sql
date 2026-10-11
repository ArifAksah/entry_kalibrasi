-- Daftar sensor yang DIPAKAI pada sebuah Surat Keterangan.
--
-- Latar: form Edit Surat menampilkan satu blok per sensor instrumen. Bila petugas
-- menghapus sensor yang tidak diperiksa (mis. instrumen punya dua sensor tetapi
-- hanya satu yang diuji), penghapusan itu hilang saat surat dibuka ulang karena
-- daftar sensor selalu diambil ulang dari instrumen.
--
-- `included_sensor_ids` menyimpan sensor yang benar-benar dipakai. NULL = belum
-- pernah diatur -> tampilkan semua sensor instrumen (perilaku lama/back-compat).
--
-- Idempoten: aman dijalankan berulang.

BEGIN;

ALTER TABLE public.letter
  ADD COLUMN IF NOT EXISTS included_sensor_ids bigint[];

COMMIT;
