# Dokumen Skenario Pengujian SIMKAL
## Sistem Informasi Manajemen Kalibrasi — BMKG

> **Versi:** 1.0  
> **Tanggal:** 2025  
> **Status Kolom Actual Result:** Diisi saat pelaksanaan pengujian

---

## Legenda Status

| Status | Keterangan |
|--------|-----------|
| ✅ Pass | Hasil sesuai expected result |
| ❌ Fail | Hasil tidak sesuai expected result |
| ⚠️ Partial | Hasil sebagian sesuai |
| 🔄 Pending | Belum diuji |

---

## MODUL 1 — Autentikasi

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-AUTH-01 | Login dengan kredensial valid | Semua | Buka `/login`, isi email & password yang benar, klik Sign In | Redirect ke Dashboard, muncul pesan "Welcome back, [nama]" | | 🔄 |
| TC-AUTH-02 | Login dengan password salah | Semua | Buka `/login`, isi email benar & password salah | Muncul pesan error, tidak redirect | | 🔄 |
| TC-AUTH-03 | Login dengan email tidak terdaftar | Semua | Isi email yang tidak ada di sistem | Muncul error "User not found in system" | | 🔄 |
| TC-AUTH-04 | Login dengan field kosong | Semua | Klik Sign In tanpa mengisi field | Form tidak submit, ada validasi HTML required | | 🔄 |
| TC-AUTH-05 | Akses halaman dashboard tanpa login | - | Langsung buka `http://172.19.3.171/` | Redirect ke `/login` | | 🔄 |
| TC-AUTH-06 | Akses `/login` saat sudah login | Semua | Buka `/login` saat sudah terautentikasi | Redirect ke Dashboard (tidak tampilkan halaman login) | | 🔄 |
| TC-AUTH-07 | Lupa password — kirim email reset | Semua | Buka `/forgot-password`, isi email valid, klik kirim | Email reset diterima, muncul pesan konfirmasi | | 🔄 |
| TC-AUTH-08 | Reset password dengan token valid | Semua | Buka link reset di email, isi password baru | Password berhasil diubah, bisa login dengan password baru | | 🔄 |
| TC-AUTH-09 | Logout dari sistem | Semua | Klik tombol Logout di header | Sesi dihapus, redirect ke `/login` | | 🔄 |
| TC-AUTH-10 | Token sesi kedaluwarsa | Semua | Biarkan sesi idle lama lalu akses halaman | Redirect ke `/login` dengan notifikasi sesi habis | | 🔄 |

---

## MODUL 2 — Dashboard

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-DASH-01 | Tampilan dashboard admin | admin | Login sebagai admin, buka `/` | Tampil kartu statistik, Butuh Aksi, Antrean Tahap, Ringkasan Reject | | 🔄 |
| TC-DASH-02 | Tampilan dashboard calibrator | calibrator | Login sebagai calibrator | Tampil kartu statistik dan daftar pekerjaan calibrator | | 🔄 |
| TC-DASH-03 | Tampilan dashboard verifikator | verifikator | Login sebagai verifikator | Tampil sertifikat yang menunggu verifikasi | | 🔄 |
| TC-DASH-04 | Tampilan dashboard assignor | assignor | Login sebagai assignor | Tampil antrean verifikasi level assignor | | 🔄 |
| TC-DASH-05 | Tampilan dashboard user_station | user_station | Login sebagai user_station | Tampil ringkasan stasiun: total instrumen, masa berlaku valid, menunggu kalibrasi | | 🔄 |
| TC-DASH-06 | Tabel sertifikat jatuh tempo | user_station | Login sebagai user_station dengan stasiun assigned | Tampil top 5 sertifikat UUT terdekat masa berlakunya | | 🔄 |
| TC-DASH-07 | Grafik tren koreksi | user_station | Login sebagai user_station, lihat chart | Grafik koreksi & uncertainty tampil untuk setiap instrumen | | 🔄 |
| TC-DASH-08 | Link "Butuh Aksi" mengarah ke sertifikat | admin/calibrator | Klik item di bagian "Butuh Aksi" | Diarahkan ke halaman sertifikat yang relevan | | 🔄 |

---

## MODUL 3 — Manajemen Stasiun

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-STN-01 | Lihat daftar stasiun | admin, calibrator | Buka `/stations` | Tampil daftar stasiun dengan pagination | | 🔄 |
| TC-STN-02 | Akses `/stations` sebagai verifikator | verifikator | Buka `/stations` | Redirect atau menu tidak muncul di sidebar | | 🔄 |
| TC-STN-03 | Tambah stasiun baru — data lengkap | admin, calibrator | Klik "+ Tambah Stasiun", isi semua field, simpan | Stasiun baru muncul di daftar | | 🔄 |
| TC-STN-04 | Tambah stasiun — field wajib kosong | admin, calibrator | Klik simpan tanpa mengisi field wajib (nama, alamat, dll.) | Muncul error validasi, data tidak tersimpan | | 🔄 |
| TC-STN-05 | Edit stasiun | admin, calibrator | Klik ikon edit pada stasiun, ubah nama, simpan | Data stasiun terupdate di daftar | | 🔄 |
| TC-STN-06 | Hapus stasiun | admin | Klik ikon hapus, konfirmasi | Stasiun hilang dari daftar | | 🔄 |
| TC-STN-07 | Pencarian stasiun | admin, calibrator | Ketik nama/provinsi di kotak pencarian | Daftar difilter sesuai kata kunci | | 🔄 |
| TC-STN-08 | Lihat stasiun sendiri — user_station | user_station | Buka `/stations` | Hanya tampil stasiun yang ditugaskan | | 🔄 |

---

## MODUL 4 — Manajemen Instrumen

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-INS-01 | Lihat daftar instrumen | admin, calibrator | Buka `/instruments` | Tampil daftar instrumen dengan filter dan pagination | | 🔄 |
| TC-INS-02 | Filter instrumen tipe UUT | admin, calibrator | Pilih filter "UUT" | Hanya instrumen tipe UUT yang tampil | | 🔄 |
| TC-INS-03 | Filter instrumen tipe Standar | admin, calibrator | Pilih filter "Standar" | Hanya instrumen standar yang tampil | | 🔄 |
| TC-INS-04 | Tambah instrumen baru | admin, calibrator | Klik "+ Tambah", isi semua field, simpan | Instrumen baru muncul di daftar | | 🔄 |
| TC-INS-05 | Tambah instrumen — field wajib kosong | admin, calibrator | Submit tanpa mengisi nama/kode | Muncul pesan error validasi | | 🔄 |
| TC-INS-06 | Edit instrumen | admin, calibrator | Klik ikon edit, ubah data, simpan | Data instrumen terupdate | | 🔄 |
| TC-INS-07 | Hapus instrumen | admin | Klik ikon hapus, konfirmasi | Instrumen hilang dari daftar | | 🔄 |
| TC-INS-08 | Pencarian instrumen | admin, calibrator | Ketik nama/kode di pencarian | Daftar difilter sesuai kata kunci | | 🔄 |
| TC-INS-09 | Akses instrumen sebagai verifikator | verifikator | Buka `/instruments` | Menu tidak tampil di sidebar / redirect | | 🔄 |
| TC-INS-10 | Lihat instrumen sebagai user_station | user_station | Buka `/instruments` | Tampil instrumen milik stasiun yang ditugaskan | | 🔄 |

---

## MODUL 5 — Manajemen Sertifikat

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-CERT-01 | Lihat daftar sertifikat | admin, calibrator | Buka `/certificates` | Tampil daftar sertifikat dengan status verifikasi | | 🔄 |
| TC-CERT-02 | Buat sertifikat baru — draft | calibrator | Klik "+ Buat Sertifikat", isi semua field, simpan sebagai draft | Status sertifikat = Draft, muncul di daftar | | 🔄 |
| TC-CERT-03 | Buat sertifikat — no identifikasi kosong | calibrator | Submit tanpa mengisi no_identification | Muncul error validasi, tidak tersimpan | | 🔄 |
| TC-CERT-04 | Buat sertifikat — tanpa pilih verifikator | calibrator | Submit tanpa memilih verifikator L1/L2/L3 | Muncul error atau warning | | 🔄 |
| TC-CERT-05 | Upload raw data Excel | calibrator | Di form sertifikat, upload file .xlsx | Data terbaca per sheet, tampil di tabel raw data | | 🔄 |
| TC-CERT-06 | Upload file bukan Excel | calibrator | Upload file .pdf atau .txt | Muncul pesan error format file tidak didukung | | 🔄 |
| TC-CERT-07 | Hitung uncertainty | calibrator | Klik "Hitung Ketidakpastian" setelah raw data diisi | Modal kalkulator terbuka, hasil koreksi & U95 dihitung | | 🔄 |
| TC-CERT-08 | Ajukan sertifikat ke verifikasi | calibrator | Klik "Ajukan untuk Verifikasi" | Status berubah dari Draft → Diajukan | | 🔄 |
| TC-CERT-09 | Edit sertifikat berstatus Draft | calibrator | Klik edit pada sertifikat Draft | Form edit terbuka dan bisa diubah | | 🔄 |
| TC-CERT-10 | Edit sertifikat sudah diajukan | calibrator | Coba edit sertifikat status Diajukan | Tidak bisa diedit / tombol edit tidak aktif | | 🔄 |
| TC-CERT-11 | Hapus sertifikat Draft | admin | Klik hapus pada sertifikat Draft | Sertifikat terhapus dari daftar | | 🔄 |
| TC-CERT-12 | Lihat detail sertifikat | Semua | Klik "View" pada sertifikat | Tampil halaman detail sertifikat `/certificates/[id]/view` | | 🔄 |
| TC-CERT-13 | Cetak sertifikat | admin, calibrator, assignor | Klik "Print" pada sertifikat | Halaman cetak PDF terbuka `/certificates/[id]/print` | | 🔄 |
| TC-CERT-14 | Filter sertifikat berdasarkan stasiun | admin, calibrator | Pilih filter stasiun | Hanya sertifikat stasiun tersebut yang tampil | | 🔄 |
| TC-CERT-15 | Filter sertifikat berdasarkan status | admin, calibrator | Pilih filter status "Draft" | Hanya sertifikat Draft yang tampil | | 🔄 |
| TC-CERT-16 | Sertifikat ditolak dapat diajukan ulang | calibrator | Buka sertifikat Ditolak, perbaiki, ajukan ulang | Status kembali ke Diajukan | | 🔄 |

---

## MODUL 6 — Verifikasi Sertifikat

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-VER-01 | Lihat daftar sertifikat untuk diverifikasi | verifikator, assignor | Buka `/certificate-verification` | Tampil sertifikat yang menunggu verifikasi di level yang relevan | | 🔄 |
| TC-VER-02 | Setujui sertifikat Level 1 | verifikator (L1) | Buka sertifikat, klik "Setujui", submit | Status berubah ke Diverifikasi L1 | | 🔄 |
| TC-VER-03 | Setujui sertifikat Level 2 | verifikator (L2) | Buka sertifikat L1-approved, klik "Setujui" | Status berubah ke Diverifikasi L2 | | 🔄 |
| TC-VER-04 | Setujui sertifikat Level 3 (final) | assignor (L3) | Buka sertifikat L2-approved, klik "Setujui" | Status berubah ke Selesai | | 🔄 |
| TC-VER-05 | Tolak sertifikat tanpa alasan | verifikator | Klik "Tolak" tanpa mengisi alasan | Muncul error validasi, tidak tersimpan | | 🔄 |
| TC-VER-06 | Tolak sertifikat dengan alasan & kategori | verifikator | Klik "Tolak", isi alasan + kategori, submit | Status berubah ke Ditolak, calibrator mendapat notifikasi | | 🔄 |
| TC-VER-07 | Calibrator tidak bisa mengakses verifikasi | calibrator | Buka `/certificate-verification` | Menu tidak tampil / redirect | | 🔄 |
| TC-VER-08 | Verifikator tidak bisa buat sertifikat baru | verifikator | Coba akses `/certificates` untuk buat baru | Menu Sertifikat tidak tampil di sidebar | | 🔄 |
| TC-VER-09 | Verifikator lihat log sertifikat | verifikator | Buka `/certificate-logs` | Menu tidak tersedia untuk verifikator | | 🔄 |
| TC-VER-10 | Tambah catatan verifikasi | verifikator | Isi field catatan verifikasi sebelum submit | Catatan tersimpan dan tampil di log sertifikat | | 🔄 |

---

## MODUL 7 — Log Sertifikat

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-LOG-01 | Lihat log sertifikat | admin, assignor | Buka `/certificate-logs` | Tampil riwayat semua perubahan status sertifikat | | 🔄 |
| TC-LOG-02 | Log mencatat siapa yang verifikasi | admin | Cek log setelah sertifikat diverifikasi | Tercatat nama verifikator, level, waktu, dan catatan | | 🔄 |
| TC-LOG-03 | Log mencatat penolakan | admin | Cek log setelah sertifikat ditolak | Tercatat alasan reject dan kategori | | 🔄 |
| TC-LOG-04 | Calibrator tidak akses log | calibrator | Buka `/certificate-logs` | Menu tidak tampil di sidebar | | 🔄 |

---

## MODUL 8 — Manajemen Surat

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-LTR-01 | Lihat daftar surat | admin, assignor | Buka `/letters` | Tampil daftar surat kalibrasi | | 🔄 |
| TC-LTR-02 | Buat surat baru | admin, assignor | Klik "+ Buat Surat", isi semua field, simpan | Surat baru muncul di daftar | | 🔄 |
| TC-LTR-03 | Buat surat — nomor surat kosong | admin, assignor | Submit tanpa mengisi no_letter | Muncul error validasi | | 🔄 |
| TC-LTR-04 | Buat surat — instrumen tidak valid | admin, assignor | Pilih instrumen yang tidak ada di sistem | Muncul error "Instrumen tidak ditemukan" | | 🔄 |
| TC-LTR-05 | Lihat detail surat | admin, assignor | Klik "View" pada surat | Tampil halaman detail `/letters/[id]/view` | | 🔄 |
| TC-LTR-06 | Cetak surat | admin, assignor | Klik "Print" pada surat | Halaman cetak terbuka `/letters/[id]/print` | | 🔄 |
| TC-LTR-07 | Edit surat | admin, assignor | Klik edit, ubah data, simpan | Data surat terupdate | | 🔄 |
| TC-LTR-08 | Hapus surat | admin | Klik hapus, konfirmasi | Surat terhapus dari daftar | | 🔄 |
| TC-LTR-09 | Calibrator tidak bisa akses surat | calibrator | Buka `/letters` | Menu tidak tampil di sidebar | | 🔄 |

---

## MODUL 9 — Manajemen Personel

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-PER-01 | Lihat daftar personel | admin | Buka `/personel` | Tampil daftar semua pengguna + role | | 🔄 |
| TC-PER-02 | Registrasi pengguna baru | admin | Buka `/register`, isi semua field, klik Register | Akun baru terdaftar, email konfirmasi terkirim | | 🔄 |
| TC-PER-03 | Registrasi — email sudah terdaftar | admin | Daftarkan email yang sudah ada | Muncul error email sudah digunakan | | 🔄 |
| TC-PER-04 | Registrasi — password lemah | admin | Isi password kurang dari 8 karakter | Indikator kekuatan "Weak", system menolak submit | | 🔄 |
| TC-PER-05 | Registrasi — tanpa memilih role | admin | Klik Register tanpa pilih role | Muncul error role wajib dipilih | | 🔄 |
| TC-PER-06 | Registrasi user_station + assign stasiun | admin | Daftar dengan role user_station + pilih stasiun | Akun terdaftar & terhubung ke stasiun | | 🔄 |
| TC-PER-07 | Edit role personel | admin | Klik edit personel, ubah role, simpan | Role terupdate di daftar | | 🔄 |
| TC-PER-08 | Hapus personel | admin | Klik hapus, konfirmasi | Akun tidak lagi aktif di sistem | | 🔄 |
| TC-PER-09 | Non-admin tidak bisa akses manajemen personel | calibrator, verifikator | Buka `/personel` | Menu tidak tampil di sidebar / redirect | | 🔄 |

---

## MODUL 10 — Penugasan Stasiun

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-UST-01 | Lihat halaman penugasan | admin | Buka `/user-stations` | Tampil form penugasan stasiun ke user | | 🔄 |
| TC-UST-02 | Assign stasiun ke user_station | admin | Pilih user + stasiun, simpan | User berhasil ditugaskan ke stasiun | | 🔄 |
| TC-UST-03 | Assign beberapa stasiun sekaligus | admin | Pilih user + beberapa stasiun, simpan | Semua stasiun terkait ke user | | 🔄 |
| TC-UST-04 | User_station melihat stasiun tugasnya | user_station | Login lalu lihat dashboard | Hanya tampil stasiun yang ditugaskan | | 🔄 |
| TC-UST-05 | Non-admin tidak bisa akses | calibrator | Buka `/user-stations` | Menu tidak tampil / redirect | | 🔄 |

---

## MODUL 11 — Master Data

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-MD-01 | Lihat daftar master alat (instrument names) | admin, calibrator | Buka `/master-names` | Tampil daftar nama instrumen | | 🔄 |
| TC-MD-02 | Tambah nama instrumen baru | admin, calibrator | Klik "+ Tambah", isi nama & tipe, simpan | Nama baru muncul di daftar & tersedia saat tambah instrumen | | 🔄 |
| TC-MD-03 | Edit nama instrumen | admin, calibrator | Klik edit, ubah nama, simpan | Nama terupdate | | 🔄 |
| TC-MD-04 | Hapus nama instrumen | admin | Klik hapus, konfirmasi | Nama terhapus dari daftar | | 🔄 |
| TC-MD-05 | Lihat daftar Master QC | admin, calibrator | Buka `/master-qc` | Tampil daftar kriteria QC | | 🔄 |
| TC-MD-06 | Tambah rule QC baru | admin, calibrator | Klik "+ Tambah", isi parameter & batas toleransi | Rule QC baru tersimpan | | 🔄 |
| TC-MD-07 | Lihat daftar Master Satuan | admin, calibrator | Buka `/units` | Tampil daftar satuan pengukuran | | 🔄 |
| TC-MD-08 | Tambah satuan baru | admin, calibrator | Klik "+ Tambah", isi nama & simbol | Satuan baru tersimpan | | 🔄 |
| TC-MD-09 | Non-admin/calibrator tidak bisa akses | verifikator | Buka `/master-qc` | Menu tidak tampil di sidebar | | 🔄 |

---

## MODUL 12 — Profil & Pengaturan Akun

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-PRF-01 | Lihat halaman profil | Semua | Buka `/profile-settings` | Tampil form dengan data profil saat ini | | 🔄 |
| TC-PRF-02 | Update nama & nomor telepon | Semua | Ubah nama & telepon, klik Save | Data berhasil disimpan, muncul pesan sukses | | 🔄 |
| TC-PRF-03 | Update NIK melebihi 16 digit | Semua | Isi NIK dengan 17+ digit | Input terbatas 16 karakter | | 🔄 |
| TC-PRF-04 | Field Role bersifat read-only | Semua | Coba ubah field Role | Field tidak bisa diedit (disabled) | | 🔄 |
| TC-PRF-05 | Submit profil dengan nama kosong | Semua | Hapus nama lalu klik Save | Muncul error validasi | | 🔄 |

---

## MODUL 13 — Role & Izin

| ID | Skenario | Role | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|------|-------------|-----------------|---------------|--------|
| TC-RP-01 | Lihat matriks izin | admin | Buka `/role-permissions` | Tampil tabel CRUD per role × resource | | 🔄 |
| TC-RP-02 | Ubah izin create untuk calibrator | admin | Centang/hilangkan izin create, klik simpan | Izin tersimpan, berlaku pada sesi berikutnya | | 🔄 |
| TC-RP-03 | Filter berdasarkan role | admin | Ketik "calibrator" di pencarian | Tabel difilter hanya row role calibrator | | 🔄 |
| TC-RP-04 | Auto refresh aktif | admin | Aktifkan toggle Auto Refresh | Data otomatis diperbarui tiap 30 detik | | 🔄 |
| TC-RP-05 | Non-admin tidak bisa akses | calibrator | Buka `/role-permissions` | Halaman tidak bisa diakses / redirect | | 🔄 |

---

## MODUL 14 — Kontrol Akses (RBAC)

*Pengujian cross-role untuk memastikan isolasi akses antar peran*

| ID | Skenario | Role Pengujian | Aksi | Expected Result | Actual Result | Status |
|----|----------|---------------|------|-----------------|---------------|--------|
| TC-RBAC-01 | Calibrator tidak bisa akses menu Admin | calibrator | Coba buka `/role-permissions`, `/register`, `/user-stations` | Semua redirect / menu tidak tampil | | 🔄 |
| TC-RBAC-02 | Verifikator tidak bisa buat sertifikat | verifikator | Coba POST `/api/certificates` | HTTP 403 Forbidden | | 🔄 |
| TC-RBAC-03 | User_station hanya lihat data stasiun sendiri | user_station | Cek data instrumen & sertifikat | Hanya tampil data stasiun yang ditugaskan | | 🔄 |
| TC-RBAC-04 | Assignor tidak bisa akses master data | assignor | Buka `/master-qc`, `/units`, `/master-names` | Menu tidak tampil di sidebar | | 🔄 |
| TC-RBAC-05 | API tanpa token ditolak | - | Akses `/api/stations` tanpa Authorization header | HTTP 401 Unauthorized | | 🔄 |
| TC-RBAC-06 | API dengan token expired ditolak | Semua | Gunakan token lama yang sudah expired | HTTP 401 Unauthorized | | 🔄 |

---

## MODUL 15 — Alur Kerja End-to-End

*Skenario integrasi full workflow dari awal hingga akhir*

| ID | Skenario | Aktor | Langkah Uji | Expected Result | Actual Result | Status |
|----|----------|-------|-------------|-----------------|---------------|--------|
| TC-E2E-01 | Alur kalibrasi lengkap | calibrator → verifikator L1 → L2 → assignor L3 | 1. Calibrator buat & ajukan sertifikat → 2. Verifikator L1 setujui → 3. Verifikator L2 setujui → 4. Assignor L3 setujui | Status akhir = Selesai, sertifikat bisa dicetak | | 🔄 |
| TC-E2E-02 | Alur penolakan & revisi | calibrator → verifikator → calibrator | 1. Calibrator ajukan → 2. Verifikator tolak dengan alasan → 3. Calibrator revisi & ajukan ulang | Sertifikat kembali ke antrean verifikasi | | 🔄 |
| TC-E2E-03 | Registrasi user baru end-to-end | admin → user baru | 1. Admin daftarkan user baru → 2. User login → 3. Admin assign stasiun | User bisa login & melihat data stasiun yang ditugaskan | | 🔄 |
| TC-E2E-04 | Pembuatan sertifikat dengan Excel | calibrator | 1. Buat sertifikat → 2. Upload Excel → 3. Hitung uncertainty → 4. Ajukan | Data raw terbaca, kalkulasi berhasil, sertifikat terajukan | | 🔄 |
| TC-E2E-05 | Pembuatan surat kalibrasi | assignor | 1. Buat surat → 2. Pilih instrumen & hasil inspeksi → 3. Simpan → 4. Cetak | Surat tersimpan dan halaman cetak tampil dengan benar | | 🔄 |

---

## Catatan Pelaksanaan Pengujian

| Informasi | Detail |
|-----------|--------|
| **Environment** | Production — `http://172.19.3.171` |
| **Supabase** | Self-hosted `http://172.19.3.171:8000` |
| **Browser yang diuji** | Chrome / Firefox / Edge |
| **Penguji** | |
| **Tanggal Mulai** | |
| **Tanggal Selesai** | |
| **Total Test Case** | 97 |
| **Pass** | |
| **Fail** | |
| **Pending** | 97 |

---

*Dokumen ini digunakan untuk pelaksanaan System Integration Testing (SIT) dan User Acceptance Testing (UAT) SIMKAL v1.0.*
