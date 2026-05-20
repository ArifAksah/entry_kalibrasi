# Implementation Plan: Flexible Certificate PDF Service

## Overview

Transform the monolithic PDF generation system into a modular, template-driven architecture using the Template Registry pattern. Implementation follows a bottom-up approach: define types/interfaces first, add database fields, then build core components (Type Determinator, Template Registry, Template Renderer), create all 13 template configs, refactor the print page, update the PDF Service facade, and finally wire everything together with the existing API endpoints and BSrE signing flow.

## Tasks

- [x] 1. Set up project structure, core interfaces, and database migration
  - [x] 1.1 Create TypeScript interfaces and types for the PDF service
    - Create `lib/pdf-service/types.ts` with all interfaces: `TemplateConfig`, `HeaderConfig`, `CoverPageConfig`, `ResultsPageConfig`, `FooterConfig`, `StylingConfig`, `CoverSection`, `CoverField`, `RenderResult`, `RenderOptions`, `PdfServiceResult`, `PdfServiceError`
    - Define `CertificateType` union type with all 13 valid types
    - Define `CertificateTypeInput` interface for type determination input
    - _Requirements: 1.3, 2.1, 3.4, 3.5_

  - [x] 1.2 Create database migration for new certificate fields
    - Create `database/add_certificate_balai_and_standard.sql`
    - Add `balai_id INTEGER NULL` column to `certificate` table (values 1–5, references which Balai)
    - Add `is_standard BOOLEAN DEFAULT FALSE` column to `certificate` table
    - Add CHECK constraint on `balai_id` to ensure values are between 1 and 5 when not null
    - Include rollback instructions as comments
    - _Requirements: 9.3, 9.4_

  - [x] 1.3 Create shared Balai data module
    - Create `lib/pdf-service/templates/shared/balai-data.ts` with `BalaiInfo` interface and `BALAI_DATA` record for all 5 Balai (names, addresses, logo paths)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 1.4 Create shared base styles module
    - Create `lib/pdf-service/templates/shared/base-styles.ts` with shared styling constants (font family, base font size, page margins, border styles)
    - _Requirements: 2.1, 2.4_

- [x] 2. Implement Type Determinator
  - [x] 2.1 Implement the `determineCertificateType` function
    - Create `lib/pdf-service/type-determinator.ts`
    - Implement priority-based type determination: (1) `is_standard` → `'standar'`, (2) `balai_id` not null → format gabungan, (3) `calibration_place` → `'fc'` or `'lc'`, (4) fallback → `'fc'` with warning
    - Handle legacy fields (`calibration_kind`, `certificate_type`) for backward compatibility
    - Log warnings for fallback cases with certificate ID context
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.2, 10.3_

  - [ ] 2.2 Write property test for Type Determinator — Priority rules
    - **Property 6: Certificate type determination follows priority rules**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.2, 10.3**
    - Use `fast-check` to generate arbitrary `CertificateTypeInput` values and verify priority ordering holds

  - [ ] 2.3 Write unit tests for Type Determinator
    - Test specific examples: FC no balai → `'fc'`, LC no balai → `'lc'`, FC balai_id=3 → `'fc_balai_3'`, is_standard=true with balai_id=2 → `'standar'`, all null → `'fc'`
    - Test legacy field handling and warning logging
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 3. Implement Template Registry
  - [x] 3.1 Implement the `TemplateRegistry` class
    - Create `lib/pdf-service/template-registry.ts`
    - Implement `register()` with validation: check all required fields (header, coverPage, resultsPage, footer, styling), reject incomplete configs with missing field names, reject duplicate registrations
    - Implement `get()` that returns config or throws error with requested type + list of available types
    - Implement `has()` and `listTypes()` utility methods
    - Export `createTemplateRegistry()` factory and `defaultRegistry` singleton
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.7_

  - [ ] 3.2 Write property test for Template Registry — Registration round-trip
    - **Property 1: Template registration round-trip**
    - **Validates: Requirements 1.1, 1.2**
    - Use `fast-check` to generate valid TemplateConfig objects and verify round-trip consistency

  - [ ] 3.3 Write property test for Template Registry — Unknown type error
    - **Property 2: Unknown type lookup produces informative error**
    - **Validates: Requirements 1.4**
    - Use `fast-check` to generate arbitrary strings not in registered types and verify error message content

  - [ ] 3.4 Write property test for Template Registry — Incomplete config validation
    - **Property 3: Incomplete config validation rejects with missing field names**
    - **Validates: Requirements 1.5, 2.6**
    - Use `fast-check` to generate configs with random fields removed and verify error lists missing fields

  - [ ] 3.5 Write property test for Template Registry — Duplicate registration
    - **Property 4: Duplicate registration rejection**
    - **Validates: Requirements 1.6**
    - Use `fast-check` to verify that registering same type twice always throws

  - [ ] 3.6 Write property test for Template Registry — Template isolation
    - **Property 5: Template isolation**
    - **Validates: Requirements 2.5, 2.7, 6.5**
    - Use `fast-check` to verify modifying one config does not affect another registered config

- [x] 4. Checkpoint - Core components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create template configurations
  - [x] 5.1 Create FC (Field Calibration) template config
    - Create `lib/pdf-service/templates/fc.ts`
    - Define header with "BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA" and "LABORATORIUM KALIBRASI BMKG", double border-bottom
    - Define Cover_Page with "SERTIFIKAT KALIBRASI" / "CALIBRATION CERTIFICATE" titles, instrument details section (4 rows), owner identification section (2 rows)
    - Define Results_Page with repeating header/footer, one sensor per page
    - Define footer with form code "F/IKK 7.8.2", QR code position, office address, signature note
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 5.2 Create LC (Lab Calibration) template config
    - Create `lib/pdf-service/templates/lc.ts`
    - Define header with accreditation number "LK-095-IDN", accreditation body, scope
    - Define Cover_Page with accreditation information section
    - Define Results_Page with uncertainty column enabled
    - Define footer with LC-specific form code (different from FC's "F/IKK 7.8.2")
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.3 Create FC Balai 1–5 template configs
    - Create `lib/pdf-service/templates/fc-balai-1.ts` through `fc-balai-5.ts`
    - Each config uses Balai-specific header (name, logo, address) from `balai-data.ts`
    - Cover_Page elements (instrument details, owner identification, title) follow FC format
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 5.4 Create LC Balai 1–5 template configs
    - Create `lib/pdf-service/templates/lc-balai-1.ts` through `lc-balai-5.ts`
    - Each config uses Balai-specific header from `balai-data.ts`
    - Cover_Page elements follow LC format (with accreditation)
    - Results_Page includes uncertainty column
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 5.5 Create Standar (Standard) template config
    - Create `lib/pdf-service/templates/standar.ts`
    - Define header with "SERTIFIKAT KALIBRASI STANDAR" / "STANDARD CALIBRATION CERTIFICATE"
    - Define traceability section with fields: instrument name, serial number, reference certificate number, traceable_to_si_through
    - Define validity dates display (DD-MM-YYYY format)
    - Handle missing traceability data with "belum dilengkapi" placeholder
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.6 Create template auto-registration index
    - Create `lib/pdf-service/templates/index.ts`
    - Import all 13 template configs and register them with the `defaultRegistry`
    - _Requirements: 1.1, 1.3_

- [x] 6. Implement Template Renderer
  - [x] 6.1 Implement the `TemplateRenderer` class
    - Create `lib/pdf-service/template-renderer.ts`
    - Implement `render()` method that orchestrates Playwright to navigate to the print page with type query parameter
    - Generate PDF in A4 portrait (210mm × 297mm) with 0mm margin
    - Return `RenderResult` with PDF buffer, file size, file name (convention: `certificate_{safe_number}_{id}.pdf`), and certificate type
    - Implement timeout handling (120s overall, 60s navigation, 30s content readiness)
    - Handle `simulateSigned` option for visual-only signature rendering
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.5_

  - [ ] 6.2 Write unit tests for Template Renderer
    - Test PDF metadata generation (file name convention, file size)
    - Test timeout handling and error responses
    - Test `simulateSigned` flag behavior
    - Mock Playwright for isolated testing
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [x] 7. Refactor print page to support template-driven rendering
  - [x] 7.1 Update the print page to accept `type` query parameter
    - Modify `app/certificates/[id]/print/page.tsx` to read `type` query parameter
    - Load appropriate template config based on type (fallback to `'fc'` for backward compatibility)
    - Render Cover_Page and Results_Page components based on template config
    - _Requirements: 2.2, 2.3, 2.5, 10.1, 10.4_

  - [x] 7.2 Create reusable Cover_Page component
    - Create a Cover_Page component that renders header, title, sections (instrument details, owner identification) based on `CoverPageConfig` and `HeaderConfig`
    - Support Balai-specific header rendering (logo, name, address)
    - Support accreditation display for LC types
    - Support traceability section for standar type
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 6.1, 6.2, 6.7, 7.1, 7.4, 7.5_

  - [x] 7.3 Create reusable Results_Page component
    - Create a Results_Page component that renders calibration results table with repeating `<thead>` header and `<tfoot>` footer
    - Support one-sensor-per-page layout (FC) and uncertainty column (LC)
    - Handle empty results with "Tidak ada data hasil kalibrasi" message and end-of-certificate marker
    - Render QR code when `public_id` is present and `showQRCode` is true
    - _Requirements: 4.5, 4.6, 4.7, 5.3, 8.4_

  - [ ] 7.4 Write property test for rendered output — Header content
    - **Property 7: Rendered output reflects template config header**
    - **Validates: Requirements 2.2, 2.3, 4.1, 5.1, 6.1**
    - Verify HTML output contains agencyName and labName from config header

  - [ ] 7.5 Write property test for rendered output — QR code inclusion
    - **Property 8: QR code inclusion when public_id present**
    - **Validates: Requirements 8.4**
    - Verify QR code element is present and contains public_id in URL when conditions are met

- [ ] 8. Checkpoint - Templates and rendering
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement PDF Service Facade and BSrE integration
  - [x] 9.1 Implement the PDF Service facade
    - Create `lib/pdf-service/index.ts`
    - Implement `generateAndSaveCertificatePDF(certificateId, userId?, passphrase?, simulateSigned?)` with same signature as existing function
    - Orchestrate pipeline: fetch certificate data → determine type → get template → render → sign (if passphrase) → store → return result
    - Implement error handling with stage-specific error responses
    - Upload PDF to Supabase Storage bucket `certificate-pdfs` at path `signed/certificate_{nomorSertifikat}_{certificateId}.pdf`
    - Update `pdf_path` column on certificate table after successful storage
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 8.1, 8.2, 8.3, 8.6, 8.7, 10.5_

  - [x] 9.2 Implement BSrE signing integration within the facade
    - Integrate BSrE signing when passphrase is provided (non-null)
    - Generate PDF without encryption/password/embedded signatures for BSrE compatibility
    - Handle BSrE error responses: timeout (120s), invalid passphrase, NIK not found, connection failure
    - Do not change certificate verification status on BSrE failure
    - _Requirements: 8.1, 8.2, 8.6_

  - [ ] 9.3 Write unit tests for PDF Service facade
    - Test full pipeline orchestration with mocked dependencies
    - Test error handling at each stage (type determination, template lookup, rendering, signing, storage)
    - Test backward-compatible return format `{ success: true, pdfPath: string }`
    - Test timeout behavior (120s overall)
    - _Requirements: 3.5, 3.6, 8.6, 10.5_

- [x] 10. Wire up API endpoints for backward compatibility
  - [x] 10.1 Update `/api/certificates/[id]/download-pdf` endpoint
    - Refactor to use new `generateAndSaveCertificatePDF` from `lib/pdf-service/index.ts`
    - Maintain same request parameters and response headers (Content-Type: application/pdf)
    - _Requirements: 10.4_

  - [x] 10.2 Update `/api/certificates/[id]/pdf` endpoint
    - Refactor to use new PDF service for on-demand generation
    - Maintain same GET method and response Content-Type
    - _Requirements: 10.4_

  - [x] 10.3 Update verification/signing endpoints to use new PDF service
    - Update `/api/certificate-verification/sign-level-3` to call new `generateAndSaveCertificatePDF`
    - Ensure BSrE signing flow works with new service
    - _Requirements: 8.2, 8.7, 10.4_

  - [ ] 10.4 Write integration tests for API endpoints
    - Test `GET /api/certificates/[id]/download-pdf` returns valid PDF
    - Test `GET /api/certificates/[id]/pdf` returns stored signed PDF
    - Test `generateAndSaveCertificatePDF()` returns `{ success, pdfPath }` for valid certificates
    - Test backward compatibility with existing certificate data (no `balai_id`, no `is_standard`)
    - _Requirements: 10.1, 10.4, 10.5_

- [x] 11. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check` (already installed v4.7.0)
- Unit tests validate specific examples and edge cases
- The design retains Playwright-based rendering for pixel-perfect PDF output
- Template configs are TypeScript modules (version-controlled, type-safe) — not database-stored
- Backward compatibility is maintained through the same function signature and API endpoints
- Database migration (task 1.2) must be run in Supabase SQL Editor before tasks that depend on `balai_id` and `is_standard` fields

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 4, "tasks": ["5.6", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5"] },
    { "id": 8, "tasks": ["9.1", "9.2"] },
    { "id": 9, "tasks": ["9.3", "10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4"] }
  ]
}
```
