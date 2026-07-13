# Laporan Bulanan Kegiatan Pembangunan Sistem Informasi Layanan Kalibrasi (SILK) MKG

## Periode: Mei 2026

---

## Pendahuluan

Pada bulan Mei 2026, pengembangan SILK berfokus pada integrasi layanan komunikasi (WhatsApp dan Email), penyempurnaan template sertifikat, dan perbaikan stabilitas sistem.

## Tujuan

- Meningkatkan efisiensi dan akurasi proses pengolahan data kalibrasi serta penerbitan sertifikat kalibrasi melalui sistem berbasis website.
- Mewujudkan pengelolaan data kalibrasi yang terintegrasi, terpusat, dan aman antar unit terkait.
- Mendukung transformasi digital layanan kalibrasi MKG agar lebih modern, andal, dan berkelanjutan.

## Hasil Kegiatan

Progres pembangunan sistem Informasi layanan kalibrasi (SILK) telah membuat beberapa fitur selama bulan Mei 2026 sebagai berikut:

### 1. Integrasi Layanan WhatsApp (WA Service)

- Pengembangan dan integrasi layanan WhatsApp untuk notifikasi otomatis.
- Notifikasi pengiriman sertifikat ke pemilik alat.
- Notifikasi status verifikasi sertifikat.
- Konfigurasi dan pengujian WA Service.

### 2. Integrasi Layanan Email (Brevo)

- Implementasi email konfirmasi menggunakan layanan Brevo.
- Template email untuk notifikasi penugasan kalibrasi.
- Template email untuk status sertifikat (diterima/ditolak).
- Pengujian pengiriman email otomatis.

### 3. Fitur Template Sertifikat

- Pengembangan fitur template sertifikat kalibrasi.
- Kemampuan untuk mengustomisasi tampilan sertifikat.
- Penyimpanan dan manajemen template.

### 4. Penyempurnaan Master Instrumen

- Update master instrumen untuk mendukung data yang lebih lengkap.
- Perbaikan relasi antara instrumen dan sensor.
- Penyimpanan riwayat sertifikat standar.

### 5. Perbaikan Stabilitas Sistem

- Fix build error pada production.
- Perbaikan session storage.
- Update dan perbaikan bug minor.

## Komit Git (Mei 2026)

| Tanggal | Komit | Deskripsi |
|---------|-------|-----------|
| 31 Mei | 6f389f1 | update |
| 28 Mei | 4870634 | update master instrumen |
| 27 Mei | ae25b9c | update terbaru |
| 25 Mei | 93d0677 | update load dashboard user |
| 22 Mei | 41b9e6a | update fitur template certificate dan wa service |
| 21 Mei | 8858447 | update wa-service |
| 20 Mei | 9210e0b | fix run build di production |
| 19 Mei | 91a9eb4 | update wa service dan notifikasi email |
| 15 Mei | 7bbb7a0 | update session storage |
| 12 Mei | 07178d0 | update email konfirmasi using brevo |
| 10 Mei | 345e50e | perbaiki bug |
| 8 Mei | 3919b68 | update fix simkal to master |

## Tantangan

| Tantangan | Solusi |
|-----------|--------|
| Integrasi WhatsApp API | Pengembangan modul WA Service terpisah |
| Konfigurasi email Brevo | Setup template dan testing pengiriman |
| Build error di production | Perbaikan dependency dan konfigurasi |

## Rencana Bulan Depan

- Perbaikan tampilan sertifikat dan LHKS.
- Update format LaTeX pada sertifikat.
- Penyempurnaan CRUD instrumen dan sensor.
- Perbaikan master QC data.

---

*Dokumen ini disusun oleh Tim Pengembangan SILK MKG*
*Terakhir diperbarui: Mei 2026*
