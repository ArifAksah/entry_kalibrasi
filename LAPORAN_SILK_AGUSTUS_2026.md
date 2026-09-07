# Laporan Bulanan Kegiatan Pembangunan Sistem Informasi Layanan Kalibrasi (SILK) MKG

## Periode: Agustus 2026

---

## Pendahuluan

Sistem pengolahan data dan penerbitan sertifikat kalibrasi sebelumnya masih bergantung pada file Excel yang dikelola secara manual oleh tim kalibrasi. Workbook tersebut memuat formula pengolahan data, interpolasi koreksi standar, konversi satuan, perhitungan statistik, dan penyusunan hasil kalibrasi. Walaupun telah digunakan sebagai acuan operasional, pengelolaan berbasis Excel memiliki keterbatasan dari sisi konsistensi formula, integrasi antarproses, keterlacakan data, dan keamanan penyimpanan.

Untuk menjawab kebutuhan tersebut, Direktorat Data dan Komputasi bersama Direktorat Instrumentasi dan Kalibrasi melanjutkan pengembangan Sistem Informasi Layanan Kalibrasi MKG. Sistem ini berfungsi sebagai aplikasi terintegrasi untuk entri data kalibrasi, pengolahan data, pemeriksaan mutu, perhitungan ketidakpastian, penyusunan LHKS, dan penerbitan sertifikat kalibrasi.

Pengembangan pada bulan Agustus 2026 berfokus pada penyamaan formula sistem dengan workbook acuan, penerapan perhitungan khusus arah angin, standardisasi konversi satuan, serta penyediaan fitur audit untuk membandingkan hasil perhitungan Sistem dan Excel.

## Tujuan

- Meningkatkan konsistensi hasil pengolahan data antara SILK dan workbook acuan tim kalibrasi.
- Memastikan koreksi arah angin dihitung berdasarkan jarak sudut terpendek.
- Menstandarkan faktor konversi satuan sesuai konstanta yang digunakan pada workbook.
- Menyediakan fasilitas audit untuk menelusuri sumber perbedaan hasil perhitungan.
- Meningkatkan akurasi perhitungan rata-rata, standar deviasi, dan koreksi hasil kalibrasi.

## Hasil Kegiatan

### 1. Audit Formula Workbook dan Sistem

- Melakukan penelusuran formula pada workbook `F.M.2026.037.001 AWOS 30.xlsx`.
- Mengidentifikasi alur pengolahan data utama sebagai berikut:

```text
Pembacaan STD
→ interpolasi koreksi sertifikat STD
→ STD terkoreksi
→ konversi ke unit UUT
→ koreksi UUT
→ rata-rata dan STDEV.S
```

- Memastikan workbook menggunakan `STDEV` atau `STDEV.S` dengan pembagi `n-1`.
- Membandingkan nilai raw STD, raw UUT, koreksi STD, hasil konversi, dan koreksi akhir secara per baris.
- Menemukan bahwa perbedaan hasil bukan semata-mata disebabkan oleh floating-point, tetapi juga oleh sumber sertifikat, konstanta konversi, dan susunan data.

### 2. Standardisasi Faktor Konversi Satuan

- Menyesuaikan faktor konversi sistem dengan sheet `konv` pada workbook acuan.
- Konstanta utama yang diterapkan:

| Dari | Ke | Faktor |
|------|----|--------|
| hPa | inHg | `0,029529983071445` |
| hPa | mmHg | `0,750062` |
| hPa | bar | `0,001` |
| m/s | knot | `1,9438444924406` |
| m/s | fpm | `196,850393700787` |

- Menambahkan dukungan konversi balik berdasarkan reciprocal faktor workbook.
- Menambahkan pengujian nilai acuan untuk Barometer dan Wind Speed.

Contoh hasil pengujian:

```text
1004,4540902893643 hPa
→ 29,661512282288616 inHg

2,84234 m/s
→ 5,5250669546436155 knot
```

### 3. Implementasi Koreksi Arah Angin

- Menambahkan deteksi khusus untuk parameter arah angin berdasarkan:
  - Nama sensor `Arah Angin`.
  - Nama sensor `Wind Direction`.
  - Tipe `Wind Vane`.
  - Metode kalibrasi `MK 05` sebagai fallback.
- Mengubah koreksi arah angin dari selisih linear menjadi selisih sudut terpendek.
- Formula yang diterapkan mengikuti workbook:

```text
Koreksi = MOD(STD terkoreksi - UUT + 180, 360) - 180
```

- Menormalisasi koreksi ke interval `-180°` sampai kurang dari `+180°`.
- Menerapkan formula pada QC Check, LHKS, uncertainty, hasil sertifikat, dan trigger database.

Contoh:

```text
STD terkoreksi = 54,1126949°
UUT             = 354°
Selisih mentah  = -299,8873051°
Koreksi akhir   = +60,1126949°
```

### 4. Penyediaan Mode Audit Perbandingan

- Menambahkan tombol `Audit ON/OFF` pada QC Check Data.
- Menampilkan perbandingan hasil per baris antara:
  - Formula Sistem.
  - Formula Excel Legacy.
  - Selisih Sistem dan Excel.
- Menampilkan ringkasan audit berupa:

| Profil | Informasi |
|--------|-----------|
| Sistem | Rata-rata dan STDEV.S hasil sistem |
| Excel Legacy | Rata-rata dan STDEV.S formula workbook |
| Selisih | Rata-rata dan STDEV.S selisih kedua profil |
| Sumber koreksi | Jumlah koreksi aktif, tersimpan, atau fallback |

- Menambahkan ekspor audit dalam format Excel.
- Menambahkan sheet `Ringkasan Audit` pada hasil ekspor.
- Menambahkan informasi pembacaan STD yang masih menggunakan fallback.

### 5. Perbaikan Sumber Koreksi Standar

- Mengidentifikasi masalah koreksi gagal yang sebelumnya berubah menjadi nilai `0`.
- Mengubah error RPC agar tidak dianggap sebagai koreksi valid.
- Mencegah koreksi gagal disimpan ke cache sebagai nilai nol.
- Menggunakan koreksi tersimpan hanya sebagai fallback sementara.
- Menambahkan informasi sumber koreksi:

```text
active
stored
missing
pyranometer
```

- Memblokir penyimpanan hasil resmi apabila masih terdapat fallback atau koreksi yang belum berhasil dihitung aktif.

### 6. Optimasi Perhitungan Koreksi Massal

- Mengurangi ketergantungan pada ribuan pemanggilan RPC per baris.
- Mengambil satu sertifikat standar per sensor, kemudian melakukan interpolasi seluruh pembacaan secara deterministik.
- Menambahkan retry bertahap untuk kegagalan jaringan atau database:

```text
Percobaan 1
→ jeda 150 ms
Percobaan 2
→ jeda 300 ms
Percobaan 3
```

- Membatasi konkurensi request fallback untuk mencegah beban berlebih pada database.
- Memastikan kegagalan satu pembacaan tidak menggagalkan seluruh batch.

### 7. Pengujian dan Validasi

- Menambahkan unit test untuk:
  - Formula wrap-around arah angin.
  - Batas `+180°` dan `-180°`.
  - Faktor konversi workbook.
  - Perbandingan Sistem dan Excel Legacy.
  - Penanganan cache dan fallback koreksi.
  - Rata-rata dan standar deviasi koreksi.
- Menjalankan production build untuk memastikan integrasi TypeScript dan Next.js berhasil.

## Tantangan dan Solusi

| Tantangan | Solusi |
|-----------|--------|
| Koreksi arah angin menghasilkan nilai sekitar `±300°` | Menerapkan formula wrap-around sesuai workbook |
| Faktor konversi sistem berbeda tipis dari Excel | Menggunakan konstanta presisi penuh dari sheet `konv` |
| Sebagian RPC koreksi gagal secara sporadis | Menggunakan interpolasi massal per sertifikat dan retry terbatas |
| Error RPC berubah menjadi koreksi nol | Memisahkan status error dari nilai pengukuran |
| Sulit mengetahui asal selisih | Menambahkan Audit ON dan ekspor perbandingan per baris |

## Ringkasan Capaian

| No | Kegiatan | Status |
|----|----------|--------|
| 1 | Audit formula workbook dan sistem | Selesai |
| 2 | Standardisasi faktor konversi | Selesai |
| 3 | Koreksi khusus arah angin | Selesai |
| 4 | Mode audit Sistem dan Excel | Selesai |
| 5 | Perbaikan error koreksi menjadi nol | Selesai |
| 6 | Optimasi kalkulasi koreksi massal | Selesai |
| 7 | Pengujian regresi perhitungan | Selesai |

## Rencana Bulan Berikutnya

- Menyatukan sumber koreksi antara QC, LHKS, dan uncertainty.
- Menambahkan snapshot hasil kalkulasi per baris.
- Menormalisasi komponen uncertainty ketika unit STD dan UUT berbeda.
- Menambahkan keterlacakan urutan data spreadsheet.
- Mengunci sertifikat standar yang digunakan pada setiap sesi.

---

*Dokumen ini disusun oleh Tim Pengembangan SILK MKG.*

*Terakhir diperbarui: Agustus 2026.*
