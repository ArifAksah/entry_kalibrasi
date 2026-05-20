# Dokumen Persyaratan (Requirements)

## Pendahuluan

Sistem saat ini menggunakan satu halaman print monolitik (`/certificates/[id]/print/page.tsx`) dan satu helper PDF (`certificate-pdf-helper.ts`) yang menghasilkan PDF sertifikat kalibrasi melalui Playwright (headless browser rendering). Arsitektur ini tidak fleksibel untuk mengakomodasi berbagai jenis sertifikat yang dibutuhkan, karena layout, CSS, dan struktur halaman di-hardcode dalam satu komponen.

Fitur ini bertujuan membangun arsitektur layanan PDF yang modular dan fleksibel, sehingga dapat dengan mudah mendukung penambahan tipe sertifikat baru tanpa mengubah kode inti. Tipe sertifikat yang harus didukung:

1. **Sertifikat Lapang (Field Calibration / FC)**
2. **Sertifikat LC (Lab Calibration)**
3. **Sertifikat Lapang Balai 1, 2, 3, 4, 5**
4. **Sertifikat Lab Balai 1, 2, 3, 4, 5**
5. **Sertifikat Standar**

## Glosarium

- **PDF_Service**: Layanan inti yang mengorkestrasi proses pembuatan PDF sertifikat kalibrasi, termasuk pemilihan template, pengisian data, dan rendering PDF.
- **Template_Registry**: Komponen yang menyimpan dan mengelola daftar template sertifikat yang tersedia, serta memetakan tipe sertifikat ke template yang sesuai.
- **Template_Renderer**: Komponen yang bertanggung jawab merender template sertifikat tertentu menjadi halaman HTML siap cetak berdasarkan data sertifikat.
- **Certificate_Type**: Identifikasi jenis sertifikat yang menentukan template mana yang digunakan (misalnya: `fc`, `lc`, `fc_balai_1`, `lc_balai_3`, `standar`).
- **Balai**: Unit Pelaksana Teknis (UPT) BMKG yang memiliki format sertifikat khusus. Terdapat 5 Balai (Balai 1 sampai Balai 5).
- **Cover_Page**: Halaman pertama sertifikat yang berisi identitas alat, identitas pemilik, dan informasi umum kalibrasi.
- **Results_Page**: Halaman kedua dan seterusnya yang berisi tabel hasil kalibrasi.
- **BSrE**: Balai Sertifikasi Elektronik — layanan penandatanganan digital PDF dari BSSN.
- **Template_Config**: Konfigurasi deklaratif yang mendefinisikan elemen-elemen visual dan layout untuk setiap tipe sertifikat.

## Persyaratan

### Persyaratan 1: Registrasi dan Penemuan Template

**User Story:** Sebagai pengembang, saya ingin mendaftarkan template sertifikat baru secara deklaratif, sehingga penambahan tipe sertifikat baru tidak memerlukan perubahan pada kode inti PDF_Service.

#### Kriteria Penerimaan

1. THE Template_Registry SHALL menyediakan mekanisme pendaftaran template baru melalui file konfigurasi atau modul deklaratif yang dapat ditambahkan tanpa modifikasi kode inti PDF_Service yang sudah ada.
2. WHEN sebuah Certificate_Type diminta, THE Template_Registry SHALL mengembalikan Template_Config yang sesuai untuk tipe tersebut dalam waktu tidak lebih dari 200ms.
3. THE Template_Registry SHALL mendukung minimal 13 tipe sertifikat: `fc`, `lc`, `fc_balai_1`, `fc_balai_2`, `fc_balai_3`, `fc_balai_4`, `fc_balai_5`, `lc_balai_1`, `lc_balai_2`, `lc_balai_3`, `lc_balai_4`, `lc_balai_5`, dan `standar`.
4. IF sebuah Certificate_Type yang tidak terdaftar diminta, THEN THE Template_Registry SHALL mengembalikan pesan error yang menyebutkan nama tipe yang diminta beserta daftar lengkap tipe yang tersedia saat ini.
5. WHEN template baru didaftarkan, THE Template_Registry SHALL memvalidasi bahwa Template_Config memiliki semua field wajib (header, Cover_Page layout, Results_Page layout, footer, dan styling) dan menolak pendaftaran dengan pesan error yang menyebutkan field yang hilang jika tidak lengkap.
6. IF sebuah Certificate_Type yang sudah terdaftar didaftarkan kembali, THEN THE Template_Registry SHALL menolak pendaftaran duplikat dan mengembalikan pesan error yang menyebutkan bahwa tipe tersebut sudah terdaftar.

### Persyaratan 2: Struktur Template yang Modular

**User Story:** Sebagai pengembang, saya ingin setiap tipe sertifikat memiliki template terpisah yang dapat dikustomisasi secara independen, sehingga perubahan pada satu tipe tidak mempengaruhi tipe lainnya.

#### Kriteria Penerimaan

1. THE Template_Config SHALL mendefinisikan komponen-komponen berikut sebagai unit yang dapat dimodifikasi secara independen: header (kop surat), Cover_Page layout, Results_Page layout, footer, dan styling.
2. THE Template_Renderer SHALL merender Cover_Page dan Results_Page dengan struktur, posisi elemen, dan konten yang sesuai dengan definisi layout dalam Template_Config yang diberikan.
3. WHEN Template_Config untuk Balai tertentu menyertakan logo dan nama instansi khusus, THE Template_Renderer SHALL menampilkan logo dan nama instansi sesuai konfigurasi Balai tersebut.
4. THE Template_Config SHALL mendukung kustomisasi elemen berikut per tipe sertifikat: logo instansi, nama instansi, format nomor sertifikat, teks header bilingual (Indonesia dan Inggris), dan kode formulir footer.
5. WHILE sebuah template sedang dirender, THE Template_Renderer SHALL menggunakan hanya komponen dan styling yang didefinisikan dalam Template_Config tipe tersebut, tanpa mewarisi atau mereferensi komponen dari Template_Config tipe lain.
6. IF Template_Config yang diberikan tidak memiliki salah satu komponen wajib (header, Cover_Page layout, Results_Page layout, footer, atau styling), THEN THE Template_Renderer SHALL menolak rendering dan mengembalikan error yang menyebutkan nama komponen yang hilang.
7. WHEN sebuah Template_Config untuk satu Certificate_Type dimodifikasi, THE Template_Registry SHALL memastikan bahwa Template_Config untuk Certificate_Type lainnya tetap tidak berubah.

### Persyaratan 3: Pembuatan PDF Berdasarkan Tipe Sertifikat

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis memilih template yang benar berdasarkan tipe sertifikat, sehingga PDF yang dihasilkan sesuai dengan format yang ditentukan.

#### Kriteria Penerimaan

1. WHEN PDF diminta untuk sebuah sertifikat, THE PDF_Service SHALL menentukan Certificate_Type dari data sertifikat berdasarkan nilai field `calibration_place` ('FC' atau 'LC') dan asosiasi Balai (nomor Balai 1–5 jika ada), sesuai aturan penentuan di Persyaratan 9.
2. WHEN Certificate_Type telah ditentukan, THE PDF_Service SHALL mengambil Template_Config dari Template_Registry dan meneruskannya ke Template_Renderer.
3. THE PDF_Service SHALL menghasilkan PDF dalam format A4 portrait (210mm × 297mm) dengan margin 0mm (konten diatur oleh padding internal template).
4. WHEN PDF berhasil dihasilkan, THE PDF_Service SHALL mengembalikan buffer PDF beserta metadata yang mencakup: ukuran file dalam bytes, nama file mengikuti konvensi `certificate_{nomor_sertifikat_safe}_{id}.pdf` (karakter non-alfanumerik diganti underscore), dan Certificate_Type yang digunakan.
5. IF proses rendering gagal, THEN THE PDF_Service SHALL mengembalikan error yang mencakup Certificate_Type yang diminta, tahap kegagalan (template lookup, rendering, atau PDF generation), dan pesan error yang menjelaskan penyebab kegagalan.
6. IF proses pembuatan PDF tidak selesai dalam waktu 120 detik, THEN THE PDF_Service SHALL membatalkan proses dan mengembalikan error dengan tahap kegagalan yang sesuai.

### Persyaratan 4: Dukungan Sertifikat Lapang (Field Calibration)

**User Story:** Sebagai operator kalibrasi lapangan, saya ingin sertifikat lapang dihasilkan dengan format yang sesuai standar BMKG pusat, sehingga sertifikat sah secara administratif.

#### Kriteria Penerimaan

1. WHEN calibration_place adalah `FC`, THE Template_Renderer SHALL merender Cover_Page dengan header berisi teks "BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA" pada baris pertama dan "LABORATORIUM KALIBRASI BMKG" pada baris kedua, dipisahkan oleh garis batas bawah ganda (double border-bottom) dari konten di bawahnya.
2. WHEN calibration_place adalah `FC`, THE Template_Renderer SHALL merender judul "SERTIFIKAT KALIBRASI" dalam format bold dan sub-judul "CALIBRATION CERTIFICATE" dalam format italic, keduanya rata tengah (center-aligned) di bawah header Cover_Page.
3. THE Template_Renderer SHALL merender bagian identitas alat dengan heading "IDENTITAS ALAT" dan sub-heading italic "Instrument Details", berisi empat baris dalam format tabel dua kolom: label bilingual (Indonesia / English) di kolom kiri (lebar 30%) dan nilai di kolom kanan (lebar 65%), dengan urutan baris: (1) Nama Alat / Instrument Name, (2) Merek Pabrik / Manufacturer, (3) Tipe / Nomor Seri / Type / Serial Number, (4) Lain-lain / Others.
4. THE Template_Renderer SHALL merender bagian identitas pemilik dengan heading "IDENTITAS PEMILIK" dan sub-heading italic "Owner's Identification", berisi dua baris dalam format tabel dua kolom: label bilingual di kolom kiri (lebar 30%) dan nilai di kolom kanan (lebar 65%), dengan urutan baris: (1) Nama / Designation, (2) Alamat / Address.
5. WHEN hasil kalibrasi tersedia (minimal 1 record hasil), THE Template_Renderer SHALL merender Results_Page menggunakan elemen tabel dengan `<thead>` sebagai repeating header (berisi logo BMKG, nomor sertifikat, nomor order, dan nomor halaman) dan `<tfoot>` sebagai repeating footer (berisi informasi tanda tangan elektronik dan alamat kantor) yang muncul berulang pada setiap halaman cetak.
6. IF hasil kalibrasi tidak tersedia (0 record hasil), THEN THE Template_Renderer SHALL merender satu halaman hasil kosong dengan teks "Tidak ada data hasil kalibrasi" dan keterangan akhir "--- Akhir dari Sertifikat / End of Certificate ---", tetap menggunakan repeating header dan repeating footer yang sama.
7. WHEN hasil kalibrasi tersedia, THE Template_Renderer SHALL merender satu halaman per sensor, sehingga total halaman sertifikat adalah 1 (Cover_Page) ditambah jumlah sensor yang dikalibrasi (minimal 1 halaman hasil).

### Persyaratan 5: Dukungan Sertifikat Lab Calibration (LC)

**User Story:** Sebagai operator laboratorium kalibrasi, saya ingin sertifikat LC dihasilkan dengan format khusus laboratorium, sehingga sertifikat memenuhi standar akreditasi lab.

#### Kriteria Penerimaan

1. WHEN Certificate_Type adalah `lc`, THE Template_Renderer SHALL merender Cover_Page dengan header "BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA" dan "LABORATORIUM KALIBRASI BMKG", serta menampilkan nomor akreditasi laboratorium (contoh: "LK-095-IDN") di bawah nama instansi.
2. WHEN Certificate_Type adalah `lc`, THE Template_Renderer SHALL menyertakan informasi akreditasi laboratorium pada Cover_Page yang mencakup: nomor akreditasi KAN, nama badan akreditasi penerbit, dan ruang lingkup akreditasi yang relevan.
3. WHEN Certificate_Type adalah `lc`, THE Template_Renderer SHALL merender Results_Page dengan header berulang (repeating header) dan footer berulang (repeating footer) pada setiap halaman, menggunakan format tabel hasil yang menyertakan kolom ketidakpastian pengukuran (uncertainty).
4. THE Template_Config untuk `lc` SHALL mendefinisikan kode formulir footer yang berbeda dari tipe `fc` (yang menggunakan "F/IKK 7.8.2"), dengan format kode yang mengikuti pola penamaan formulir IKK yang berlaku.
5. IF data akreditasi laboratorium tidak tersedia atau tidak lengkap saat merender Certificate_Type `lc`, THEN THE Template_Renderer SHALL tetap merender sertifikat tanpa elemen akreditasi dan mencatat warning ke log yang menyebutkan field akreditasi yang hilang.

### Persyaratan 6: Dukungan Sertifikat Balai (UPT)

**User Story:** Sebagai operator Balai, saya ingin sertifikat yang dihasilkan mencantumkan identitas Balai saya (logo, nama, alamat), sehingga sertifikat sesuai dengan kewenangan penerbitan Balai.

#### Kriteria Penerimaan

1. WHEN Certificate_Type mengandung identifikasi Balai (pola `fc_balai_N` atau `lc_balai_N` dengan N = 1 sampai 5), THE Template_Renderer SHALL merender header dengan nama resmi Balai sesuai nomor Balai yang teridentifikasi dari Certificate_Type (misalnya Balai 1 → "BALAI BESAR MKG WILAYAH I").
2. WHEN Certificate_Type mengandung identifikasi Balai, THE Template_Renderer SHALL menampilkan logo Balai yang terdaftar dalam Template_Config untuk nomor Balai tersebut pada area header Cover_Page.
3. THE Template_Registry SHALL menyimpan konfigurasi untuk setiap Balai (Balai 1 sampai 5) yang mencakup: nama resmi Balai, alamat Balai, dan referensi logo Balai. Konfigurasi Balai yang sama SHALL digunakan baik untuk varian FC maupun LC dari Balai tersebut.
4. WHEN sertifikat Balai dirender, THE Template_Renderer SHALL menampilkan alamat Balai pada posisi yang didefinisikan dalam Template_Config untuk tipe tersebut (header atau footer).
5. THE Template_Config untuk setiap Balai SHALL dapat diubah secara independen, dimana perubahan pada konfigurasi satu Balai tidak mengubah output render untuk Certificate_Type Balai lainnya.
6. IF Template_Config untuk Balai yang diminta tidak memiliki salah satu field wajib (nama resmi, alamat, atau logo), THEN THE Template_Registry SHALL mengembalikan error yang menyebutkan field yang tidak lengkap dan nomor Balai yang bermasalah.
7. WHEN Certificate_Type mengandung identifikasi Balai, THE Template_Renderer SHALL merender seluruh elemen Cover_Page lainnya (identitas alat, identitas pemilik, judul sertifikat) dengan format yang sama seperti tipe dasar (`fc` atau `lc`) kecuali elemen identitas Balai (logo, nama, alamat).

### Persyaratan 7: Dukungan Sertifikat Standar

**User Story:** Sebagai pengelola standar kalibrasi, saya ingin sertifikat standar dihasilkan dengan format khusus yang mencantumkan informasi traceability, sehingga standar kalibrasi terdokumentasi dengan benar.

#### Kriteria Penerimaan

1. WHEN Certificate_Type adalah `standar`, THE Template_Renderer SHALL merender Cover_Page dengan header "SERTIFIKAT KALIBRASI STANDAR" / "STANDARD CALIBRATION CERTIFICATE" yang membedakannya dari tipe `fc` dan `lc`.
2. THE Template_Config untuk `standar` SHALL mendefinisikan section traceability yang mencakup field berikut: nama instrumen standar, nomor seri, nomor sertifikat kalibrasi acuan, dan lembaga ketertelusuran SI (traceable_to_si_through).
3. IF data traceability tidak tersedia atau kosong, THEN THE Template_Renderer SHALL merender section traceability dengan indikasi bahwa informasi belum dilengkapi, tanpa menyembunyikan section tersebut.
4. WHEN data traceability tersedia, THE Template_Renderer SHALL merender informasi rantai ketertelusuran yang menampilkan minimal: nama instrumen standar acuan, nomor sertifikat kalibrasi acuan, dan lembaga ketertelusuran SI.
5. THE Template_Renderer SHALL merender informasi validitas standar pada Cover_Page yang mencakup tanggal kalibrasi (calibration_date) dan tanggal berakhir masa berlaku, ditampilkan dalam format tanggal DD-MM-YYYY.

### Persyaratan 8: Integrasi dengan Alur Verifikasi dan Penandatanganan

**User Story:** Sebagai verifikator, saya ingin PDF yang dihasilkan oleh service baru tetap kompatibel dengan alur verifikasi dan penandatanganan BSrE yang sudah ada, sehingga proses approval tidak terganggu.

#### Kriteria Penerimaan

1. THE PDF_Service SHALL menghasilkan PDF tanpa enkripsi, tanpa password protection, dan tanpa tanda tangan digital yang sudah tertanam, sehingga BSrE dapat memproses penandatanganan melalui endpoint `/api/sign/pdf`.
2. WHEN level 3 verification disetujui, THE PDF_Service SHALL dipanggil untuk menghasilkan PDF sebelum dikirim ke BSrE untuk ditandatangani, dengan timeout maksimal 120 detik untuk keseluruhan proses rendering dan penandatanganan.
3. THE PDF_Service SHALL menyimpan PDF yang dihasilkan ke Supabase Storage pada bucket `certificate-pdfs` dengan object path `signed/certificate_{nomorSertifikat}_{certificateId}.pdf`, di mana karakter non-alfanumerik pada nomor sertifikat diganti dengan underscore.
4. WHILE sertifikat memiliki `public_id` yang valid, THE Template_Renderer SHALL menyertakan QR code verifikasi pada posisi yang ditentukan oleh Template_Config, berisi URL verifikasi publik berbasis `public_id`.
5. WHEN parameter `simulateSigned` bernilai `true`, THE PDF_Service SHALL merender PDF dengan tampilan visual seolah sudah ditandatangani (menampilkan elemen tanda tangan dan QR code) tanpa mengirim PDF ke BSrE untuk penandatanganan resmi.
6. IF BSrE menolak PDF atau tidak merespons dalam batas waktu 120 detik, THEN THE PDF_Service SHALL mengembalikan error yang mengindikasikan penyebab kegagalan (timeout, passphrase salah, NIK tidak valid, atau koneksi gagal) tanpa mengubah status verifikasi sertifikat.
7. IF PDF berhasil ditandatangani oleh BSrE, THEN THE PDF_Service SHALL memperbarui kolom `pdf_path` pada tabel `certificate` dengan path storage yang baru, menggunakan format `storage:{bucket}/{folder}/{fileName}`.

### Persyaratan 9: Penentuan Tipe Sertifikat Otomatis

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis menentukan tipe sertifikat berdasarkan data yang sudah ada, sehingga saya tidak perlu memilih template secara manual.

#### Kriteria Penerimaan

1. WHEN sebuah sertifikat memiliki `calibration_place` = 'FC' dan field `balai_id` bernilai NULL, THE PDF_Service SHALL menentukan Certificate_Type sebagai `fc`.
2. WHEN sebuah sertifikat memiliki `calibration_place` = 'LC' dan field `balai_id` bernilai NULL, THE PDF_Service SHALL menentukan Certificate_Type sebagai `lc`.
3. WHEN sebuah sertifikat memiliki `balai_id` yang tidak NULL, THE PDF_Service SHALL menentukan Certificate_Type dengan format `{calibration_place_lowercase}_balai_{balai_id}` (contoh: `fc_balai_3` untuk sertifikat dengan `calibration_place` = 'FC' dan `balai_id` = 3).
4. WHEN sebuah sertifikat memiliki field `is_standard` bernilai TRUE, THE PDF_Service SHALL menentukan Certificate_Type sebagai `standar`, terlepas dari nilai `calibration_place` dan `balai_id`.
5. IF field `calibration_place` bernilai NULL atau kosong dan field `is_standard` bernilai FALSE atau NULL, THEN THE PDF_Service SHALL menggunakan `fc` sebagai Certificate_Type default dan mencatat warning ke log yang menyebutkan certificate ID yang terdampak.
6. THE PDF_Service SHALL mengevaluasi kondisi penentuan Certificate_Type dengan urutan prioritas: (1) `is_standard` = TRUE → `standar`, (2) `balai_id` tidak NULL → format gabungan, (3) `calibration_place` tanpa Balai → `fc` atau `lc`, (4) fallback → `fc`.

### Persyaratan 10: Backward Compatibility

**User Story:** Sebagai pengguna yang sudah memiliki sertifikat lama, saya ingin sertifikat yang sudah ada tetap dapat di-render ulang dengan benar menggunakan service baru, sehingga tidak ada data yang hilang atau rusak.

#### Kriteria Penerimaan

1. WHEN sertifikat bertipe `fc` yang sudah ada di-render ulang menggunakan PDF_Service baru, THE PDF_Service SHALL menghasilkan output PDF dengan layout halaman, posisi elemen, ukuran font, dan konten teks yang sama dengan output sistem lama, tanpa ada field data yang hilang atau terpotong.
2. WHEN sertifikat lama tidak memiliki field `certificate_type` eksplisit, THE PDF_Service SHALL melakukan inferensi tipe dengan menetapkan nilai default `sert` dan menentukan `calibration_place` dari field yang sudah ada (default `FC` jika tidak tersedia).
3. IF inferensi tipe gagal karena field `calibration_place` dan `calibration_kind` keduanya bernilai null atau kosong, THEN THE PDF_Service SHALL tetap menghasilkan PDF menggunakan nilai default (`certificate_type`: `sert`, `calibration_place`: `FC`) dan mencatat warning ke log.
4. THE PDF_Service SHALL tetap mendukung API endpoint `/api/certificates/[id]/download-pdf` (method GET, response Content-Type `application/pdf`) dan `/api/certificates/[id]/pdf` (method GET, response Content-Type `application/pdf`) dengan request parameter dan response header yang sama seperti sebelumnya.
5. WHEN fungsi `generateAndSaveCertificatePDF` dipanggil dengan parameter signature yang sama (`certificateId: number, userId?: string, passphrase?: string, simulateSigned?: boolean`), THE PDF_Service SHALL mengembalikan objek `{ success: true, pdfPath: string }` untuk sertifikat yang valid, dalam waktu maksimal 120 detik.
