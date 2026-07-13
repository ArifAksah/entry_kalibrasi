# Laporan Bulanan Kegiatan Pembangunan Sistem Informasi Layanan Kalibrasi (SILK) MKG

## Periode: Juli 2026

---

## Pendahuluan

Pada bulan Juli 2026, pengembangan SILK berfokus pada implementasi fitur kalibrasi pyranometer, termasuk deteksi otomatis, perhitungan Faktor Kalibrasi (CF), dan integrasi ke seluruh modul sistem.

## Tujuan

- Meningkatkan efisiensi dan akurasi proses pengolahan data kalibrasi serta penerbitan sertifikat kalibrasi melalui sistem berbasis website.
- Mewujudkan pengelolaan data kalibrasi yang terintegrasi, terpusat, dan aman antar unit terkait.
- Mendukung transformasi digital layanan kalibrasi MKG agar lebih modern, andal, dan berkelanjutan.

## Hasil Kegiatan

Progres pembangunan sistem Informasi layanan kalibrasi (SILK) telah membuat beberapa fitur selama bulan Juli 2026 sebagai berikut:

### 1. Implementasi Deteksi Otomatis Pyranometer

- Pengembangan fungsi `isPyranometer()` untuk mendeteksi jenis sensor pyranometer secara otomatis.
- Deteksi berdasarkan kombinasi:
  - **instrument_code**: Kode 'SR' untuk Solar Radiation
  - **Keyword matching**: Deteksi berdasarkan nama sensor (pyranometer, CMP22, CMP21, CMP11, CMP10, CMP6, CMP3, MS-802, dll)
- Mendukung deteksi untuk berbagai tipe pyranometer dari berbagai manufacturer.

### 2. Implementasi Perhitungan Faktor Kalibrasi (CF)

- Pengembangan fungsi `calculateCalibrationFactor()` untuk menghitung Faktor Kalibrasi (CF).
- Formula: **CF = Standar / UUT** (rasio, bukan selisih).
- Fitur **filter outlier otomatis** menggunakan metode 2× standar deviasi.
- Perhitungan CF final (rata-rata setelah filter outlier).

### 3. Implementasi Klasifikasi ISO 9060:2018

- Pengembangan fungsi `getISO9060Class()` untuk klasifikasi pyranometer berdasarkan standar ISO 9060:2018.
- Klasifikasi drift:

| Class | Drift | Contoh Sensor |
|-------|-------|---------------|
| A | 0.8% | CMP22, CMP21, CMP11, CMP10 |
| B | 1.5% | CMP6 |
| C | 3.0% | CMP3, SPLite2, QMS102, QMS101 |

### 4. Implementasi Perhitungan Ketidakpastian Pyranometer

- Pengembangan fungsi `calculatePyranometerUncertainty()` untuk menghitung ketidakpastian dalam satuan persen (%).
- Komponen ketidakpastian:

| No | Komponen | Formula | Distribusi |
|----|----------|---------|------------|
| 1 | Repeatability | (Std Dev CF / CF_final) × 100% | Normal |
| 2 | Sertifikat Standar | U95 dari sertifikat (%) | Normal |
| 3 | Resolusi Standar | (resolusi / range) × 100% | Rectangular |
| 4 | Drift Standar | ISO 9060:2018 (%) | Rectangular |
| 5 | Resolusi UUT | (resolusi / range) × 100% | Rectangular |

### 5. Integrasi ke Seluruh Modul Sistem

#### a. QC Check Data Modal

- Penambahan kolom **Faktor Kalibrasi (CF)** pada tabel QC Check Data.
- Format CF menggunakan **2 angka desimal** (sesuai standar Excel).
- Penambahan statistik kalibrasi (rata-rata, standar deviasi, max, min).
- Penyembunyian kolom yang tidak relevan untuk pyranometer.

#### b. LHKS Report

- Penyesuaian header tabel LHKS untuk pyranometer:
  - No, Std Reading, Faktor Kalibrasi, UUT Reading
- Penambahan statistik kalibrasi pada bagian bawah tabel.
- Format angka menggunakan **2 desimal**.

#### c. Uncertainty Modal

- Penyesuaian tampilan uncertainty budget untuk pyranometer.
- Semua komponen ketidakpastian ditampilkan dalam satuan **%**.

#### d. Sertifikat (View, Print, Draft)

- Penyesuaian header sertifikat:
  - Penunjukkan Alat / Instrument Reading (W/m²)
  - Faktor Kalibrasi / Calibration Factor
  - Ketidakpastian / Uncertainty
- Update pada semua halaman: view, print, dan draft.

### 6. Perbaikan Bug

| No | Bug | Solusi |
|----|-----|--------|
| 1 | Error duplicate key pada LHKS Report | Menggunakan kombinasi `id-index` untuk key |
| 2 | Tampilan "FALSE" pada kolom koreksi | Mengganti dengan "0" |
| 3 | Data tidak tersimpan dengan benar | Perbaikan logic penyimpanan |
| 4 | Header sertifikat salah | Update kode penyimpanan |
| 5 | Info "HASIL KALIBRASI PYRANOMETER" | Penghapusan dari Uncertainty Modal |

### 7. Dokumentasi Teknis

- Penyusunan dokumentasi teknis untuk implementasi pyranometer.
- File dokumentasi: `PYRANOMETER_CALIBRATION.md`
- Pembuatan laporan bulanan April - Juli 2026.

## Komit Git (Juli 2026)

| Tanggal | Komit | Deskripsi |
|---------|-------|-----------|
| 7 Jul | 6b5c3b8 | update pyranometer |
| 7 Jul | b2b5d1b | update pyranometer header |
| 6 Jul | 2875a3e | update pyranometer |

## Tantangan

| Tantangan | Solusi |
|-----------|--------|
| Perbedaan metode perhitungan pyranometer | Implementasi fungsi terpisah yang tidak mempengaruhi sistem existing |
| Backward compatibility | Penambahan fungsi baru tanpa mengubah existing |
| Konsistensi format data | Standarisasi 2 desimal untuk CF dan U95% |
| Integrasi multi-halaman | Update view, print, dan draft secara konsisten |

## Ringkasan Fitur Pyranometer

| No | Fitur | Status |
|----|-------|--------|
| 1 | Deteksi otomatis pyranometer | ✅ Selesai |
| 2 | Perhitungan Faktor Kalibrasi (CF) | ✅ Selesai |
| 3 | Klasifikasi ISO 9060:2018 | ✅ Selesai |
| 4 | Perhitungan ketidakpastian (%) | ✅ Selesai |
| 5 | Integrasi QC Check Data | ✅ Selesai |
| 6 | Integrasi LHKS Report | ✅ Selesai |
| 7 | Integrasi Uncertainty Modal | ✅ Selesai |
| 8 | Integrasi Sertifikat (view/print/draft) | ✅ Selesai |
| 9 | Filter outlier otomatis | ✅ Selesai |
| 10 | Backward compatibility | ✅ Selesai |

## Perbedaan Metode Kalibrasi

| Aspek | Konvensional | Pyranometer |
|-------|--------------|-------------|
| Rumus | Koreksi = Std - UUT | CF = Std / UUT |
| Hasil | Selisih (W/m²) | Rasio (tanpa satuan) |
| Uncertainty | Dalam satuan absolut | Dalam persen (%) |
| Drift | Dari sertifikat | ISO 9060:2018 |
| Header | Penunjukan Alat, Koreksi, U95 | Penunjukkan Alat, CF, U95 |

## Rencana Selanjutnya

- Pengujian lebih lanjut dengan berbagai jenis pyranometer.
- Penambahan dukungan untuk pyranometer analog (dengan sensitivitas).
- Integrasi dengan modul pelatihan dan sosialisasi.
- Penyusunan panduan pengguna untuk fitur pyranometer.

---

*Dokumen ini disusun oleh Tim Pengembangan SILK MKG*
*Terakhir diperbarui: Juli 2026*
