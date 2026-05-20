# Rencana Implementasi: Python PDF Template Service

## Ringkasan

Implementasi microservice Python FastAPI (`pdf-template-service`) yang menggantikan pipeline konversi DOCX→HTML→PDF berbasis mammoth.js + Playwright. Pendekatan bottom-up: mulai dari Python service, lalu integrasi Next.js, dan terakhir pembersihan kode lama.

## Tasks

- [x] 1. Setup project structure dan konfigurasi Python service
  - [x] 1.1 Buat struktur folder `services/pdf-template-service/` dengan `app/`, `app/routes/`, `app/services/`, `app/models/`, dan `tests/`
    - Buat file `__init__.py` di setiap package
    - Buat `requirements.txt` dengan pinned versions (fastapi, uvicorn, docxtpl, python-docx, PyPDF2, pdf2image, Pillow, pydantic-settings, python-multipart)
    - Buat `pyproject.toml` dengan konfigurasi pytest dan hypothesis
    - Buat `.env.example` dengan variabel `PDF_SERVICE_PORT`, `PDF_TEMPLATE_DIR`, `PDF_CORS_ORIGINS`
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 1.2 Implementasi `app/config.py` — konfigurasi Settings dengan pydantic-settings
    - Baca environment variables: `PDF_SERVICE_PORT`, `PDF_TEMPLATE_DIR`, `PDF_CORS_ORIGINS`
    - Default port 8000, default template dir `./templates/`
    - Property `cors_origins_list` untuk parse comma-separated origins
    - Validasi port range 1024–65535
    - _Requirements: 1.1, 1.5, 1.7, 1.8_

  - [x] 1.3 Implementasi `app/exceptions.py` — custom exception classes
    - `TemplateServiceError` (base), `ValidationError` (400), `TemplateNotFoundError` (404), `ConversionError` (500), `LibreOfficeUnavailableError` (503)
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 3.8, 3.9, 3.11_

  - [x] 1.4 Implementasi `app/models/schemas.py` — Pydantic request/response models
    - `SectionEnum` (cover, results), `UploadResponse`, `RenderRequest`, `HealthResponse`, `ErrorResponse`
    - _Requirements: 2.2, 2.5, 3.1_

  - [x] 1.5 Implementasi `app/main.py` — FastAPI app entry point
    - Konfigurasi CORS middleware dari `PDF_CORS_ORIGINS`
    - Register semua routers
    - Global exception handler untuk `TemplateServiceError`
    - Startup event: cek ketersediaan LibreOffice
    - _Requirements: 1.1, 1.6, 1.8, 1.9_

  - [ ]* 1.6 Write property test untuk validasi konfigurasi port (Property 12)
    - **Property 12: Konfigurasi port valid dalam range 1024-65535**
    - **Validates: Requirements 1.1, 1.5**

- [x] 2. Implementasi service layer Python
  - [x] 2.1 Implementasi `app/services/variable_detector.py` — deteksi variabel dalam .docx
    - Fungsi `detect_variables(template_path)` yang mengembalikan tuple `(variables: list[str], loops: list[str])`
    - Parse XML content dari .docx untuk menemukan pola `{{ ... }}` dan `{% for ... %}`
    - _Requirements: 2.5, 2.6_

  - [ ]* 2.2 Write property test untuk deteksi variabel (Property 3)
    - **Property 3: Deteksi variabel menemukan semua placeholder**
    - **Validates: Requirements 2.5, 2.6**

  - [x] 2.3 Implementasi `app/services/template_renderer.py` — rendering template dengan docxtpl
    - Class `TemplateRenderer` dengan method `render(template_id, section, data) -> Path`
    - Gunakan `docxtpl.DocxTemplate` untuk mengisi variabel
    - Handle missing variables dengan Jinja2 undefined → string kosong
    - Return path ke temporary filled .docx
    - _Requirements: 3.2, 3.3, 3.10_

  - [ ]* 2.4 Write property tests untuk template rendering (Property 4, 5, 6)
    - **Property 4: Rendering template mengisi variabel dengan benar**
    - **Property 5: Loop rendering menghasilkan semua item**
    - **Property 6: Variabel yang tidak ada di data dirender sebagai string kosong**
    - **Validates: Requirements 3.2, 3.3, 3.10**

  - [x] 2.5 Implementasi `app/services/pdf_converter.py` — konversi via LibreOffice headless
    - Class `PDFConverter` dengan method `convert(docx_path) -> Path` dan `convert_to_png(docx_path, dpi) -> Path`
    - Method `is_available()` untuk cek ketersediaan LibreOffice
    - Timeout 30 detik per konversi menggunakan asyncio subprocess
    - _Requirements: 3.4, 3.11, 4.3_

  - [x] 2.6 Implementasi `app/services/pdf_merger.py` — merge multiple PDF
    - Class `PDFMerger` dengan method `merge(pdf_paths: list[Path]) -> Path`
    - Gunakan PyPDF2 untuk menggabungkan PDF sesuai urutan
    - Return path ke merged PDF (temporary file)
    - _Requirements: 3.5, 3.6_

  - [ ]* 2.7 Write property test untuk PDF merge (Property 7)
    - **Property 7: Merge PDF mempertahankan jumlah halaman**
    - **Validates: Requirements 3.5**

  - [x] 2.8 Implementasi `app/services/preview_cache.py` — cache preview PNG
    - Class `PreviewCache` dengan methods `get()`, `put()`, `invalidate()`
    - Cache berdasarkan file modification time
    - Simpan di direktori `cache/{template_id}/`
    - _Requirements: 4.6, 4.7_

  - [ ]* 2.9 Write property test untuk preview cache (Property 9)
    - **Property 9: Preview cache valid berdasarkan modification time**
    - **Validates: Requirements 4.6, 4.7**

- [x] 3. Implementasi API endpoints Python service
  - [x] 3.1 Implementasi `app/routes/health.py` — GET /health endpoint
    - Return status "ok", version semver, dan `libreoffice_available` boolean
    - Response time tidak lebih dari 2 detik
    - _Requirements: 1.2, 1.9_

  - [x] 3.2 Implementasi `app/routes/upload.py` — POST /upload-template endpoint
    - Validasi: file .docx, ukuran <10MB, template_id format valid, section valid
    - Simpan file ke `{template_dir}/{template_id}/{section}.docx`
    - Overwrite jika sudah ada
    - Return path, size_bytes, variables, loops
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ]* 3.3 Write property test untuk validasi template_id (Property 1) dan upload path (Property 2)
    - **Property 1: Validasi template_id menerima yang valid dan menolak yang invalid**
    - **Property 2: Upload menyimpan file pada path yang benar**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.10**

  - [x] 3.4 Implementasi `app/routes/render.py` — POST /render-pdf endpoint
    - Validasi request body (template_id, data)
    - Render cover dan/atau results section
    - Merge jika kedua section ada
    - Return PDF binary dengan content-type application/pdf
    - Cleanup temp files di finally block
    - Timeout total 60 detik
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

  - [ ]* 3.5 Write property test untuk cleanup temp files (Property 8)
    - **Property 8: File temporary dibersihkan setelah render**
    - **Validates: Requirements 3.12**

  - [x] 3.6 Implementasi `app/routes/preview.py` — GET /preview-template endpoint
    - Validasi query params (template_id, section)
    - Cek cache, generate jika expired
    - Return PNG image dengan content-type image/png
    - Resolusi minimal 1200x1600 piksel
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 4. Buat Dockerfile dan docker-compose
  - [x] 4.1 Buat `services/pdf-template-service/Dockerfile`
    - Base image python:3.12-slim
    - Install LibreOffice headless, poppler-utils
    - Install Python dependencies dari requirements.txt
    - Buat direktori templates/ dan cache/
    - CMD uvicorn pada port 8000
    - _Requirements: 1.4_

  - [x] 4.2 Buat `services/pdf-template-service/docker-compose.yml`
    - Service definition dengan build context
    - Volume mount untuk templates/ dan cache/
    - Environment variables
    - Port mapping
    - _Requirements: 1.1, 1.5_

- [x] 5. Checkpoint - Pastikan Python service berjalan
  - Pastikan semua unit tests Python lulus (`pytest` tanpa integration tests)
  - Pastikan Docker build berhasil
  - Tanyakan ke user jika ada pertanyaan

- [ ] 6. Migrasi database dan integrasi Next.js
  - [-] 6.1 Buat file migrasi SQL `database/add_template_path_columns.sql`
    - ALTER TABLE certificate_templates ADD COLUMN cover_template_path VARCHAR(500) DEFAULT NULL
    - ALTER TABLE certificate_templates ADD COLUMN results_template_path VARCHAR(500) DEFAULT NULL
    - Tambahkan COMMENT pada kolom baru
    - _Requirements: 6.1, 6.2, 6.3_

  - [~] 6.2 Update halaman word-upload (`app/admin/templates/[id]/word-upload/page.tsx`)
    - Kirim file ke PDF_Template_Service endpoint POST /upload-template
    - Tampilkan daftar variabel yang terdeteksi dari response
    - Simpan path template ke database (cover_template_path atau results_template_path)
    - Tampilkan preview PNG dari GET /preview-template
    - Validasi client-side: format .docx dan ukuran <10MB
    - Handle error: service tidak tersedia, timeout
    - Hapus pemanggilan endpoint `/api/admin/templates/convert-docx`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [-] 6.3 Implementasi logic routing PDF generation di Next.js
    - Buat utility function yang memilih antara PDF_Template_Service (baru) vs Playwright (fallback)
    - Jika `cover_template_path` terisi → panggil POST /render-pdf
    - Jika `cover_template_path` kosong dan `cover_html` terisi → gunakan Playwright
    - Sama untuk results section
    - _Requirements: 6.4, 6.5, 6.7, 8.7_

  - [ ]* 6.4 Write property test untuk routing logic (Property 11) — fast-check
    - **Property 11: Routing PDF generation berdasarkan template path**
    - **Validates: Requirements 6.4, 6.5, 6.7**

  - [-] 6.5 Implementasi data mapping sertifikat ke format template
    - Buat fungsi mapping data dari database ke variabel template
    - Kategori: data instrumen, data kalibrasi, data stasiun/pemilik, data personel, hasil kalibrasi per sensor
    - Null/kosong → string kosong ("")
    - _Requirements: 8.2, 8.3_

  - [ ]* 6.6 Write property test untuk data mapping (Property 10) — fast-check
    - **Property 10: Data mapping mengkonversi null menjadi string kosong**
    - **Validates: Requirements 8.2, 8.3**

  - [~] 6.7 Implementasi pemanggilan PDF_Template_Service dari Next.js
    - Panggil POST /render-pdf dengan template_id dan data
    - Simpan PDF hasil ke Supabase Storage
    - Update kolom pdf_path pada tabel certificate
    - Handle error: 4xx/5xx dari service, timeout 30 detik, connection refused → 503
    - _Requirements: 8.1, 8.4, 8.5, 8.6_

- [~] 7. Checkpoint - Pastikan integrasi berjalan
  - Pastikan halaman word-upload berfungsi dengan PDF_Template_Service
  - Pastikan generate PDF sertifikat menggunakan service baru untuk template yang sudah dimigrasikan
  - Pastikan fallback ke Playwright masih berfungsi untuk template lama
  - Tanyakan ke user jika ada pertanyaan

- [ ] 8. Pembersihan kode lama (TipTap dan mammoth.js)
  - [~] 8.1 Hapus folder dan file TipTap editor
    - Hapus `lib/rich-text-editor/components/` (seluruh subfolder)
    - Hapus `lib/rich-text-editor/extensions/` (seluruh subfolder)
    - Hapus file TipTap-only: `default-template.ts`, `sample-data.ts`, `validation.ts`, `variable-engine.ts`, `variable-registry.ts`
    - Pertahankan: `types.ts`, `storage-service.ts`, `html-renderer.ts`, `word-template-processor.ts`, `docx-importer.ts`
    - _Requirements: 7.1, 7.2_

  - [~] 8.2 Hapus halaman dan API route TipTap
    - Hapus folder `app/admin/templates/[id]/edit/`
    - Update `app/admin/templates/[id]/page.tsx` agar redirect ke `/admin/templates/[id]/word-upload`
    - Hapus folder `app/api/admin/templates/upload-image/`
    - _Requirements: 7.3, 7.4_

  - [~] 8.3 Hapus dependensi npm TipTap dari package.json
    - Hapus semua package `@tiptap/*` (core, extension-color, extension-font-family, extension-image, extension-table, extension-table-cell, extension-table-header, extension-table-row, extension-text-align, extension-text-style, extension-underline, html, pm, react, starter-kit, suggestion)
    - Jalankan `npm install` untuk update lock file
    - _Requirements: 7.5_

  - [~] 8.4 Hapus file test TipTap dan perbaiki import yang rusak
    - Hapus test files: `validation.test.ts`, `variable-engine.test.ts`, `variable-registry.test.ts`, `image-upload.test.ts`, `html-renderer.test.ts`
    - Pertahankan: `word-template-processor.test.ts`
    - Periksa dan perbaiki semua import yang mereferensi modul yang dihapus
    - Update `app/admin/templates/new/page.tsx` jika mengimport dari modul yang dihapus
    - _Requirements: 7.6, 7.7, 7.8_

- [~] 9. Final checkpoint - Verifikasi build dan tests
  - Jalankan `next build` dan pastikan berhasil tanpa error
  - Jalankan `npm test` dan pastikan semua test lulus (exit code 0)
  - Jalankan `pytest` di Python service dan pastikan semua test lulus
  - Tanyakan ke user jika ada pertanyaan
  - _Requirements: 7.9_

## Catatan

- Tasks bertanda `*` bersifat opsional dan dapat dilewati untuk MVP lebih cepat
- Setiap task mereferensi requirements spesifik untuk traceability
- Checkpoints memastikan validasi inkremental di setiap fase
- Property tests memvalidasi correctness properties universal dari design document
- Unit tests memvalidasi contoh spesifik dan edge cases
- Urutan bottom-up: Python service → integrasi Next.js → pembersihan kode lama

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.5"] },
    { "id": 2, "tasks": ["1.6", "2.1", "2.5", "2.6", "2.8"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.7", "2.9", "3.1"] },
    { "id": 4, "tasks": ["2.4", "3.2", "3.6", "4.1", "4.2"] },
    { "id": 5, "tasks": ["3.3", "3.4"] },
    { "id": 6, "tasks": ["3.5", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.5"] },
    { "id": 8, "tasks": ["6.4", "6.6", "6.7"] },
    { "id": 9, "tasks": ["8.1", "8.2"] },
    { "id": 10, "tasks": ["8.3"] },
    { "id": 11, "tasks": ["8.4"] }
  ]
}
```
