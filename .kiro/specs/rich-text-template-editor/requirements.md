# Dokumen Persyaratan (Requirements)

## Pendahuluan

Sistem saat ini memiliki block-based template editor di `/admin/templates` yang menyimpan konfigurasi template sebagai array blok terstruktur (JSONB). Pendekatan ini efektif untuk layout yang sudah terdefinisi, namun kurang fleksibel ketika admin ingin mengatur formatting teks secara bebas (font size, bold/italic, alignment, tabel custom, border, gambar/logo) tanpa batasan tipe blok yang sudah ditentukan.

Fitur ini membangun **Rich Text Template Editor** berbasis WYSIWYG (TipTap) dengan sistem **template variable placeholders** — mirip konsep mail merge di Microsoft Word. Admin mendesain template sertifikat secara visual dengan kontrol formatting penuh, lalu menyisipkan placeholder variabel seperti `{{nama_alat}}`, `{{tanggal_kalibrasi}}`, `{{nomor_sertifikat}}` yang akan diganti dengan data aktual saat generate PDF.

Pendekatan ini menggantikan block-based editor dengan editor rich text yang lebih intuitif, sambil tetap menggunakan tabel `certificate_templates` yang sudah ada dengan kolom `content` (JSONB) untuk menyimpan dokumen TipTap JSON.

## Glosarium

- **Rich_Text_Editor**: Komponen editor WYSIWYG berbasis TipTap yang memungkinkan admin mendesain template sertifikat dengan kontrol formatting penuh (font, ukuran, warna, alignment, tabel, gambar, border, page layout).
- **Template_Variable**: Placeholder dalam format `{{nama_variabel}}` yang disisipkan ke dalam template dan akan diganti dengan data aktual dari database saat generate PDF sertifikat.
- **Variable_Sidebar**: Panel samping yang menampilkan daftar semua Template_Variable yang tersedia, dikelompokkan berdasarkan kategori (data instrumen, data kalibrasi, data pemilik, personel, hasil kalibrasi).
- **Loop_Syntax**: Sintaks khusus `{{#each collection}}...{{/each}}` untuk mengulang baris tabel berdasarkan data array, digunakan khusus untuk tabel hasil kalibrasi.
- **TipTap_Document**: Representasi JSON dari konten editor TipTap yang menyimpan seluruh struktur dokumen termasuk formatting, tabel, gambar, dan placeholder variabel.
- **PDF_Generator**: Layanan yang mengambil template (TipTap_Document), mengganti semua Template_Variable dengan data aktual, lalu merender HTML final menjadi file PDF.
- **Template_Storage**: Layanan yang menyimpan dan mengambil konfigurasi template dari tabel `certificate_templates` di database Supabase (PostgreSQL), menggunakan kolom `content` (JSONB) untuk menyimpan TipTap_Document.
- **Admin**: Pengguna dengan role admin yang memiliki akses ke Rich_Text_Editor.
- **Live_Preview**: Panel preview yang menampilkan visualisasi sertifikat dengan data contoh, memperlihatkan hasil akhir setelah variabel diganti.
- **Variable_Node**: Custom TipTap node yang merepresentasikan Template_Variable di dalam editor, ditampilkan sebagai badge/chip yang tidak dapat diedit secara parsial.
- **Sample_Data**: Data contoh yang digunakan untuk mengisi Template_Variable pada Live_Preview sehingga admin dapat melihat tampilan sertifikat dengan data nyata.
- **Template_Version**: Versi spesifik dari konfigurasi template yang diidentifikasi oleh nomor versi integer, dipertahankan untuk referensi sertifikat yang sudah diterbitkan.

## Persyaratan

### Persyaratan 1: Rich Text Editor dengan TipTap

**User Story:** Sebagai admin, saya ingin mendesain template sertifikat menggunakan editor WYSIWYG dengan kontrol formatting penuh, sehingga saya dapat membuat layout sertifikat yang fleksibel tanpa menulis kode HTML.

#### Kriteria Penerimaan

1. THE Rich_Text_Editor SHALL menampilkan editor WYSIWYG berbasis TipTap pada halaman `/admin/templates/[id]/edit` dengan toolbar formatting yang mencakup: bold, italic, underline, strikethrough, font family, font size, text color, text alignment (left, center, right, justify), ordered list, unordered list, heading levels (H1-H4), dan horizontal rule.
2. THE Rich_Text_Editor SHALL mendukung penyisipan dan pengeditan tabel dengan fitur: tambah/hapus baris, tambah/hapus kolom, merge cells, pengaturan lebar kolom, dan border style (solid, dashed, none).
3. THE Rich_Text_Editor SHALL mendukung penyisipan gambar/logo melalui upload file (format PNG, JPG, SVG) dengan ukuran maksimal 2MB per file, dan menyimpan gambar ke storage Supabase.
4. THE Rich_Text_Editor SHALL menyediakan pengaturan page layout yang mencakup: ukuran kertas (A4 default, Letter, Legal), orientasi (portrait default, landscape), dan margin halaman (atas, bawah, kiri, kanan) dalam satuan milimeter.
5. THE Rich_Text_Editor SHALL menyimpan seluruh konten editor sebagai TipTap_Document (format JSON) ke kolom `content` pada tabel `certificate_templates`.
6. WHEN admin membuka template yang sudah ada, THE Rich_Text_Editor SHALL memuat TipTap_Document dari database dan menampilkan konten dengan formatting yang utuh sesuai data JSON yang tersimpan.
7. IF admin meng-upload gambar yang melebihi 2MB, THEN THE Rich_Text_Editor SHALL menampilkan pesan error "Ukuran file melebihi batas maksimal 2MB" tanpa menyisipkan gambar ke editor.

### Persyaratan 2: Sistem Template Variable (Placeholder)

**User Story:** Sebagai admin, saya ingin menyisipkan placeholder variabel ke dalam template, sehingga data sertifikat yang berbeda-beda dapat diisi secara otomatis saat generate PDF.

#### Kriteria Penerimaan

1. THE Rich_Text_Editor SHALL mendukung penyisipan Template_Variable sebagai Variable_Node yang ditampilkan sebagai badge/chip berwarna (contoh: badge biru dengan teks `{{nama_alat}}`) yang tidak dapat diedit secara parsial oleh admin.
2. WHEN admin menyisipkan Template_Variable, THE Rich_Text_Editor SHALL menempatkan Variable_Node pada posisi kursor saat ini di dalam editor.
3. THE Rich_Text_Editor SHALL mendukung Template_Variable berikut dari tabel `instruments`: `nama_alat`, `merk`, `tipe`, `no_seri`, `kapasitas`, `resolusi`.
4. THE Rich_Text_Editor SHALL mendukung Template_Variable berikut dari tabel `certificate`: `nomor_sertifikat`, `tanggal_kalibrasi`, `tanggal_terbit`, `metode_kalibrasi`, `suhu`, `kelembaban`, `tempat_kalibrasi`.
5. THE Rich_Text_Editor SHALL mendukung Template_Variable berikut dari tabel `stations`: `nama_stasiun`, `alamat_stasiun`.
6. THE Rich_Text_Editor SHALL mendukung Template_Variable berikut dari tabel `personel`: `nama_penandatangan`, `nip_penandatangan`, `jabatan_penandatangan`, `nama_teknisi`, `nip_teknisi`.
7. WHEN admin menghapus Variable_Node (dengan backspace atau delete), THE Rich_Text_Editor SHALL menghapus seluruh Variable_Node sebagai satu unit, bukan karakter per karakter.
8. IF admin mengetik teks `{{` secara manual di editor, THEN THE Rich_Text_Editor SHALL menampilkan autocomplete dropdown berisi daftar Template_Variable yang tersedia untuk dipilih.

### Persyaratan 3: Variable Sidebar

**User Story:** Sebagai admin, saya ingin melihat daftar semua variabel yang tersedia dalam panel terorganisir, sehingga saya dapat dengan mudah menemukan dan menyisipkan variabel yang dibutuhkan.

#### Kriteria Penerimaan

1. THE Variable_Sidebar SHALL menampilkan panel di sisi kanan editor yang berisi daftar semua Template_Variable yang tersedia, dikelompokkan dalam kategori: "Data Instrumen", "Data Kalibrasi", "Data Pemilik/Stasiun", "Personel", dan "Hasil Kalibrasi".
2. WHEN admin mengklik sebuah Template_Variable di Variable_Sidebar, THE Rich_Text_Editor SHALL menyisipkan Variable_Node yang sesuai pada posisi kursor terakhir di editor.
3. THE Variable_Sidebar SHALL menampilkan setiap Template_Variable dengan nama variabel (contoh: `nama_alat`) dan deskripsi singkat (contoh: "Nama alat yang dikalibrasi").
4. THE Variable_Sidebar SHALL menyediakan field pencarian (search) yang memfilter daftar variabel berdasarkan nama atau deskripsi saat admin mengetik.
5. THE Variable_Sidebar SHALL menampilkan kategori "Hasil Kalibrasi" dengan variabel loop: `titik_ukur`, `pembacaan`, `koreksi`, `ketidakpastian` beserta keterangan bahwa variabel ini digunakan di dalam blok `{{#each hasil_kalibrasi}}`.
6. WHEN editor tidak memiliki fokus (kursor tidak aktif), THE Variable_Sidebar SHALL menonaktifkan tombol insert pada setiap variabel dan menampilkan tooltip "Klik di editor terlebih dahulu".

### Persyaratan 4: Tabel Hasil Kalibrasi dengan Loop

**User Story:** Sebagai admin, saya ingin mendefinisikan baris tabel yang berulang untuk hasil kalibrasi, sehingga tabel hasil dapat menampilkan jumlah baris sesuai data pengukuran yang ada.

#### Kriteria Penerimaan

1. THE Rich_Text_Editor SHALL mendukung Loop_Syntax `{{#each hasil_kalibrasi}}` dan `{{/each}}` sebagai penanda awal dan akhir blok perulangan di dalam tabel.
2. WHEN admin menyisipkan loop dari Variable_Sidebar, THE Rich_Text_Editor SHALL membuat struktur tabel dengan baris header (statis) dan baris template (di dalam loop) yang berisi Variable_Node untuk kolom: `titik_ukur`, `pembacaan`, `koreksi`, dan `ketidakpastian`.
3. THE Rich_Text_Editor SHALL menampilkan penanda visual (highlight atau border berwarna) pada baris tabel yang berada di dalam blok `{{#each}}...{{/each}}` untuk membedakan baris statis dan baris loop.
4. WHEN PDF digenerate, THE PDF_Generator SHALL mengulang baris template di dalam blok `{{#each hasil_kalibrasi}}` untuk setiap record pada tabel `calibration_results` yang terkait dengan sertifikat tersebut.
5. IF blok `{{#each hasil_kalibrasi}}` tidak memiliki pasangan `{{/each}}` yang valid, THEN THE Rich_Text_Editor SHALL menampilkan pesan validasi "Blok loop tidak memiliki penutup {{/each}}" saat admin menyimpan template.
6. THE Rich_Text_Editor SHALL mendukung variabel di dalam loop yang mereferensikan field dari setiap record hasil kalibrasi: `titik_ukur`, `pembacaan`, `koreksi`, `ketidakpastian`, dan `no_urut` (nomor urut otomatis).

### Persyaratan 5: Penyimpanan Template di Database

**User Story:** Sebagai admin, saya ingin template rich text disimpan di database, sehingga perubahan template tidak memerlukan deployment ulang aplikasi.

#### Kriteria Penerimaan

1. THE Template_Storage SHALL menyimpan template rich text dalam tabel `certificate_templates` dengan kolom tambahan `content` (JSONB) yang berisi TipTap_Document, dan kolom `page_settings` (JSONB) yang berisi pengaturan page layout (paper size, orientation, margins).
2. WHEN admin menyimpan template, THE Template_Storage SHALL memvalidasi bahwa kolom `content` berisi JSON yang valid dengan struktur TipTap_Document (memiliki field `type` = "doc" dan field `content` berupa array).
3. THE Template_Storage SHALL mendukung penyimpanan template dengan ukuran `content` hingga 5MB untuk mengakomodasi template kompleks dengan banyak formatting dan embedded images (base64).
4. WHEN template diambil berdasarkan `certificate_type`, THE Template_Storage SHALL mengembalikan template dengan `is_active` bernilai TRUE dan `version` tertinggi untuk tipe tersebut.
5. IF template untuk `certificate_type` tertentu tidak ditemukan di database, THEN THE Template_Storage SHALL mengembalikan null dan PDF_Generator menggunakan template default kosong.
6. THE Template_Storage SHALL menyimpan metadata template yang mencakup: `id` (UUID), `name`, `certificate_type`, `content` (TipTap_Document JSONB), `page_settings` (JSONB), `version` (integer), `is_active` (boolean), `created_at`, dan `updated_at`.

### Persyaratan 6: PDF Generation dengan Variable Replacement

**User Story:** Sebagai pengguna, saya ingin PDF sertifikat digenerate berdasarkan template rich text dengan data aktual, sehingga sertifikat yang dihasilkan memiliki layout sesuai desain admin dan data yang akurat.

#### Kriteria Penerimaan

1. WHEN PDF sertifikat diminta, THE PDF_Generator SHALL mengambil TipTap_Document dari tabel `certificate_templates` berdasarkan `certificate_type` sertifikat tersebut.
2. THE PDF_Generator SHALL mengkonversi TipTap_Document menjadi HTML yang valid dengan seluruh formatting (font, ukuran, warna, alignment, tabel, gambar) dipertahankan.
3. WHEN TipTap_Document dikonversi ke HTML, THE PDF_Generator SHALL mengganti setiap Template_Variable `{{nama_variabel}}` dengan nilai aktual dari database sertifikat yang bersangkutan.
4. WHEN Template_Variable `{{#each hasil_kalibrasi}}...{{/each}}` diproses, THE PDF_Generator SHALL mengulang konten di dalam blok untuk setiap record pada tabel `calibration_results` yang terkait dengan sertifikat, mengganti variabel loop dengan nilai dari setiap record.
5. THE PDF_Generator SHALL merender HTML final menjadi file PDF menggunakan library rendering (Playwright atau Puppeteer) dengan pengaturan page layout sesuai `page_settings` template (paper size, orientation, margins).
6. IF sebuah Template_Variable tidak memiliki nilai di database (null atau undefined), THEN THE PDF_Generator SHALL mengganti variabel tersebut dengan string kosong ("") dan mencatat warning ke log yang menyebutkan nama variabel dan ID sertifikat.
7. THE PDF_Generator SHALL menyelesaikan proses rendering PDF dalam waktu tidak lebih dari 30 detik untuk template dengan kompleksitas standar (maksimal 5 halaman, 50 baris hasil kalibrasi).

### Persyaratan 7: Live Preview dengan Sample Data

**User Story:** Sebagai admin, saya ingin melihat preview template dengan data contoh, sehingga saya dapat memastikan layout dan penempatan variabel sudah benar sebelum template digunakan.

#### Kriteria Penerimaan

1. THE Rich_Text_Editor SHALL menampilkan panel Live_Preview yang merender template dengan Sample_Data, mengganti semua Template_Variable dengan nilai contoh yang representatif.
2. WHEN admin mengubah konten editor atau menyisipkan/menghapus Variable_Node, THE Live_Preview SHALL memperbarui tampilan dalam waktu tidak lebih dari 3 detik setelah perubahan terakhir (debounced).
3. THE Live_Preview SHALL merender preview dalam skala proporsional terhadap ukuran kertas yang dipilih (default A4: 210mm × 297mm) dan menampilkan page break jika konten melebihi satu halaman.
4. THE Live_Preview SHALL menyediakan Sample_Data default yang mencakup contoh nilai untuk semua kategori variabel: data instrumen (contoh: nama_alat = "Timbangan Analitik"), data kalibrasi (contoh: nomor_sertifikat = "LK-001/2024"), data stasiun, personel, dan minimal 3 baris data hasil kalibrasi.
5. WHEN admin mengklik tombol "Ganti Data Contoh", THE Live_Preview SHALL memungkinkan admin memilih sertifikat yang sudah ada dari database untuk digunakan sebagai data preview.
6. IF Template_Variable di dalam template tidak dikenali (tidak ada dalam daftar variabel yang didukung), THEN THE Live_Preview SHALL menampilkan variabel tersebut dengan highlight merah dan tooltip "Variabel tidak dikenali".

### Persyaratan 8: Versioning Template

**User Story:** Sebagai admin, saya ingin perubahan template tidak mempengaruhi sertifikat yang sudah diterbitkan, sehingga konsistensi dokumen historis terjaga.

#### Kriteria Penerimaan

1. WHEN admin menyimpan perubahan template, THE Template_Storage SHALL membuat record baru dengan nomor `version` yang di-increment dari versi tertinggi sebelumnya untuk `certificate_type` yang sama, dan menandai record baru sebagai `is_active` = TRUE.
2. WHEN versi baru template disimpan, THE Template_Storage SHALL mengubah `is_active` pada versi sebelumnya menjadi FALSE, sehingga hanya satu versi aktif per `certificate_type` pada satu waktu.
3. THE Template_Storage SHALL mempertahankan semua versi lama template di database tanpa menghapusnya, sehingga versi lama tetap dapat diakses untuk referensi.
4. WHEN sertifikat baru diterbitkan (status menjadi "completed"), THE PDF_Generator SHALL mencatat `template_version` yang digunakan pada record sertifikat tersebut.
5. WHEN sertifikat lama di-render ulang, THE PDF_Generator SHALL menggunakan versi template yang tercatat pada record sertifikat tersebut, bukan versi aktif terbaru.
6. IF versi template yang tercatat pada sertifikat tidak ditemukan di database, THEN THE PDF_Generator SHALL menggunakan versi aktif terbaru dan mencatat warning ke log yang menyebutkan nomor versi yang tidak ditemukan dan ID sertifikat.

### Persyaratan 9: Kontrol Akses Admin

**User Story:** Sebagai sistem, saya ingin memastikan hanya admin yang dapat mengakses dan mengedit template, sehingga template sertifikat terlindungi dari perubahan yang tidak sah.

#### Kriteria Penerimaan

1. WHEN pengguna mengakses halaman Rich_Text_Editor (`/admin/templates/*`), THE Rich_Text_Editor SHALL memverifikasi bahwa pengguna memiliki role `admin` menggunakan AdminGuard yang sudah ada.
2. IF pengguna tanpa role `admin` mengakses route `/admin/templates/*`, THEN THE Rich_Text_Editor SHALL mengarahkan pengguna ke halaman utama dashboard dengan pesan "Akses ditolak".
3. WHEN API endpoint template (`/api/admin/templates/*`) menerima request, THE Template_Storage SHALL memverifikasi bahwa request berasal dari pengguna dengan role `admin` dan mengembalikan HTTP 403 jika verifikasi gagal.
4. THE Rich_Text_Editor SHALL menggunakan komponen AdminGuard yang sudah ada di `app/admin/templates/components/AdminGuard.tsx` tanpa membuat mekanisme autentikasi baru.

### Persyaratan 10: Import dari Word (Opsional)

**User Story:** Sebagai admin, saya ingin mengimpor file .docx sebagai titik awal template, sehingga saya dapat menggunakan template Word yang sudah ada tanpa mendesain ulang dari nol.

#### Kriteria Penerimaan

1. THE Rich_Text_Editor SHALL menyediakan tombol "Import dari Word" yang menerima file .docx (maksimal 10MB) dan mengkonversi kontennya menjadi TipTap_Document.
2. WHEN file .docx diimpor, THE Rich_Text_Editor SHALL mempertahankan formatting dasar: bold, italic, underline, font size, text alignment, tabel (struktur baris dan kolom), dan gambar embedded.
3. WHEN file .docx diimpor, THE Rich_Text_Editor SHALL menampilkan hasil konversi di editor dan memungkinkan admin mengedit lebih lanjut sebelum menyimpan.
4. IF file yang diupload bukan format .docx yang valid, THEN THE Rich_Text_Editor SHALL menampilkan pesan error "Format file tidak didukung. Gunakan file .docx (Microsoft Word)".
5. WHEN file .docx mengandung teks yang cocok dengan pola `{{nama_variabel}}`, THE Rich_Text_Editor SHALL secara otomatis mengkonversi teks tersebut menjadi Variable_Node yang sesuai jika nama variabel ada dalam daftar variabel yang didukung.
6. IF konversi .docx menghasilkan formatting yang tidak didukung oleh TipTap (contoh: WordArt, SmartArt, embedded OLE objects), THEN THE Rich_Text_Editor SHALL melewati elemen tersebut dan menampilkan notifikasi yang mencantumkan elemen yang tidak dapat dikonversi.
