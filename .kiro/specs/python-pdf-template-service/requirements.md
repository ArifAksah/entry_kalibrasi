# Requirements Document

## Introduction

Fitur ini menggantikan pendekatan konversi DOCX-ke-HTML berbasis mammoth.js yang ada saat ini dengan microservice Python FastAPI terpisah yang menggunakan docxtpl untuk rendering template. Sistem saat ini mengkonversi file .docx menjadi HTML, menyimpan HTML di database, lalu menggunakan Playwright untuk generate PDF. Pendekatan baru ini menyimpan file .docx langsung di filesystem, menggunakan docxtpl (Jinja2-style) untuk mengisi data ke template, lalu mengkonversi ke PDF via LibreOffice headless. Selain itu, semua kode lama terkait TipTap rich-text editor dan mammoth.js converter akan dihapus karena sudah tidak digunakan.

## Glossary

- **PDF_Template_Service**: Microservice Python FastAPI yang menerima request HTTP dari aplikasi Next.js untuk rendering template .docx menjadi PDF.
- **Template_Renderer**: Komponen dalam PDF_Template_Service yang menggunakan library docxtpl untuk mengisi variabel Jinja2 dalam file .docx dengan data sertifikat.
- **PDF_Converter**: Komponen dalam PDF_Template_Service yang mengkonversi file .docx yang sudah diisi data menjadi file PDF menggunakan LibreOffice headless.
- **Template_Storage**: Direktori filesystem pada server PDF_Template_Service tempat file .docx template disimpan.
- **Next_App**: Aplikasi Next.js dashboard yang memanggil PDF_Template_Service via HTTP untuk operasi template dan PDF.
- **Certificate_Templates_Table**: Tabel database `certificate_templates` yang menyimpan metadata template termasuk path file .docx.
- **Template_Variable**: Placeholder dalam file .docx menggunakan sintaks Jinja2 ({{ variable_name }}) yang akan diganti dengan data sertifikat saat rendering.
- **Loop_Variable**: Struktur perulangan dalam template menggunakan sintaks Jinja2 ({% for item in items %}) untuk data berulang seperti hasil kalibrasi per sensor.

## Requirements

### Requirement 1: FastAPI Microservice Setup

**User Story:** Sebagai developer, saya ingin microservice Python FastAPI yang terpisah dari Next.js app, sehingga rendering template .docx dan konversi PDF dapat dilakukan dengan library Python yang lebih mature.

#### Acceptance Criteria

1. THE PDF_Template_Service SHALL berjalan sebagai aplikasi FastAPI pada port yang dikonfigurasi via environment variable `PDF_SERVICE_PORT` (default: 8000), dengan nilai port yang valid antara 1024 sampai 65535.
2. THE PDF_Template_Service SHALL menyediakan endpoint health check `GET /health` yang mengembalikan response JSON dengan HTTP status 200 berisi field `status` (nilai "ok"), `version` (string versi semver dari service), dan `libreoffice_available` (boolean yang mengindikasikan apakah LibreOffice headless terdeteksi), dalam waktu tidak lebih dari 2 detik.
3. THE PDF_Template_Service SHALL menggunakan uvicorn sebagai ASGI server.
4. THE PDF_Template_Service SHALL memiliki Dockerfile yang menginstall semua dependensi termasuk LibreOffice headless, docxtpl, dan dependency Python lainnya yang dibutuhkan untuk rendering template dan konversi PDF.
5. THE PDF_Template_Service SHALL membaca konfigurasi dari environment variables berikut: `PDF_SERVICE_PORT` (port server), `PDF_TEMPLATE_DIR` (path direktori template), dan `PDF_CORS_ORIGINS` (daftar allowed origins dipisahkan koma).
6. THE PDF_Template_Service SHALL mengaktifkan CORS dengan origin yang dikonfigurasi via environment variable `PDF_CORS_ORIGINS` untuk menerima request dari Next_App.
7. IF environment variable `PDF_TEMPLATE_DIR` tidak diset, THEN THE PDF_Template_Service SHALL menggunakan default path `./templates/`.
8. IF environment variable `PDF_CORS_ORIGINS` tidak diset atau kosong, THEN THE PDF_Template_Service SHALL menolak semua cross-origin request dan mencatat warning ke log yang menyebutkan bahwa CORS origins belum dikonfigurasi.
9. IF PDF_Template_Service gagal mendeteksi LibreOffice headless saat startup, THEN THE PDF_Template_Service SHALL tetap berjalan namun endpoint `GET /health` SHALL mengembalikan field `libreoffice_available` bernilai `false`, dan endpoint rendering PDF SHALL mengembalikan error 503 dengan pesan yang mengindikasikan bahwa LibreOffice tidak tersedia.

### Requirement 2: Upload Template Endpoint

**User Story:** Sebagai admin, saya ingin mengupload file .docx template ke microservice, sehingga template tersimpan di filesystem dan siap digunakan untuk rendering.

#### Acceptance Criteria

1. WHEN admin mengirim request `POST /upload-template` dengan file .docx via multipart form data, THE PDF_Template_Service SHALL menyimpan file tersebut ke Template_Storage dan mengembalikan HTTP status 201.
2. THE PDF_Template_Service SHALL menerima parameter `template_id` (string, 1–100 karakter, hanya alfanumerik, hyphen, dan underscore) dan `section` (enum: "cover", "results") bersama file upload untuk menentukan lokasi penyimpanan.
3. THE PDF_Template_Service SHALL menyimpan file dengan struktur path `{template_directory}/{template_id}/{section}.docx`.
4. IF file sudah ada pada path target `{template_directory}/{template_id}/{section}.docx`, THEN THE PDF_Template_Service SHALL menimpa (overwrite) file yang sudah ada dengan file baru yang diupload.
5. WHEN file berhasil disimpan, THE PDF_Template_Service SHALL mengembalikan response JSON berisi path file yang tersimpan, ukuran file dalam bytes, daftar nama Template_Variable (pola `{{ ... }}`) yang terdeteksi, dan daftar nama Loop_Variable (pola `{% for ... %}`) yang terdeteksi dalam dokumen.
6. THE PDF_Template_Service SHALL mendeteksi semua Template_Variable ({{ ... }}) dan Loop_Variable ({% for ... %}) dalam file .docx yang diupload.
7. IF file yang diupload bukan format .docx, THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang mengindikasikan format file tidak didukung.
8. IF ukuran file melebihi 10MB, THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang mengindikasikan ukuran file melebihi batas maksimal 10MB.
9. IF template_id atau section tidak disertakan dalam request, THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang menjelaskan parameter yang hilang.
10. IF template_id mengandung karakter selain alfanumerik, hyphen, atau underscore, atau melebihi 100 karakter, THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang mengindikasikan format template_id tidak valid.
11. IF nilai section bukan "cover" atau "results", THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang mengindikasikan nilai section tidak valid.

### Requirement 3: Render PDF Endpoint

**User Story:** Sebagai sistem, saya ingin mengirim data sertifikat ke microservice dan menerima file PDF yang sudah diisi, sehingga sertifikat kalibrasi dapat digenerate secara otomatis.

#### Acceptance Criteria

1. WHEN Next_App mengirim request `POST /render-pdf` dengan JSON body berisi `template_id` (string, tidak kosong) dan `data` (object), THE PDF_Template_Service SHALL mengisi template .docx dengan data tersebut dan mengembalikan file PDF dalam waktu tidak lebih dari 60 detik sejak request diterima.
2. THE Template_Renderer SHALL menggunakan library docxtpl untuk mengisi Template_Variable dalam file .docx dengan nilai dari field `data`.
3. THE Template_Renderer SHALL mendukung Loop_Variable untuk data berulang seperti daftar sensor dan hasil kalibrasi menggunakan sintaks Jinja2 `{% for item in items %}`.
4. THE PDF_Converter SHALL mengkonversi file .docx yang sudah diisi menjadi PDF menggunakan LibreOffice headless mode dengan timeout maksimal 30 detik per file.
5. WHEN template memiliki section "cover" dan "results", THE PDF_Template_Service SHALL merender kedua section secara terpisah lalu menggabungkan menjadi satu file PDF dengan urutan: section "cover" sebagai halaman pertama, diikuti section "results" sebagai halaman berikutnya.
6. WHEN template hanya memiliki satu section ("cover" atau "results"), THE PDF_Template_Service SHALL merender section tersebut dan mengembalikan hasilnya sebagai file PDF tunggal tanpa proses penggabungan.
7. THE PDF_Template_Service SHALL mengembalikan response dengan content-type `application/pdf` dan file PDF sebagai body.
8. IF template_id tidak ditemukan di Template_Storage, THEN THE PDF_Template_Service SHALL mengembalikan error 404 dengan pesan "Template tidak ditemukan".
9. IF request body tidak mengandung field `template_id` atau field `data`, atau jika `template_id` berupa string kosong, THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang menjelaskan field yang hilang atau tidak valid.
10. IF data yang dikirim tidak mengandung Template_Variable atau Loop_Variable yang dibutuhkan template, THEN THE PDF_Template_Service SHALL tetap merender template dengan Template_Variable kosong (string kosong) dan Loop_Variable sebagai list kosong (tidak menghasilkan iterasi) tanpa error.
11. IF LibreOffice gagal mengkonversi file atau tidak merespons dalam batas waktu 30 detik, THEN THE PDF_Template_Service SHALL mengembalikan error 500 dengan pesan "Gagal mengkonversi dokumen ke PDF" dan log detail error.
12. THE PDF_Template_Service SHALL menghapus file temporary (filled .docx dan intermediate files) segera setelah response dikirim atau setelah proses gagal, sebelum request handler selesai.

### Requirement 4: Preview Template Endpoint

**User Story:** Sebagai admin, saya ingin melihat preview template yang sudah diupload, sehingga saya bisa memverifikasi layout dan variabel sebelum digunakan.

#### Acceptance Criteria

1. WHEN admin mengirim request `GET /preview-template?template_id={id}&section={section}`, THE PDF_Template_Service SHALL mengembalikan response dengan content-type `image/png` berisi gambar preview halaman pertama template tersebut.
2. THE PDF_Template_Service SHALL menghasilkan preview berupa gambar PNG dari halaman pertama template dengan resolusi minimal 1200x1600 piksel.
3. THE PDF_Template_Service SHALL menggunakan LibreOffice headless untuk mengkonversi .docx ke PDF, lalu mengekstrak halaman pertama sebagai gambar PNG.
4. IF template_id tidak ditemukan atau section tidak ditemukan di Template_Storage, THEN THE PDF_Template_Service SHALL mengembalikan error 404 dengan pesan "Template tidak ditemukan".
5. IF parameter section memiliki nilai selain "cover" atau "results", THEN THE PDF_Template_Service SHALL mengembalikan error 400 dengan pesan yang menjelaskan nilai section yang valid.
6. IF file template tidak berubah sejak preview terakhir digenerate (berdasarkan modified time file), THEN THE PDF_Template_Service SHALL mengembalikan hasil preview dari cache tanpa melakukan konversi ulang.
7. WHEN file template berubah (modified time lebih baru dari cache), THE PDF_Template_Service SHALL mengenerate ulang preview dan memperbarui cache.
8. IF LibreOffice gagal mengkonversi template saat generate preview, THEN THE PDF_Template_Service SHALL mengembalikan error 500 dengan pesan "Gagal menggenerate preview template" dan log detail error.

### Requirement 5: Update Halaman Word Upload di Next.js

**User Story:** Sebagai admin, saya ingin halaman upload template Word mengirim file langsung ke microservice Python, sehingga file .docx tersimpan di filesystem tanpa konversi ke HTML.

#### Acceptance Criteria

1. WHEN admin mengupload file .docx di halaman word-upload, THE Next_App SHALL mengirim file tersebut ke endpoint `POST /upload-template` pada PDF_Template_Service beserta parameter `template_id` (ID template saat ini) dan `section` (enum: "cover" atau "results") via multipart form data.
2. WHEN PDF_Template_Service mengembalikan response sukses dari upload, THE Next_App SHALL menampilkan daftar Template_Variable yang terdeteksi dari response tersebut sebagai daftar tag dalam UI (menampilkan nama variabel yang ditemukan dalam dokumen).
3. WHEN upload berhasil, THE Next_App SHALL menyimpan path file template yang dikembalikan oleh PDF_Template_Service ke Certificate_Templates_Table pada kolom `cover_template_path` (untuk section "cover") atau `results_template_path` (untuk section "results").
4. WHEN template sudah berhasil diupload, THE Next_App SHALL menampilkan preview template berupa gambar PNG yang diambil dari endpoint `GET /preview-template?template_id={id}&section={section}` pada PDF_Template_Service sebagai pengganti preview HTML.
5. THE Next_App SHALL tidak lagi memanggil endpoint `/api/admin/templates/convert-docx` (mammoth.js).
6. IF PDF_Template_Service tidak dapat dihubungi (connection refused atau timeout melebihi 30 detik), THEN THE Next_App SHALL menampilkan pesan error "Service template tidak tersedia. Pastikan service Python berjalan."
7. IF file yang dipilih admin bukan format .docx atau ukurannya melebihi 10MB, THEN THE Next_App SHALL menampilkan pesan error validasi tanpa mengirim request ke PDF_Template_Service.

### Requirement 6: Update Skema Database

**User Story:** Sebagai developer, saya ingin skema database menyimpan path file template .docx, sehingga sistem tahu lokasi template untuk setiap tipe sertifikat.

#### Acceptance Criteria

1. THE Certificate_Templates_Table SHALL memiliki kolom baru `cover_template_path` (VARCHAR 500, nullable, default NULL) untuk menyimpan path relatif file template cover dengan ekstensi `.docx`.
2. THE Certificate_Templates_Table SHALL memiliki kolom baru `results_template_path` (VARCHAR 500, nullable, default NULL) untuk menyimpan path relatif file template hasil dengan ekstensi `.docx`.
3. THE Certificate_Templates_Table SHALL mempertahankan kolom `cover_html` dan `results_html` yang ada untuk backward compatibility selama kedua kolom `cover_template_path` dan `results_template_path` belum terisi pada semua template aktif.
4. IF kolom `cover_template_path` terisi dengan nilai non-empty string, THEN THE Next_App SHALL menggunakan PDF_Template_Service untuk generate PDF cover (bukan Playwright HTML rendering).
5. IF kolom `cover_template_path` kosong atau NULL dan kolom `cover_html` terisi dengan nilai non-null, THEN THE Next_App SHALL menggunakan metode lama (Playwright HTML rendering) sebagai fallback untuk generate PDF cover.
6. IF kolom `cover_template_path` terisi tetapi file pada path tersebut tidak ditemukan, THEN THE Next_App SHALL mengembalikan error yang mengindikasikan file template tidak ditemukan beserta path yang dicari.
7. IF kolom `results_template_path` terisi dengan nilai non-empty string, THEN THE Next_App SHALL menggunakan PDF_Template_Service untuk generate PDF halaman hasil (bukan Playwright HTML rendering).

### Requirement 7: Pembersihan Kode Lama

**User Story:** Sebagai developer, saya ingin menghapus semua kode terkait TipTap editor dan mammoth.js converter yang sudah tidak digunakan, sehingga codebase lebih bersih dan maintainable.

#### Acceptance Criteria

1. THE Next_App SHALL menghapus subfolder `lib/rich-text-editor/components/` (komponen TipTap: RichTextEditor, EditorToolbar, LivePreviewPanel, LoopNodeView, PageSettingsPanel, VariableNodeView, VariableSidebar) dan subfolder `lib/rich-text-editor/extensions/` (ekstensi TipTap: image-upload, loop-node, page-break, variable-node, variable-suggestion).
2. THE Next_App SHALL menghapus file-file TipTap-only di `lib/rich-text-editor/`: `default-template.ts`, `sample-data.ts`, `validation.ts`, `variable-engine.ts`, dan `variable-registry.ts`, sambil mempertahankan file yang masih digunakan oleh fitur word-upload dan PDF service (`types.ts`, `storage-service.ts`, `html-renderer.ts`, `word-template-processor.ts`, `docx-importer.ts`).
3. THE Next_App SHALL menghapus folder `app/admin/templates/[id]/edit/` (halaman TipTap editor) dan memperbarui `app/admin/templates/[id]/page.tsx` agar redirect ke `/admin/templates/[id]/word-upload` (bukan ke `/edit` yang sudah dihapus).
4. THE Next_App SHALL menghapus folder `app/api/admin/templates/upload-image/` (Supabase Storage image uploader khusus TipTap).
5. THE Next_App SHALL menghapus dependensi npm khusus TipTap dari package.json (`@tiptap/core`, `@tiptap/extension-color`, `@tiptap/extension-font-family`, `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-table-row`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-underline`, `@tiptap/html`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/suggestion`) dan menjalankan ulang package manager untuk memperbarui lock file.
6. THE Next_App SHALL menghapus file-file test TipTap-only di `__tests__/rich-text-editor/`: `validation.test.ts`, `variable-engine.test.ts`, `variable-registry.test.ts`, `image-upload.test.ts`, dan `html-renderer.test.ts`, sambil mempertahankan `word-template-processor.test.ts` yang menguji fitur aktif.
7. IF ada file di luar `lib/rich-text-editor/` yang mengimport modul yang sudah dihapus (khususnya `validation.ts`, `variable-engine.ts`, `variable-registry.ts`, `default-template.ts`, `sample-data.ts`, atau komponen/ekstensi TipTap), THEN THE Next_App SHALL menghapus atau memperbarui import tersebut agar tidak terjadi build error.
8. IF file `app/admin/templates/new/page.tsx` mengimport `DEFAULT_TEMPLATE_CONTENT` dari `lib/rich-text-editor/default-template` atau `DEFAULT_PAGE_SETTINGS` dari `lib/rich-text-editor/types`, THEN THE Next_App SHALL memperbarui halaman tersebut untuk menghapus referensi TipTap yang tidak lagi relevan dengan alur word-upload.
9. WHEN semua kode lama dihapus dan import diperbarui, THE Next_App SHALL berhasil menjalankan `next build` tanpa error dan seluruh test suite yang tersisa lulus (`npm test` exit code 0).

### Requirement 8: Integrasi Generate PDF Sertifikat

**User Story:** Sebagai sistem, saya ingin proses generate PDF sertifikat menggunakan PDF_Template_Service untuk template yang sudah dimigrasikan, sehingga kualitas PDF lebih baik dengan layout asli dari Word.

#### Acceptance Criteria

1. WHEN sertifikat akan digenerate dan template memiliki `cover_template_path` terisi, THE Next_App SHALL memanggil endpoint `POST /render-pdf` pada PDF_Template_Service dengan JSON body berisi `template_id` (dari Certificate_Templates_Table) dan object `data` berisi variabel sertifikat.
2. THE Next_App SHALL menyusun object `data` yang dikirim ke PDF_Template_Service berisi variabel dari kategori: data instrumen, data kalibrasi, data stasiun/pemilik, data personel, dan hasil kalibrasi per sensor.
3. THE Next_App SHALL memetakan data dari database ke format variabel template sesuai mapping yang didefinisikan di kode (contoh: `instrument.name` → `nama_alat`), dan jika field sumber bernilai null atau kosong, THE Next_App SHALL mengirim string kosong ("") sebagai nilai variabel tersebut.
4. WHEN PDF_Template_Service mengembalikan response dengan content-type `application/pdf`, THE Next_App SHALL menyimpan file PDF ke Supabase Storage pada bucket dan path yang sama dengan sistem PDF saat ini, lalu memperbarui kolom `pdf_path` pada tabel certificate.
5. IF PDF_Template_Service mengembalikan HTTP status 4xx atau 5xx, THEN THE Next_App SHALL mencatat error di log (termasuk status code dan response body) dan mengembalikan pesan error ke user yang menyebutkan tahap kegagalan (rendering atau konversi).
6. IF PDF_Template_Service tidak merespons dalam waktu 30 detik atau koneksi ditolak (connection refused), THEN THE Next_App SHALL mengembalikan HTTP 503 dengan pesan "Service PDF tidak tersedia, coba lagi nanti".
7. WHEN `cover_template_path` kosong dan `cover_html` terisi pada template, THE Next_App SHALL menggunakan metode Playwright HTML rendering yang ada sebagai fallback.
