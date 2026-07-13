# Laporan Bulanan Kegiatan Pembangunan Sistem Informasi Layanan Kalibrasi (SILK) MKG

## Periode: April 2026

---

## Pendahuluan

Sistem Informasi Layanan Kalibrasi (SILK) MKG terus dikembangkan untuk mendukung transformasi digital layanan kalibrasi. Pada bulan April 2026, pengembangan berfokus pada perbaikan fitur sertifikat, manajemen data instrumen, dan peningkatan用户体验 pengguna.

## Tujuan

- Meningkatkan efisiensi dan akurasi proses pengolahan data kalibrasi serta penerbitan sertifikat kalibrasi melalui sistem berbasis website.
- Mewujudkan pengelolaan data kalibrasi yang terintegrasi, terpusat, dan aman antar unit terkait.
- Mendukung transformasi digital layanan kalibrasi MKG agar lebih modern, andal, dan berkelanjutan.

## Hasil Kegiatan

Progres pembangunan sistem Informasi layanan kalibrasi (SILK) telah membuat beberapa fitur selama bulan April 2026 sebagai berikut:

### 1. Perbaikan dan Penyempurnaan Sertifikat Kalibrasi

- Perbaikan format sertifikat kalibrasi untuk memastikan konsistensi tampilan.
- Perbaikan bug pada verifikator sertifikat (verifikator 3).
- Perbaikan flow penolakan sertifikat (rejected flow).
- Penambahan fitur QR Code pada footer sertifikat.
- Perbaikan download PDF sertifikat yang sudah ditandatangani (signed PDF).
- Update tampilan suhu pada sertifikat.

### 2. Manajemen Data Instrumen dan Sensor

- Perbaikan bug delete pada sertifikat standar dan multiple sensor.
- Perbaikan input instrumen UUT pada create sertifikat baru.
- Penambahan fitur date picker untuk kalibrasi.
- Perbaikan link preview LHKS.

### 3. Pengaturan Hak Akses dan Verifikasi

- Penambahan uncertainty ke menu verifikator.
- Perbaikan tampilan draft untuk verifikator.
- Fix endpoint untuk verifikasi.

### 4. Peningkatan Tampilan dan用户体验

- Update dashboard untuk personalisasi pengguna.
- Perbaikan layout PDF signed download.
- Perbaikan simbol aneh pada tampilan.
- Perbaikan footer sertifikat.
- Update logo pada halaman login.

### 5. Text Editor dan Format Data

- Penambahan text editor field untuk input data.
- Perbaikan nilai raw LaTeX.
- Perbaikan format koma pada footer.

## Komit Git (April 2026)

| Tanggal | Komit | Deskripsi |
|---------|-------|-----------|
| 27 Apr | e27944f | update dashboard user |
| 27 Apr | 23b3f92 | update kode paling baru |
| 27 Apr | f1a48be | Fix station assignment to load all stations |
| 24 Apr | 08b93d1 | Add simkal v1 updates |
| 24 Apr | babdd93 | update 4/24/2026 |
| 19 Apr | b4881db | perbaikan major 4/19/2026 |
| 19 Apr | d7ec28d | perbaiki format certificate |
| 19 Apr | 041979a | fix certicate verifikator 3 |
| 19 Apr | 3fe5187 | fix date picker |
| 19 Apr | 6d3ab59 | fix uut on create to new certificate |
| 19 Apr | 3238d17 | fix bug delete ini certificate standar dan multiple sensor |
| 8 Apr | c83b460 | update 4/8/2026 |
| 7 Apr | 2c435d1 | final 4/7/2026 |
| 7 Apr | 7dcc257 | update 7/4/2026 |
| 4 Apr | 511c4ce | update 4/4/2026 |
| 3 Apr | 6154921 | update tanggal 3/4/2026 |

## Tantangan

| Tantangan | Solusi |
|-----------|--------|
| Bug pada flow verifikasi sertifikat | Perbaikan logic dan testing menyeluruh |
| Inkonsistensi format sertifikat | Standarisasi format dan validasi |
| Download PDF signed bermasalah | Perbaikan endpoint dan integrasi Bsre |

## Rencana Bulan Depan

- Pengembangan fitur template sertifikat.
- Integrasi layanan WhatsApp untuk notifikasi.
- Penyempurnaan email konfirmasi.
- Update master instrumen.

---

*Dokumen ini disusun oleh Tim Pengembangan SILK MKG*
*Terakhir diperbarui: April 2026*
