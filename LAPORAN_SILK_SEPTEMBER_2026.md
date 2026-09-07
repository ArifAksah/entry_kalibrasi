# Laporan Bulanan Kegiatan Pembangunan Sistem Informasi Layanan Kalibrasi (SILK) MKG

## Periode: September 2026

---

## Pendahuluan

Pengembangan Sistem Informasi Layanan Kalibrasi MKG pada bulan September 2026 melanjutkan proses penyamaan hasil pengolahan data antara sistem dan workbook acuan. Setelah formula dasar, faktor konversi, dan koreksi arah angin distandarkan pada periode sebelumnya, pekerjaan difokuskan pada konsistensi hasil antarfitur, perhitungan ketidakpastian lintas satuan, penyimpanan snapshot hasil kalkulasi, dan peningkatan keterlacakan data mentah.

Kegiatan ini diperlukan agar nilai yang ditampilkan pada QC Check, Preview LHKS, Uncertainty Budget, dan hasil sertifikat berasal dari sumber data serta formula yang sama. Dengan demikian, hasil perhitungan dapat ditelusuri kembali hingga ke baris spreadsheet dan sertifikat standar yang digunakan.

## Tujuan

- Menyamakan hasil koreksi, rata-rata, dan standar deviasi pada QC Check dan Preview LHKS.
- Memastikan komponen ketidakpastian berada dalam satuan keluaran atau unit UUT.
- Menyimpan hasil kalkulasi per baris sebagai snapshot yang dapat diaudit.
- Menjaga urutan data sesuai posisi asli pada spreadsheet.
- Mengunci sertifikat standar yang digunakan pada setiap sesi kalibrasi.
- Mencegah perubahan sertifikat terbaru mengubah hasil sesi lama.

## Hasil Kegiatan

### 1. Penyatuan Koreksi QC dan Uncertainty

- Mengubah perhitungan uncertainty agar memakai array koreksi final yang sama dengan QC Check.
- Menyamakan sumber data untuk:

```text
Rata-rata koreksi
STDEV.S
Repeatability
Expanded uncertainty
Hasil sertifikat
```

- Menghapus fallback lama yang menggunakan raw UUT sebagai repeatability untuk alat non-pyranometer.
- Menetapkan formula repeatability:

```text
Repeatability = STDEV.S(koreksi UUT final)
```

- Menerapkan perubahan pada Barometer, Termometer, Hygrometer, Wind Speed, Wind Direction, dan parameter non-pyranometer lainnya.
- Mempertahankan metode khusus Calibration Factor untuk pyranometer.

### 2. Konversi Komponen Ketidakpastian

- Menambahkan fungsi `convertDeltaUnit()` untuk mengonversi besaran interval tanpa offset.
- Memisahkan konversi nilai absolut dan konversi delta.
- Menerapkan konversi pada komponen uncertainty yang berasal dari STD:
  - U95 Sertifikat STD.
  - Drift STD.
  - Resolusi STD.
- Memastikan repeatability dan resolusi UUT tidak dikonversi ulang karena sudah berada dalam unit UUT.

Contoh Wind Speed:

```text
U95 Sertifikat = 0,4800 m/s
0,4800 × 1,9438444924406
= 0,933045356371488 knot
```

Contoh konversi delta suhu:

```text
Nilai absolut 1°C = 33,8°F
Delta 1°C         = 1,8°F
```

- Menambahkan validasi pasangan unit agar konversi tidak dikenal tidak sekadar mengganti label.

### 3. Penyempurnaan Preview Uncertainty

- Menampilkan informasi unit asal STD dan unit keluaran UUT.
- Menampilkan jejak konversi komponen:

```text
U95 Sertifikat: nilai native → nilai output
Drift STD: nilai native → nilai output
Resolusi STD: nilai native → nilai output
```

- Mengubah header kolom menjadi `Unit Output / Satuan UUT`.
- Menambahkan satuan pada hasil `Expanded uncertainty, U95`.
- Menampilkan peringatan jika pasangan unit tidak dapat dikonversi.

### 4. Penyempurnaan Header dan Nilai LHKS

- Memisahkan nilai STD native dan nilai hasil konversi agar tidak ambigu.
- Saat unit STD dan UUT berbeda, format tabel menjadi:

| Kolom | Unit |
|-------|------|
| STD Pembacaan | Unit STD |
| STD Koreksi | Unit STD |
| STD Terkoreksi | Unit STD |
| STD Terkoreksi Hasil Konversi | Unit UUT |
| Alat yang dikalibrasi | Unit UUT |
| Koreksi | Unit UUT |

- Menampilkan drift standar dalam unit native dan unit hasil konversi.
- Menyesuaikan baris rata-rata, standar deviasi, `colSpan`, dan catatan kaki laporan.
- Menghilangkan kondisi ketika angka `m/s` ditampilkan di bawah header `knot`.

### 5. Penyimpanan Snapshot Kalkulasi

- Menambahkan endpoint untuk menyimpan hasil kalkulasi per baris ke `raw_data`.
- Kolom yang dibekukan:

```text
std_correction
std_corrected
uut_correction
```

- Menjadikan snapshot QC sebagai sumber utama Preview LHKS.
- Membatalkan penyimpanan hasil sertifikat jika snapshot per baris gagal disimpan.
- Memastikan raw STD, raw UUT, sensor, unit, dan timestamp tidak diubah.
- Mengganti operasi `upsert` dengan `UPDATE` per ID untuk mencegah pembuatan row parsial.
- Menambahkan deduplikasi `raw_data.id` sebelum penyimpanan snapshot.
- Mempertahankan ID `bigint` dalam bentuk string agar tidak kehilangan presisi JavaScript.

### 6. Perbaikan Konsistensi Fallback

- Menghilangkan kondisi `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- Menambahkan deduplikasi snapshot pada client dan API.
- Menambahkan retry dan pengolahan hasil parsial pada endpoint koreksi.
- Mengubah tombol Hitung agar tidak dapat digunakan selama masih ada koreksi fallback.
- Menampilkan hingga lima pembacaan STD yang masih bermasalah pada panel audit.
- Menurunkan jumlah fallback dari beberapa baris per parameter menjadi nol pada pengujian.

### 7. Keterlacakan Urutan Raw Data

- Menemukan perbedaan pasangan data antara workbook dan sesi Simkal mulai baris tertentu akibat pengurutan yang tidak deterministik.
- Menambahkan kolom:

```text
raw_data.source_row_index
```

- Menyimpan posisi asli setiap baris spreadsheet saat upload.
- Mengurutkan QC Check, LHKS, dan Uncertainty berdasarkan `source_row_index`.
- Menggunakan `raw_data.id` sebagai fallback untuk data historis.
- Tidak lagi mengubah sequence numerik `1, 2, 3, ...` menjadi timestamp tahun 1970.
- Menambahkan `Source Row` pada ekspor audit.

### 8. Penguncian Sertifikat Standar

- Menambahkan kolom:

```text
raw_data.standard_certificate_id
```

- Menyimpan sertifikat standar yang dipilih pada saat raw data disimpan.
- Menggunakan sertifikat tersebut secara konsisten pada:
  - QC Check.
  - Interpolasi koreksi.
  - Uncertainty Modal.
  - Background QC cache.
  - Snapshot hasil kalibrasi.
- Mempertahankan `standardCertificateId` saat data dikonversi antara schema legacy V0 dan schema V1.
- Menambahkan foreign key dan index untuk menjaga integritas data.

### 9. Migrasi Database

- Menambahkan script `database/add_raw_data_traceability.sql`.
- Migrasi mencakup:
  - Penambahan `source_row_index`.
  - Penambahan `standard_certificate_id`.
  - Foreign key ke `certificate_standard`.
  - Index urutan session dan sheet.
  - Index sertifikat standar.
  - Backfill source row data historis berdasarkan urutan ID.
- Menyempurnakan trigger koreksi arah angin agar kompatibel dengan variasi schema nama sensor.

### 10. Pengujian dan Validasi

- Menambahkan pengujian untuk:
  - Konversi delta uncertainty.
  - U95 `m/s → knot`.
  - U95 `hPa → inHg`.
  - Drift STD dan resolusi STD.
  - Snapshot kalkulasi dan deduplikasi ID.
  - Urutan `source_row_index`.
  - Sertifikat standar terpilih dibanding sertifikat terbaru.
  - Preview LHKS menggunakan snapshot final.
  - Cache koreksi dan retry.
- Menjalankan production build untuk memeriksa kompatibilitas Next.js dan TypeScript.

## Tantangan dan Solusi

| Tantangan | Solusi |
|-----------|--------|
| QC dan LHKS memakai sumber koreksi berbeda | Menyimpan snapshot per baris dan memprioritaskannya di LHKS |
| U95 `0,4800 m/s` hanya dilabel `knot` | Mengonversi nilai delta menjadi `0,9330 knot` |
| Snapshot berisi ID duplikat | Deduplikasi client dan API, lalu update per ID |
| Urutan raw data berubah | Menambahkan `source_row_index` |
| Sequence angka berubah menjadi tanggal 1970 | Menyimpan sequence sebagai indeks, bukan timestamp |
| Sesi lama berubah saat sertifikat baru dibuat | Menyimpan dan menggunakan `standard_certificate_id` |
| Fallback koreksi menyebabkan statistik campuran | Memblokir penyimpanan sampai fallback bernilai nol |

## Ringkasan Capaian

| No | Kegiatan | Status |
|----|----------|--------|
| 1 | Penyatuan QC dan uncertainty | Selesai |
| 2 | Konversi komponen uncertainty | Selesai |
| 3 | Penyempurnaan Preview Uncertainty | Selesai |
| 4 | Header dan nilai LHKS multi-unit | Selesai |
| 5 | Snapshot kalkulasi per baris | Selesai |
| 6 | Deduplikasi dan perbaikan fallback | Selesai |
| 7 | Traceability urutan spreadsheet | Selesai |
| 8 | Penguncian sertifikat standar | Selesai |
| 9 | Migrasi database traceability | Selesai |
| 10 | Pengujian regresi dan build | Selesai |

## Rencana Selanjutnya

- Melakukan validasi bersama tim kalibrasi menggunakan golden dataset seluruh parameter.
- Menetapkan toleransi numerik resmi antara sistem dan workbook.
- Menambahkan hash atau versi algoritma kalkulasi pada snapshot hasil.
- Meningkatkan validasi integritas jumlah baris setelah upload.
- Menyusun panduan operasional penggunaan Audit ON, Refresh, Hitung, LHKS, dan Uncertainty.
- Melakukan deployment bertahap ke server produksi setelah validasi pengguna.

---

*Dokumen ini disusun oleh Tim Pengembangan SILK MKG.*

*Terakhir diperbarui: September 2026.*
