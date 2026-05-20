# Dokumen Persyaratan (Requirements)

## Pendahuluan

Sistem saat ini menyimpan konfigurasi template sertifikat kalibrasi sebagai 13 file TypeScript hardcoded di `lib/pdf-service/templates/`. Setiap kali IKK (Instruksi Kerja Kalibrasi) berubah (2–3 kali per tahun), perubahan struktur template — seperti urutan section, posisi QR code, konfigurasi kolom tabel hasil, dan layout header/footer — memerlukan programmer untuk mengedit file TypeScript dan melakukan deployment ulang.

Fitur ini bertujuan membangun **Block-based Template Editor** yang memungkinkan admin mengkustomisasi template sertifikat melalui UI tanpa keterlibatan programmer. Template disimpan di database sebagai konfigurasi blok terurut (ordered blocks), dan editor menyediakan antarmuka drag-and-drop untuk mengatur ulang, menambah, menghapus, dan mengedit properti blok.

## Glosarium

- **Template_Editor**: Komponen UI berbasis blok yang memungkinkan admin mengedit konfigurasi template sertifikat secara visual, termasuk mengatur urutan blok, properti blok, dan preview hasil.
- **Template_Storage**: Layanan yang menyimpan dan mengambil konfigurasi template dari tabel `certificate_templates` di database Supabase (PostgreSQL), menggunakan kolom JSONB untuk menyimpan array blok.
- **Block**: Unit terkecil dari template sertifikat yang memiliki tipe, properti, dan posisi tertentu. Contoh: header block, title block, section-table block, qr-code block.
- **Block_Type**: Kategori blok yang menentukan properti yang dapat dikonfigurasi dan cara blok dirender. Terdapat dua kelompok: Cover_Page blocks dan Results_Page blocks.
- **Cover_Page**: Halaman pertama sertifikat yang berisi identitas alat, identitas pemilik, dan informasi umum kalibrasi.
- **Results_Page**: Halaman kedua dan seterusnya yang berisi tabel hasil kalibrasi dengan repeating header dan footer.
- **Template_Version**: Versi spesifik dari konfigurasi template yang diidentifikasi oleh nomor versi. Versi lama dipertahankan untuk referensi sertifikat yang sudah diterbitkan.
- **Admin**: Pengguna dengan role admin yang memiliki akses ke Template_Editor.
- **Live_Preview**: Panel preview real-time yang menampilkan visualisasi sertifikat berdasarkan konfigurasi blok saat ini.
- **PDF_Service**: Layanan inti yang merender sertifikat menjadi PDF, membaca konfigurasi template dari database.
- **Template_Config**: Konfigurasi deklaratif lengkap yang mendefinisikan seluruh elemen visual dan layout untuk satu template sertifikat, tersusun dari array blok Cover_Page dan array blok Results_Page.
- **Bulk_Operation**: Operasi yang menerapkan perubahan konfigurasi blok ke beberapa template sekaligus.

## Persyaratan

### Persyaratan 1: Penyimpanan Template di Database

**User Story:** Sebagai admin, saya ingin konfigurasi template disimpan di database, sehingga perubahan template tidak memerlukan deployment ulang aplikasi.

#### Kriteria Penerimaan

1. THE Template_Storage SHALL menyimpan setiap template dalam tabel `certificate_templates` dengan kolom: `id` (UUID primary key), `name` (nama template), `certificate_type` (tipe sertifikat), `cover_blocks` (JSONB array blok Cover_Page), `results_blocks` (JSONB array blok Results_Page), `version` (integer), `is_active` (boolean), `created_at` (timestamp), dan `updated_at` (timestamp).
2. WHEN sebuah template disimpan, THE Template_Storage SHALL memvalidasi bahwa `cover_blocks` dan `results_blocks` berisi array JSON yang valid dengan setiap elemen memiliki field `type` (string) dan `properties` (object).
3. THE Template_Storage SHALL mendukung penyimpanan minimal 13 template yang sesuai dengan tipe sertifikat yang ada: `fc`, `lc`, `fc_balai_1` sampai `fc_balai_5`, `lc_balai_1` sampai `lc_balai_5`, dan `standar`.
4. WHEN template diambil berdasarkan `certificate_type`, THE Template_Storage SHALL mengembalikan template dengan `is_active` bernilai TRUE dan `version` tertinggi untuk tipe tersebut.
5. IF template untuk `certificate_type` tertentu tidak ditemukan di database, THEN THE Template_Storage SHALL mengembalikan konfigurasi fallback dari file TypeScript hardcoded yang sudah ada di `lib/pdf-service/templates/`.

### Persyaratan 2: Definisi Block Types

**User Story:** Sebagai admin, saya ingin memiliki pilihan tipe blok yang jelas untuk menyusun template, sehingga saya dapat mengkonfigurasi layout sertifikat sesuai kebutuhan IKK.

#### Kriteria Penerimaan

1. THE Template_Editor SHALL menyediakan tipe blok Cover_Page berikut: `header` (kop surat), `title` (judul sertifikat), `section-table` (tabel section dengan field label-value), `authorization` (teks pengesahan), `qr-code` (kode QR verifikasi), `footer-text` (teks footer/kode formulir), dan `spacer` (pengatur jarak antar elemen).
2. THE Template_Editor SHALL menyediakan tipe blok Results_Page berikut: `repeating-header` (header berulang per halaman), `results-table` (tabel hasil kalibrasi), `repeating-footer` (footer berulang per halaman), dan `end-marker` (penanda akhir sertifikat).
3. WHEN sebuah blok ditambahkan ke template, THE Template_Editor SHALL menyimpan blok tersebut dengan struktur: `id` (unique identifier), `type` (Block_Type), `properties` (object berisi konfigurasi spesifik per tipe), dan `order` (integer posisi dalam array).
4. THE Template_Editor SHALL memvalidasi bahwa setiap blok memiliki properti wajib sesuai tipe blok sebelum menyimpan template ke database.
5. IF admin menambahkan blok dengan properti yang tidak lengkap, THEN THE Template_Editor SHALL menampilkan pesan validasi yang menyebutkan nama properti yang belum diisi.

### Persyaratan 3: Halaman Daftar Template (Admin)

**User Story:** Sebagai admin, saya ingin melihat daftar semua template yang tersedia, sehingga saya dapat memilih template yang akan diedit.

#### Kriteria Penerimaan

1. THE Template_Editor SHALL menampilkan halaman daftar template pada route `/admin/templates` yang memuat semua template dari tabel `certificate_templates` dengan informasi: nama template, tipe sertifikat, versi aktif, dan tanggal terakhir diubah.
2. WHEN admin mengakses halaman daftar template, THE Template_Editor SHALL memverifikasi bahwa pengguna memiliki role `admin` dan menampilkan halaman hanya jika verifikasi berhasil.
3. IF pengguna tanpa role `admin` mengakses route `/admin/templates`, THEN THE Template_Editor SHALL mengarahkan pengguna ke halaman utama dashboard dengan pesan "Akses ditolak".
4. THE Template_Editor SHALL menyediakan tombol "Duplikat" pada setiap template di daftar yang membuat salinan template beserta seluruh konfigurasi bloknya dengan nama baru yang ditentukan admin.
5. THE Template_Editor SHALL menyediakan tombol "Buat Template Baru" yang membuka editor dengan konfigurasi blok kosong dan meminta admin mengisi nama template dan tipe sertifikat.
6. WHEN admin mengklik nama template di daftar, THE Template_Editor SHALL membuka halaman editor untuk template tersebut.

### Persyaratan 4: Editor Blok Template

**User Story:** Sebagai admin, saya ingin mengedit susunan dan properti blok template melalui antarmuka visual, sehingga saya dapat menyesuaikan layout sertifikat tanpa menulis kode.

#### Kriteria Penerimaan

1. THE Template_Editor SHALL menampilkan daftar blok Cover_Page dan daftar blok Results_Page secara terpisah dalam dua panel pada halaman editor, dengan setiap blok menampilkan ikon tipe blok dan label singkat.
2. WHEN admin melakukan drag-and-drop pada sebuah blok, THE Template_Editor SHALL memperbarui urutan blok dalam array dan menyimpan posisi baru ke state editor.
3. WHEN admin mengklik sebuah blok dalam daftar, THE Template_Editor SHALL menampilkan panel properti di sisi kanan yang berisi form input sesuai dengan tipe blok yang dipilih.
4. THE Template_Editor SHALL menyediakan tombol "Tambah Blok" pada setiap panel (Cover_Page dan Results_Page) yang menampilkan dropdown pilihan Block_Type yang tersedia untuk ditambahkan.
5. WHEN admin mengklik tombol hapus pada sebuah blok, THE Template_Editor SHALL menampilkan dialog konfirmasi dan menghapus blok dari array jika admin mengkonfirmasi.
6. THE Template_Editor SHALL menyediakan tombol "Simpan" yang menyimpan seluruh konfigurasi blok (cover_blocks dan results_blocks) ke database sebagai versi baru dari template.
7. IF admin meninggalkan halaman editor dengan perubahan yang belum disimpan, THEN THE Template_Editor SHALL menampilkan dialog peringatan yang menanyakan apakah admin ingin menyimpan atau membuang perubahan.

### Persyaratan 5: Live Preview

**User Story:** Sebagai admin, saya ingin melihat preview real-time dari template yang sedang diedit, sehingga saya dapat memastikan perubahan menghasilkan layout yang benar sebelum menyimpan.

#### Kriteria Penerimaan

1. THE Template_Editor SHALL menampilkan panel Live_Preview di sisi kanan halaman editor yang merender visualisasi sertifikat berdasarkan konfigurasi blok saat ini.
2. WHEN admin mengubah properti blok atau mengubah urutan blok, THE Live_Preview SHALL memperbarui tampilan dalam waktu tidak lebih dari 2 detik setelah perubahan dilakukan.
3. THE Live_Preview SHALL merender preview dalam skala proporsional terhadap ukuran A4 (210mm × 297mm) yang dapat di-scroll jika konten melebihi satu halaman.
4. THE Live_Preview SHALL menampilkan preview Cover_Page dan Results_Page secara terpisah dengan tab atau toggle untuk berpindah antar halaman.
5. WHEN data contoh (sample data) tersedia, THE Live_Preview SHALL menggunakan data contoh untuk mengisi field-field template sehingga admin dapat melihat tampilan dengan data nyata.
6. IF Live_Preview gagal merender karena konfigurasi blok tidak valid, THEN THE Live_Preview SHALL menampilkan pesan error yang menjelaskan blok mana yang menyebabkan kegagalan render.

### Persyaratan 6: Versioning Template

**User Story:** Sebagai admin, saya ingin perubahan template tidak mempengaruhi sertifikat yang sudah diterbitkan, sehingga konsistensi dokumen historis terjaga.

#### Kriteria Penerimaan

1. WHEN admin menyimpan perubahan template, THE Template_Storage SHALL membuat record baru dengan nomor `version` yang di-increment dari versi tertinggi sebelumnya untuk `certificate_type` yang sama, dan menandai record baru sebagai `is_active` = TRUE.
2. WHEN versi baru template disimpan, THE Template_Storage SHALL mengubah `is_active` pada versi sebelumnya menjadi FALSE, sehingga hanya satu versi aktif per `certificate_type` pada satu waktu.
3. THE Template_Storage SHALL mempertahankan semua versi lama template di database tanpa menghapusnya, sehingga versi lama tetap dapat diakses untuk referensi.
4. WHEN sertifikat baru diterbitkan, THE PDF_Service SHALL mencatat `template_version` yang digunakan pada record sertifikat tersebut.
5. WHEN sertifikat lama di-render ulang, THE PDF_Service SHALL menggunakan versi template yang tercatat pada record sertifikat tersebut, bukan versi aktif terbaru.
6. IF versi template yang tercatat pada sertifikat tidak ditemukan di database, THEN THE PDF_Service SHALL menggunakan versi aktif terbaru dan mencatat warning ke log.

### Persyaratan 7: Bulk Operations

**User Story:** Sebagai admin, saya ingin menerapkan perubahan ke beberapa template sekaligus ketika IKK berubah, sehingga saya tidak perlu mengedit satu per satu secara manual.

#### Kriteria Penerimaan

1. THE Template_Editor SHALL menyediakan fitur "Terapkan ke Template Lain" pada halaman editor yang memungkinkan admin memilih satu atau lebih template target dari daftar template yang tersedia.
2. WHEN admin memilih template target dan mengkonfirmasi operasi, THE Template_Editor SHALL menyalin konfigurasi blok (cover_blocks dan results_blocks) dari template sumber ke setiap template target sebagai versi baru.
3. THE Template_Editor SHALL menampilkan dialog konfirmasi sebelum Bulk_Operation dijalankan yang mencantumkan nama semua template target yang akan terpengaruh.
4. WHEN Bulk_Operation selesai, THE Template_Editor SHALL menampilkan ringkasan hasil yang mencakup jumlah template yang berhasil diperbarui dan daftar template yang gagal (jika ada) beserta alasan kegagalan.
5. IF salah satu template target gagal diperbarui selama Bulk_Operation, THEN THE Template_Editor SHALL melanjutkan operasi untuk template target lainnya dan melaporkan kegagalan secara terpisah tanpa membatalkan keseluruhan operasi.

### Persyaratan 8: Integrasi dengan PDF Service

**User Story:** Sebagai pengguna, saya ingin PDF sertifikat dirender berdasarkan konfigurasi template dari database, sehingga perubahan template oleh admin langsung berlaku untuk sertifikat baru.

#### Kriteria Penerimaan

1. WHEN PDF sertifikat diminta, THE PDF_Service SHALL mengambil Template_Config dari tabel `certificate_templates` di database berdasarkan `certificate_type` sertifikat tersebut.
2. THE PDF_Service SHALL mengkonversi format blok dari database (array `cover_blocks` dan `results_blocks`) menjadi objek `TemplateConfig` yang kompatibel dengan Template_Renderer yang sudah ada.
3. IF template untuk `certificate_type` tertentu tidak ditemukan di database, THEN THE PDF_Service SHALL menggunakan konfigurasi hardcoded dari file TypeScript di `lib/pdf-service/templates/` sebagai fallback dan mencatat warning ke log.
4. WHEN template dari database berhasil diambil, THE PDF_Service SHALL merender sertifikat menggunakan konfigurasi blok dari database dengan hasil visual yang identik dengan rendering dari konfigurasi TypeScript yang setara.
5. THE PDF_Service SHALL melakukan caching Template_Config dari database selama 5 menit untuk mengurangi query database pada saat rendering batch sertifikat.

### Persyaratan 9: Block Property Editor

**User Story:** Sebagai admin, saya ingin mengedit properti spesifik setiap tipe blok melalui form yang sesuai, sehingga saya dapat mengkonfigurasi detail tampilan sertifikat.

#### Kriteria Penerimaan

1. WHEN admin memilih blok bertipe `header`, THE Template_Editor SHALL menampilkan form dengan field: nama instansi (agency name), nama laboratorium (lab name), upload logo, style border (double/single/none), dan informasi akreditasi (opsional).
2. WHEN admin memilih blok bertipe `title`, THE Template_Editor SHALL menampilkan form dengan field: judul bahasa Indonesia dan judul bahasa Inggris.
3. WHEN admin memilih blok bertipe `section-table`, THE Template_Editor SHALL menampilkan form dengan field: heading bahasa Indonesia, heading bahasa Inggris, dan daftar field yang dapat ditambah/dihapus/diurutkan ulang (setiap field memiliki label ID, label EN, dan data key).
4. WHEN admin memilih blok bertipe `qr-code`, THE Template_Editor SHALL menampilkan form dengan field: posisi (pilihan: top-left, top-right, bottom-left, bottom-right, cover-bottom-left, cover-bottom-right) dan ukuran (small, medium, large).
5. WHEN admin memilih blok bertipe `footer-text`, THE Template_Editor SHALL menampilkan form dengan field: kode formulir, teks catatan tanda tangan, dan edisi/revisi.
6. WHEN admin memilih blok bertipe `results-table`, THE Template_Editor SHALL menampilkan form dengan field: daftar definisi kolom yang dapat ditambah/dihapus/diurutkan ulang (setiap kolom memiliki header, data key, dan lebar), serta toggle tampilkan kolom ketidakpastian (uncertainty).
7. WHEN admin memilih blok bertipe `spacer`, THE Template_Editor SHALL menampilkan form dengan field: tinggi spacer dalam satuan piksel atau milimeter.

### Persyaratan 10: Migrasi Template Hardcoded ke Database

**User Story:** Sebagai admin, saya ingin template hardcoded yang sudah ada diimpor ke database sebagai data awal, sehingga saya dapat langsung mengedit template yang sudah berfungsi tanpa memulai dari nol.

#### Kriteria Penerimaan

1. THE Template_Storage SHALL menyediakan fungsi migrasi yang membaca seluruh 13 konfigurasi template dari file TypeScript di `lib/pdf-service/templates/` dan menyimpannya ke tabel `certificate_templates` sebagai versi 1.
2. WHEN fungsi migrasi dijalankan, THE Template_Storage SHALL mengkonversi setiap `TemplateConfig` (format TypeScript) menjadi format blok (array `cover_blocks` dan `results_blocks`) yang sesuai dengan skema database.
3. WHEN fungsi migrasi dijalankan dan template untuk `certificate_type` tertentu sudah ada di database, THE Template_Storage SHALL melewati (skip) template tersebut tanpa menimpa data yang sudah ada.
4. THE Template_Storage SHALL mencatat log untuk setiap template yang berhasil dimigrasi dan setiap template yang dilewati, sehingga admin dapat memverifikasi hasil migrasi.
5. WHEN migrasi selesai, THE Template_Storage SHALL memverifikasi bahwa setiap template yang dimigrasi dapat dikonversi kembali menjadi `TemplateConfig` yang valid (round-trip validation) dan melaporkan template yang gagal validasi.
