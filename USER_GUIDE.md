# Panduan Pengguna SIMKAL
## Sistem Informasi Manajemen Kalibrasi — BMKG

> **Versi:** 1.0  
> **Terakhir diperbarui:** 2025  
> **Akses Aplikasi:** `http://localhost:3000` (development) atau URL produksi yang disediakan administrator

---

## Daftar Isi

1. [Pengenalan Sistem](#1-pengenalan-sistem)
2. [Peran & Hak Akses](#2-peran--hak-akses)
3. [Login & Autentikasi](#3-login--autentikasi)
4. [Dashboard](#4-dashboard)
5. [Manajemen Instrumen](#5-manajemen-instrumen)
6. [Manajemen Stasiun](#6-manajemen-stasiun)
7. [Manajemen Sertifikat](#7-manajemen-sertifikat)
8. [Verifikasi Sertifikat](#8-verifikasi-sertifikat)
9. [Surat](#9-surat)
10. [Manajemen Personel](#10-manajemen-personel)
11. [Penugasan Stasiun](#11-penugasan-stasiun)
12. [Master Data](#12-master-data)
13. [Pengaturan Akun & Profil](#13-pengaturan-akun--profil)
14. [Manajemen Role & Izin](#14-manajemen-role--izin)
15. [Alur Kerja Lengkap (Workflow)](#15-alur-kerja-lengkap-workflow)
16. [Troubleshooting Umum](#16-troubleshooting-umum)

---

## 1. Pengenalan Sistem

**SIMKAL** (Sistem Informasi Manajemen Kalibrasi) adalah platform web berbasis Next.js untuk mengelola seluruh proses kalibrasi peralatan meteorologi di lingkungan BMKG. Sistem ini mencakup:

- Pencatatan dan pengelolaan instrumen dan sensor
- Pembuatan sertifikat kalibrasi (UUT dan Standar)
- Alur verifikasi multi-level (3 tahap)
- Penandatanganan digital sertifikat via BSRE
- Pemantauan masa berlaku sertifikat per stasiun
- Penerbitan surat kalibrasi
- Manajemen pengguna berbasis peran (RBAC)

---

## 2. Peran & Hak Akses

Sistem menggunakan 5 peran yang masing-masing memiliki akses berbeda:

| Peran | Deskripsi | Akses Utama |
|-------|-----------|-------------|
| **admin** | Administrator sistem | Semua fitur, manajemen user & role |
| **calibrator** | Teknisi kalibrasi | Instrumen, stasiun, sertifikat, master data |
| **verifikator** | Pejabat verifikasi | Verifikasi sertifikat, tanda tangan |
| **assignor** | Pejabat penugasan | Verifikasi sertifikat, surat, log sertifikat |
| **user_station** | Pengguna stasiun | Lihat instrumen & sertifikat stasiun sendiri |

### Ringkasan Menu per Peran

| Menu | admin | calibrator | verifikator | assignor | user_station |
|------|-------|-----------|-------------|----------|--------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Instrumen | ✅ | ✅ | ❌ | ❌ | ✅ (lihat) |
| Stasiun | ✅ | ✅ | ❌ | ❌ | ✅ (lihat) |
| Sertifikat | ✅ | ✅ | ❌ | ❌ | ✅ (lihat) |
| Verifikasi Sertifikat | ❌ | ❌ | ✅ | ✅ | ❌ |
| Log Sertifikat | ✅ | ❌ | ❌ | ✅ | ❌ |
| Surat | ✅ | ❌ | ❌ | ✅ | ❌ |
| Manajemen Personel | ✅ | ❌ | ❌ | ❌ | ❌ |
| Penugasan Stasiun | ✅ | ❌ | ❌ | ❌ | ❌ |
| Master Data | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 3. Login & Autentikasi

### 3.1 Login

1. Buka aplikasi di browser, Anda akan diarahkan ke halaman `/login`
2. Masukkan **Email** dan **Password** yang telah diberikan administrator
3. Klik tombol **Sign In**
4. Jika berhasil, sistem akan menyapa Anda dan mengarahkan ke Dashboard

> **Catatan:** Akun harus terdaftar di tabel personel. Jika muncul pesan *"User not found in system"*, hubungi administrator.

### 3.2 Lupa Password

1. Di halaman login, klik link **Lupa Password** (atau kunjungi `/forgot-password`)
2. Masukkan alamat **email** akun Anda
3. Klik **Kirim Link Reset**
4. Buka email dan klik tautan reset yang diterima
5. Anda akan diarahkan ke halaman `/reset-password`
6. Masukkan **password baru** dan konfirmasi, lalu simpan

### 3.3 Logout

Klik ikon/tombol **Logout** di pojok kanan atas header untuk keluar dari sistem.

---

## 4. Dashboard

Dashboard menampilkan ringkasan kerja yang disesuaikan dengan peran Anda secara otomatis.

### 4.1 Dashboard Admin / Calibrator

Menampilkan:
- **Kartu Statistik** — Total sertifikat, instrumen, draft, dan item yang memerlukan aksi
- **Butuh Aksi Saya** — Daftar pekerjaan prioritas yang menunggu tindak lanjut
- **Antrean Tahap** — Distribusi sertifikat berdasarkan status (draft, diajukan, diverifikasi, selesai)
- **Ringkasan Reject** — Riwayat penolakan sertifikat terbaru

### 4.2 Dashboard Verifikator / Assignor

Menampilkan:
- Sertifikat yang menunggu verifikasi di level yang relevan
- Ringkasan antrean pekerjaan yang perlu ditindaklanjuti

### 4.3 Dashboard User Station

Menampilkan ringkasan khusus stasiun yang ditugaskan:
- **Total Instrumen Terdaftar** di stasiun
- **Masa Berlaku Valid** — Jumlah instrumen dengan sertifikat aktif
- **Menunggu Kalibrasi** — Sertifikat kadaluarsa atau mendekati jatuh tempo (< 30 hari)
- **Instrumen Aktif**
- **Tabel Sertifikat UUT Jatuh Tempo** — 5 sertifikat terdekat masa berlakunya
- **Grafik Tren Koreksi** — Analisis nilai koreksi dan uncertainty historis per instrumen

---

## 5. Manajemen Instrumen

Akses: menu **Instrumen** di sidebar  
URL: `/instruments`  
Tersedia untuk: `admin`, `calibrator`, `user_station`

### 5.1 Melihat Daftar Instrumen

- Gunakan **kolom pencarian** untuk filter berdasarkan nama, kode, atau nomor seri
- Filter **Tipe**: semua / UUT (Unit Under Test) / Standar
- Klik header kolom untuk mengurutkan data

### 5.2 Menambah Instrumen Baru

1. Klik tombol **+ Tambah Instrumen**
2. Isi formulir:
   - **Nama Instrumen** — pilih dari daftar master, atau ketik nama baru
   - **Kode Alat** — kode unik alat (contoh: `AWS-001`)
   - **Nomor Seri** — nomor seri pabrikan
   - **Pabrikan / Merek**
   - **Tipe** — UUT atau Standar
   - **Stasiun** — stasiun tempat alat berada
   - **Tanggal Pembelian** (opsional)
3. Klik **Simpan**

### 5.3 Mengedit Instrumen

1. Klik ikon **Edit** (pensil) di baris instrumen yang ingin diubah
2. Ubah data yang diperlukan
3. Klik **Simpan**

### 5.4 Menghapus Instrumen

1. Klik ikon **Hapus** (tempat sampah) di baris instrumen
2. Konfirmasi penghapusan pada dialog yang muncul

> **Perhatian:** Instrumen yang sudah terkait dengan sertifikat tidak dapat dihapus sembarangan.

### 5.5 Sensor pada Instrumen

Setiap instrumen dapat memiliki satu atau lebih **sensor** yang dikaitkan. Klik baris instrumen untuk melihat detail sensor terkait.

---

## 6. Manajemen Stasiun

Akses: menu **Stasiun** di sidebar  
URL: `/stations`  
Tersedia untuk: `admin`, `calibrator`, `user_station`

### 6.1 Melihat Daftar Stasiun

- Gunakan kotak pencarian untuk filter berdasarkan nama, WMO ID, provinsi, atau kabupaten
- Informasi yang ditampilkan: nama stasiun, WMO ID, alamat, wilayah, tipe

### 6.2 Menambah Stasiun Baru

1. Klik tombol **+ Tambah Stasiun**
2. Isi formulir (field wajib ditandai `*`):
   - **WMO ID** — ID WMO stasiun (opsional)
   - **Nama Stasiun** `*`
   - **Alamat** `*`
   - **Latitude / Longitude** — koordinat GPS
   - **Elevasi** — ketinggian dalam meter
   - **Zona Waktu** `*` — contoh: `UTC+07:00`
   - **Wilayah / Region** `*`
   - **Provinsi** `*`
   - **Kabupaten/Kota** `*`
   - **Tipe Stasiun** `*` — contoh: `AWS`, `SYNOP`, dll.
3. Klik **Simpan**

### 6.3 Edit & Hapus Stasiun

Gunakan ikon **Edit** dan **Hapus** pada baris stasiun terkait.

---

## 7. Manajemen Sertifikat

Akses: menu **Sertifikat** di sidebar  
URL: `/certificates`  
Tersedia untuk: `admin`, `calibrator`, `user_station` (hanya lihat)

### 7.1 Melihat Daftar Sertifikat

Daftar sertifikat menampilkan:
- Nomor sertifikat, nomor identifikasi
- Instrumen terkait
- Tanggal terbit
- Status verifikasi (Draft, Diajukan, Diverifikasi L1, L2, L3, Selesai, Ditolak)
- Aksi yang tersedia

Filter tersedia: berdasarkan stasiun, status, tipe sertifikat, rentang tanggal.

### 7.2 Membuat Sertifikat Baru

1. Klik tombol **+ Buat Sertifikat**
2. Isi informasi dasar:
   - **No. Identifikasi** `*` — nomor unik identifikasi sertifikat
   - **Tanggal Terbit** `*`
   - **Kode Instrumen** `*` — pilih dari daftar instrumen
   - **Tempat Kalibrasi** `*` — `FC` (Field Calibration) atau `LC` (Laboratory Calibration)
   - **Tipe Sertifikat** `*` — `sert` (Sertifikat) atau `lap` (Laporan)
   - **Verifikator Level 1, 2, 3** — pilih personel yang akan memverifikasi
3. Isi data kalibrasi:
   - **Sesi Kalibrasi** — pilih sesi yang sudah dibuat, atau buat baru
   - **Data Mentah (Raw Data)** — upload file Excel atau input manual
   - **Hasil Kalibrasi** — nilai koreksi, uncertainty, setpoint
4. Isi catatan dan standar:
   - **Catatan Kalibrasi** — metode, referensi, ketertelusuran
   - **Instrumen Standar** — alat standar yang digunakan
5. Klik **Simpan sebagai Draft** untuk menyimpan tanpa mengajukan, atau **Ajukan untuk Verifikasi**

### 7.3 Upload Raw Data via Excel

1. Di formulir sertifikat, klik tab **Raw Data**
2. Klik **Upload File Excel**
3. Pilih file `.xlsx` atau `.xls` yang berisi data pengukuran
4. Sistem akan mem-parsing data secara otomatis per sheet
5. Periksa dan koreksi jika diperlukan sebelum menyimpan

### 7.4 Hitung Ketidakpastian (Uncertainty)

1. Setelah data mentah diisi, klik **Hitung Ketidakpastian**
2. Modal **Uncertainty Calculator** akan terbuka
3. Sistem menghitung secara otomatis berdasarkan data yang tersedia
4. Hasil (koreksi, U95, expanded uncertainty) akan tersimpan di sertifikat

### 7.5 Melihat & Mencetak Sertifikat

- Klik **View** pada baris sertifikat untuk melihat tampilan sertifikat (URL: `/certificates/[id]/view`)
- Klik **Print** untuk mencetak dalam format PDF (URL: `/certificates/[id]/print`)

### 7.6 Alur Status Sertifikat

```
Draft → Diajukan → Diverifikasi L1 → Diverifikasi L2 → Diverifikasi L3 → Selesai
                ↘ Ditolak (dapat direvisi dan diajukan ulang)
```

### 7.7 Log Sertifikat

Akses: menu **Log Sertifikat**  
URL: `/certificate-logs`  
Tersedia untuk: `admin`, `assignor`

Menampilkan riwayat seluruh perubahan status sertifikat, termasuk siapa yang melakukan verifikasi atau penolakan, beserta catatan alasan.

---

## 8. Verifikasi Sertifikat

Akses: menu **Verifikasi Sertifikat**  
URL: `/certificate-verification`  
Tersedia untuk: `verifikator`, `assignor`

### 8.1 Alur Verifikasi 3 Level

Sistem menggunakan proses verifikasi bertahap:

| Level | Dilakukan oleh | Tindakan |
|-------|---------------|----------|
| **Level 1** | Verifikator 1 | Review teknis awal |
| **Level 2** | Verifikator 2 | Review dan persetujuan lanjutan |
| **Level 3** | Assignor / Kepala | Persetujuan akhir & pengesahan |

### 8.2 Langkah Verifikasi

1. Di halaman Verifikasi Sertifikat, klik sertifikat yang perlu ditinjau
2. Periksa detail sertifikat: data instrumen, hasil kalibrasi, catatan
3. Pilih tindakan:
   - **Setujui** — sertifikat lolos verifikasi level ini
   - **Tolak** — masukkan alasan penolakan dan kategori kesalahan
4. Tambahkan **catatan verifikasi** jika diperlukan
5. Klik **Submit Verifikasi**

### 8.3 Penolakan (Reject)

Saat menolak sertifikat, wajib mengisi:
- **Alasan Penolakan** — deskripsi jelas mengapa ditolak
- **Kategori Penolakan** — pilih dari daftar yang tersedia (misal: data tidak lengkap, kesalahan perhitungan, dll.)

Sertifikat yang ditolak akan kembali ke status **Ditolak** dan dapat diperbaiki oleh calibrator untuk diajukan ulang.

### 8.4 Verifikasi Hasil Inspeksi

URL: `/verifikator-inspection-results`  
Untuk verifikasi hasil inspeksi alat (surat kalibrasi lapangan).

### 8.5 Verifikasi Hasil Kalibrasi

URL: `/verifikator-cal-result`  
Untuk verifikasi hasil kalibrasi yang sudah dilengkapi oleh calibrator.

---

## 9. Surat

Akses: menu **Surat** di sidebar  
URL: `/letters`  
Tersedia untuk: `admin`, `assignor`

### 9.1 Daftar Surat

Menampilkan semua surat kalibrasi yang telah dibuat, dengan informasi:
- Nomor surat
- Instrumen terkait
- Pemilik / Stasiun
- Tanggal terbit
- Status verifikasi

### 9.2 Membuat Surat Baru

1. Klik **+ Buat Surat**
2. Isi formulir:
   - **Nomor Surat** `*`
   - **Instrumen** `*` — pilih dari daftar
   - **Pemilik (Stasiun)** `*`
   - **Tanggal Terbit** `*`
   - **Hasil Inspeksi** — pilih hasil inspeksi terkait
   - **Disahkan Oleh** `*` — pilih personel yang berwenang
   - **Nama Penandatangan**
3. Klik **Simpan**

### 9.3 Melihat & Mencetak Surat

- Klik **View** untuk melihat tampilan surat (URL: `/letters/[id]/view`)
- Klik **Print** untuk mencetak dalam format PDF (URL: `/letters/[id]/print`)

---

## 10. Manajemen Personel

Akses: menu **Manajemen Personel**  
URL: `/personel`  
Tersedia untuk: `admin` saja

### 10.1 Daftar Personel

Menampilkan semua pengguna sistem beserta peran (role) yang dimiliki.

### 10.2 Registrasi Pengguna Baru

URL: `/register`

1. Klik **+ Registrasi Pengguna**
2. Isi **Informasi Personel**:
   - **Nama Lengkap** `*`
   - **NIP** — Nomor Induk Pegawai (opsional)
   - **Nomor Telepon** (opsional)
3. Isi **Akun & Akses**:
   - **Email** `*` — email login (undangan konfirmasi akan dikirim)
   - **Password** `*` — minimal 8 karakter (campuran huruf besar, kecil, angka, simbol)
   - **Role** `*` — pilih: Admin / Calibrator / Verifikator / Assignor / User Station
   - **Stasiun** — khusus role `user_station`, pilih stasiun yang terkait
4. Klik **Register**

> **Tips Keamanan Password:** Indikator kekuatan password akan muncul saat Anda mengetik. Gunakan password kuat (Strong/Very Strong).

### 10.3 Edit & Hapus Personel

Gunakan ikon **Edit** untuk mengubah data personel (nama, NIP, telepon, role).  
Gunakan ikon **Hapus** untuk menonaktifkan akun.

---

## 11. Penugasan Stasiun

Akses: menu **Penugasan Stasiun**  
URL: `/user-stations`  
Tersedia untuk: `admin` saja

### 11.1 Menugaskan Stasiun ke Pengguna

1. Pilih **Pengguna** dari dropdown
2. Pilih satu atau beberapa **Stasiun** yang akan ditugaskan
3. Klik **Simpan Penugasan**

> Fitur ini terutama digunakan untuk role `user_station` agar pengguna hanya dapat melihat data stasiun yang relevan dengan tugasnya.

---

## 12. Master Data

Akses: bagian **Master Data** di sidebar  
Tersedia untuk: `admin`, `calibrator`

### 12.1 Daftar Alat (Master Names)

URL: `/master-names`

Berisi daftar nama instrumen dan sensor yang digunakan sebagai referensi saat menambah instrumen baru.

- **Tambah** nama instrumen baru: klik `+ Tambah`, isi nama dan tipe
- **Edit** dan **Hapus** menggunakan ikon di setiap baris

### 12.2 Master QC

URL: `/master-qc`

Berisi kriteria Quality Control untuk setiap tipe instrumen.

- **Tambah QC Rule**: klik `+ Tambah`, isi parameter dan batas toleransi
- **Edit** dan **Hapus** sesuai kebutuhan

### 12.3 Master Satuan (Units)

URL: `/units`

Berisi daftar satuan pengukuran (°C, mm, hPa, dll.) yang digunakan dalam data kalibrasi.

- **Tambah Satuan**: klik `+ Tambah`, isi nama dan simbol satuan
- **Edit** dan **Hapus** sesuai kebutuhan

---

## 13. Pengaturan Akun & Profil

### 13.1 Pengaturan Profil

URL: `/profile-settings`

Akses melalui ikon profil / nama pengguna di header.

Field yang dapat diubah:
- **Nama Lengkap** `*`
- **Email** `*`
- **NIP** — Nomor Induk Pegawai
- **NIK** — Nomor Induk Kependudukan (maks. 16 digit)
- **Nomor Telepon**

> **Catatan:** Role/jabatan bersifat read-only di halaman ini. Hanya administrator yang dapat mengubah role melalui halaman Personel.

Klik **Save Changes** untuk menyimpan perubahan.

### 13.2 Pengaturan Akun

URL: `/account-settings`

Berisi opsi pengaturan akun tambahan seperti preferensi notifikasi dan keamanan akun.

---

## 14. Manajemen Role & Izin

Akses: URL `/role-permissions`  
Tersedia untuk: `admin` saja

### 14.1 Melihat Matriks Izin

Halaman ini menampilkan tabel izin CRUD (Create, Read, Update, Delete) untuk setiap kombinasi **Role × Resource**.

### 14.2 Mengubah Izin

1. Gunakan kotak **Pencarian** untuk filter berdasarkan role atau nama resource
2. Centang/hapus centang pada kolom `create`, `read`, `update`, `delete` untuk izin yang ingin diubah
3. Klik **Simpan Perubahan**

> **Auto Refresh:** Aktifkan toggle Auto Refresh agar halaman memperbarui data secara otomatis setiap 30 detik.

---

## 15. Alur Kerja Lengkap (Workflow)

### Alur Kalibrasi Standard (Utama)

```
1. [Calibrator] Tambah Instrumen ke Stasiun
        ↓
2. [Calibrator] Buat Sesi Kalibrasi (tanggal, lokasi)
        ↓
3. [Calibrator] Buat Sertifikat → Upload Raw Data Excel
        ↓
4. [Calibrator] Hitung Ketidakpastian (Uncertainty Calculator)
        ↓
5. [Calibrator] Isi Catatan Kalibrasi & Instrumen Standar
        ↓
6. [Calibrator] Ajukan ke Verifikasi (Submit)
        ↓
7. [Verifikator L1] Review → Setujui atau Tolak
        ↓ (jika disetujui)
8. [Verifikator L2] Review → Setujui atau Tolak
        ↓ (jika disetujui)
9. [Assignor L3] Review Final → Setujui → Sertifikat Selesai
        ↓
10. [Assignor] Cetak / Unduh Sertifikat PDF
```

### Alur Penolakan & Revisi

```
[Verifikator] Tolak Sertifikat (isi alasan & kategori)
        ↓
[Calibrator] Terima Notifikasi Reject
        ↓
[Calibrator] Buka Sertifikat → Edit & Perbaiki
        ↓
[Calibrator] Ajukan Ulang → kembali ke alur verifikasi
```

### Alur Registrasi Pengguna Baru

```
[Admin] Buka /register
        ↓
[Admin] Isi Data Personel + Email + Password + Role
        ↓
[Sistem] Kirim email konfirmasi ke pengguna baru
        ↓
[Pengguna Baru] Klik link konfirmasi di email
        ↓
[Pengguna Baru] Login dengan email & password yang diberikan
        ↓
[Admin] Tugaskan Stasiun jika role = user_station (/user-stations)
```

---

## 16. Troubleshooting Umum

### ❌ "User not found in system" saat login
**Penyebab:** Akun Supabase auth ada, tetapi belum terdaftar di tabel `personel`.  
**Solusi:** Hubungi administrator untuk mendaftarkan akun di tabel personel, atau gunakan halaman `/register` untuk membuat ulang akun.

### ❌ Menu tidak muncul di sidebar
**Penyebab:** Role belum ditetapkan atau tidak memiliki izin untuk menu tersebut.  
**Solusi:** Minta administrator memeriksa role di halaman Manajemen Personel atau Role Permissions.

### ❌ Sertifikat tidak bisa diajukan
**Penyebab umum:**
- Verifikator L1/L2/L3 belum dipilih
- Data instrumen tidak valid (nomor identifikasi kosong)
- Sesi kalibrasi belum dibuat

**Solusi:** Periksa kelengkapan semua field wajib sebelum mengajukan.

### ❌ Upload Excel gagal / data tidak terbaca
**Penyebab:** Format file tidak sesuai atau kolom tidak dikenali sistem.  
**Solusi:** Pastikan file dalam format `.xlsx` dan kolom data sesuai template yang disediakan (sheet_name, point_uut, point_std, unit_uut, unit_std).

### ❌ Halaman loading terus / tidak muncul data
**Penyebab:** Koneksi ke Supabase terputus atau token sesi kedaluwarsa.  
**Solusi:** 
1. Refresh halaman (`F5`)
2. Logout lalu login kembali
3. Jika masih error, hubungi administrator untuk memeriksa konfigurasi server

### ❌ Tidak bisa mengubah role di Profile Settings
**Penyebab:** Ini by design — role hanya bisa diubah oleh admin.  
**Solusi:** Minta administrator mengubah role melalui halaman `/personel`.

---

## Informasi Kontak & Dukungan

Untuk kendala teknis atau pertanyaan penggunaan sistem, hubungi:

- **Administrator Sistem** — melalui email instansi atau saluran komunikasi internal BMKG
- **Dokumentasi API** — tersedia di file `API_DOCUMENTATION.md` (untuk developer)

---

*Dokumen ini merupakan panduan penggunaan resmi SIMKAL versi 1.0. Untuk perubahan atau pembaruan fitur, panduan ini akan diperbarui secara berkala.*
