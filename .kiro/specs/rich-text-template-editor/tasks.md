# Implementation Plan: Rich Text Template Editor

## Overview

Menggantikan block-based template editor dengan editor WYSIWYG berbasis TipTap yang memberikan kontrol formatting penuh. Implementasi mencakup custom TipTap extensions (VariableNode, LoopNode, VariableSuggestion), variable replacement engine, HTML renderer, storage service, PDF generation pipeline, DOCX import, dan migrasi/pembersihan kode lama.

## Tasks

- [x] 1. Setup project structure, types, dan database migration
  - [x] 1.1 Create TypeScript interfaces and types
    - Create `lib/rich-text-editor/types.ts` with interfaces: `TipTapDocument`, `TipTapNode`, `TipTapMark`, `PageSettings`, `DEFAULT_PAGE_SETTINGS`, `VariableDefinition`, `CertificateData`, `RichTextTemplateRecord`
    - _Requirements: 1.5, 5.1, 5.6_

  - [x] 1.2 Create variable registry and sample data
    - Create `lib/rich-text-editor/variable-registry.ts` with `VARIABLE_REGISTRY` array containing all variable definitions grouped by category (instrument, calibration, station, personnel, results)
    - Create `lib/rich-text-editor/sample-data.ts` with `DEFAULT_SAMPLE_DATA` object
    - Export helper functions: `getAllVariables()`, `searchVariables(query)`
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.1, 7.4_

  - [x] 1.3 Create database migration SQL
    - Create migration file to `ALTER TABLE certificate_templates` adding `content JSONB DEFAULT NULL` and `page_settings JSONB DEFAULT NULL` columns
    - Add CHECK constraints for valid TipTap document structure and valid page_settings
    - Add partial index `idx_templates_has_content` for active rich text templates
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 2. Implement variable engine (pure functions)
  - [x] 2.1 Implement variable replacement functions
    - Create `lib/rich-text-editor/variable-engine.ts`
    - Implement `replaceSimpleVariables(text, data)` — replaces `{{variable}}` with values from data using dataKey path lookup
    - Implement `expandLoops(html, data)` — expands `{{#each collection}}...{{/each}}` blocks for each record in the array
    - Implement `replaceVariables(html, data)` — orchestrates loop expansion then simple variable replacement
    - Handle null/undefined values by replacing with empty string and logging warning
    - _Requirements: 6.3, 6.4, 6.6_

  - [ ]* 2.2 Write property test: Loop Expansion (Property 3)
    - **Property 3: Loop Expansion**
    - Generate random arrays of 0-100 calibration result records, verify `expandLoops` produces exactly N copies with correct variable substitution
    - **Validates: Requirements 4.4, 6.4**

  - [ ]* 2.3 Write property test: Variable Replacement Completeness (Property 7)
    - **Property 7: Variable Replacement Completeness**
    - Generate templates with random variable placements and complete data objects, verify no `{{variable}}` patterns remain for provided values and each value appears in output
    - **Validates: Requirements 6.3, 6.6**

  - [ ]* 2.4 Write property test: Variable Search Filtering (Property 2)
    - **Property 2: Variable Search Filtering**
    - Generate random query strings, verify all returned variables contain query as case-insensitive substring of name or description, and no matching variable is excluded
    - **Validates: Requirements 3.4**

- [x] 3. Implement TipTap document validation
  - [x] 3.1 Create validation module
    - Create `lib/rich-text-editor/validation.ts`
    - Implement `isValidTipTapDocument(obj)` — returns true iff object has `type === "doc"` and `content` is an array
    - Implement `validateLoopPairs(doc)` — checks that every `{{#each}}` has a matching `{{/each}}`
    - _Requirements: 4.5, 5.2_

  - [ ]* 3.2 Write property test: TipTap Document Validation (Property 4)
    - **Property 4: TipTap Document Validation**
    - Generate arbitrary JSON objects, verify validator returns true iff object has `type === "doc"` and `content` is an array
    - **Validates: Requirements 5.2**

- [x] 4. Implement HTML renderer
  - [x] 4.1 Create HTML renderer module
    - Create `lib/rich-text-editor/html-renderer.ts`
    - Implement `tiptapToHtml(doc, options)` using `@tiptap/html` `generateHTML` with all registered extensions (StarterKit, Table, Image, TextAlign, Color, TextStyle, FontFamily, Underline, VariableNode, LoopNode)
    - Implement `generatePdfHtml(doc, data, pageSettings)` — converts to HTML, replaces variables, wraps in page-sized container with CSS for PDF rendering
    - _Requirements: 6.2, 6.5_

  - [ ]* 4.2 Write property test: TipTap to HTML Conversion (Property 6)
    - **Property 6: TipTap to HTML Conversion Preserves Structure**
    - Generate valid TipTap documents with paragraph, heading, bold, italic, table, and variableNode nodes, verify HTML output has correct tag mapping
    - **Validates: Requirements 6.2**

- [x] 5. Checkpoint - Core logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement storage service
  - [ ] 6.1 Create storage service for rich text templates
    - Create `lib/rich-text-editor/storage-service.ts`
    - Implement `saveRichTextVersion(templateId, content, pageSettings)` — deactivates old versions, inserts new record with incremented version
    - Implement `getActiveRichTextTemplate(certificateType)` — returns template with `is_active = true` and highest version
    - Implement `getRichTextTemplateByVersion(certificateType, version)` — returns specific version for re-rendering
    - Use Supabase client for database operations
    - _Requirements: 5.1, 5.4, 8.1, 8.2, 8.3_

  - [ ]* 6.2 Write property test: Active Template Retrieval (Property 5)
    - **Property 5: Active Template Retrieval**
    - Generate sets of template records with varying versions and is_active flags, verify `getActiveRichTextTemplate` returns the record with `is_active = true` and highest version
    - **Validates: Requirements 5.4**

  - [ ]* 6.3 Write property test: Versioning Invariant (Property 8)
    - **Property 8: Versioning Invariant**
    - Generate sequences of save operations on same certificate_type, verify: version increments by 1, exactly one `is_active = true` after each save, total records never decrease
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 7. Implement custom TipTap extensions
  - [ ] 7.1 Create VariableNode extension and React view
    - Create `lib/rich-text-editor/extensions/variable-node.ts` — custom inline atom Node with attributes: variableName, category, displayLabel
    - Create `lib/rich-text-editor/components/VariableNodeView.tsx` — React NodeView rendering colored badge/chip
    - Render as `<span data-variable>` in HTML output with `{{variableName}}` text
    - _Requirements: 2.1, 2.2, 2.7_

  - [ ] 7.2 Create LoopNode extension and React view
    - Create `lib/rich-text-editor/extensions/loop-node.ts` — custom block atom Node with attributes: collection, type (start/end)
    - Create `lib/rich-text-editor/components/LoopNodeView.tsx` — React NodeView rendering visual loop marker with highlight
    - _Requirements: 4.1, 4.3_

  - [ ] 7.3 Create VariableSuggestion extension
    - Create `lib/rich-text-editor/extensions/variable-suggestion.ts` — Extension using `@tiptap/suggestion` that triggers on `{{` input
    - Implement autocomplete dropdown that filters variables by query and inserts VariableNode on selection
    - _Requirements: 2.8_

  - [ ] 7.4 Create ImageUpload extension
    - Create `lib/rich-text-editor/extensions/image-upload.ts` — Extension that handles image upload to Supabase Storage
    - Validate file size (max 2MB) and format (PNG, JPG, SVG) before upload
    - Insert image node with public URL after successful upload
    - _Requirements: 1.3, 1.7_

  - [ ]* 7.5 Write property test: TipTap Document Round-Trip (Property 1)
    - **Property 1: TipTap Document Round-Trip**
    - Generate valid TipTap documents with formatting nodes, variable nodes, and loop nodes; serialize to JSON, deserialize back, verify structural equivalence
    - **Validates: Requirements 1.5, 1.6**

- [ ] 8. Implement frontend editor components
  - [ ] 8.1 Create EditorToolbar component
    - Create `lib/rich-text-editor/components/EditorToolbar.tsx`
    - Implement toolbar with buttons: bold, italic, underline, strikethrough, font family, font size, text color, alignment (left/center/right/justify), ordered list, unordered list, headings (H1-H4), horizontal rule, table, image upload
    - Wire each button to TipTap editor commands
    - _Requirements: 1.1_

  - [ ] 8.2 Create VariableSidebar component
    - Create `lib/rich-text-editor/components/VariableSidebar.tsx`
    - Display variables grouped by category with name and description
    - Implement search field that filters by name or description
    - Insert VariableNode at cursor position on click
    - Disable insert buttons when editor has no focus with tooltip "Klik di editor terlebih dahulu"
    - Include "Hasil Kalibrasi" category with loop variables and loop insertion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 8.3 Create PageSettingsPanel component
    - Create `lib/rich-text-editor/components/PageSettingsPanel.tsx`
    - Implement controls for paper size (A4/Letter/Legal), orientation (portrait/landscape), margins (top/bottom/left/right in mm)
    - _Requirements: 1.4_

  - [ ] 8.4 Create LivePreviewPanel component
    - Create `lib/rich-text-editor/components/LivePreviewPanel.tsx`
    - Render template with sample data using `tiptapToHtml` and `replaceVariables`
    - Debounce updates (3 second delay after last change)
    - Show proportional page preview with page breaks
    - Highlight unrecognized variables in red with tooltip
    - Add "Ganti Data Contoh" button for selecting real certificate data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 8.5 Create main RichTextEditor orchestrator component
    - Create `lib/rich-text-editor/components/RichTextEditor.tsx`
    - Initialize TipTap editor with all extensions (StarterKit, Table, Image, TextAlign, Color, TextStyle, FontFamily, Underline, VariableNode, LoopNode, VariableSuggestion, ImageUpload)
    - Compose layout: Toolbar (top), Editor (center), VariableSidebar (right), LivePreview (toggle panel)
    - Handle save action: validate document, call onSave callback
    - _Requirements: 1.1, 1.5, 1.6_

- [ ] 9. Checkpoint - Frontend components compile and render
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement API routes
  - [ ] 10.1 Modify template save API route
    - Update `app/api/admin/templates/[id]/route.ts` PUT handler
    - Support both rich text save (when `content` field present) and legacy block save (backward compatible)
    - Validate TipTap document structure using `isValidTipTapDocument`
    - Call `saveRichTextVersion` for rich text saves
    - Maintain admin auth check
    - _Requirements: 5.2, 9.3_

  - [ ] 10.2 Create image upload API route
    - Create `app/api/admin/templates/upload-image/route.ts`
    - Accept multipart form data with file
    - Validate file size (max 2MB) and type (PNG, JPG, SVG)
    - Upload to Supabase Storage bucket `template-images`
    - Return public URL
    - _Requirements: 1.3, 1.7, 9.3_

  - [ ] 10.3 Create DOCX import API route
    - Create `app/api/admin/templates/import-docx/route.ts`
    - Accept multipart form data with .docx file (max 10MB)
    - Validate file extension and size
    - Call `importDocx` to convert to TipTap JSON
    - Return document and warnings
    - _Requirements: 10.1, 10.4, 10.6, 9.3_

  - [ ] 10.4 Create editor page route
    - Create `app/admin/templates/[id]/edit/page.tsx` as server component
    - Fetch template data from database
    - Render RichTextEditor component with template data
    - Handle save via API call to PUT endpoint
    - Use AdminGuard for access control
    - _Requirements: 1.1, 1.6, 9.1, 9.4_

- [ ] 11. Implement DOCX importer
  - [ ] 11.1 Create DOCX import module
    - Create `lib/rich-text-editor/docx-importer.ts`
    - Use mammoth.js to convert .docx buffer to HTML
    - Parse HTML to TipTap JSON document structure
    - Detect `{{variable_name}}` patterns in text and convert to VariableNode if variable is in registry
    - Return document and warnings for unsupported elements
    - _Requirements: 10.1, 10.2, 10.5, 10.6_

  - [ ]* 11.2 Write property test: DOCX Variable Pattern Detection (Property 9)
    - **Property 9: DOCX Variable Pattern Detection**
    - Generate text content with embedded `{{variable_name}}` patterns (both registry and non-registry names), verify registry patterns become VariableNode and non-registry patterns remain as plain text
    - **Validates: Requirements 10.5**

- [ ] 12. Integrate with PDF service
  - [ ] 12.1 Update PDF service to support rich text templates
    - Modify `lib/pdf-service/database-template-source.ts` to check for `content` column first, fallback to block-based if null
    - Update `lib/pdf-service/template-renderer.ts` to use `generatePdfHtml` when rich text content is available
    - Apply page_settings (paper size, orientation, margins) to Playwright PDF options
    - Handle template versioning: use recorded version for re-renders, latest active for new certificates
    - Log warnings for missing variables and fallback scenarios
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.4, 8.5, 8.6_

- [ ] 13. Checkpoint - Full integration works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Migrate and clean up old block-based editor code
  - [ ] 14.1 Modify existing pages to use new editor
    - Update `app/admin/templates/[id]/page.tsx` to redirect to `/admin/templates/[id]/edit`
    - Update `app/admin/templates/page.tsx` to update links pointing to the new editor route
    - Update `app/api/admin/templates/route.ts` to remove references to `validateBlocks` and block-based validation
    - Update `app/api/admin/templates/[id]/route.ts` to remove legacy block-based save logic (rich text is now primary)
    - _Requirements: 1.1, 9.1_

  - [ ] 14.2 Delete old block-based editor files and folders
    - Delete `app/admin/templates/components/BlockPanel.tsx`
    - Delete `app/admin/templates/components/BlockItem.tsx`
    - Delete `app/admin/templates/components/BlockPropertyEditor.tsx`
    - Delete `app/admin/templates/components/AddBlockDropdown.tsx`
    - Delete `app/admin/templates/components/BulkApplyDialog.tsx`
    - Delete `app/admin/templates/components/property-editors/` (entire folder)
    - Delete `app/admin/templates/components/TemplateEditor.tsx`
    - Delete `app/admin/templates/components/LivePreview.tsx`
    - Delete `lib/template-editor/` (entire folder)
    - Delete `app/api/admin/templates/bulk-apply/` (entire folder)
    - Delete `app/api/admin/templates/migrate/` (entire folder)
    - Delete `__tests__/template-editor/` (if exists)
    - Remove any remaining imports/references to deleted files
    - _Requirements: Design — Strategi Migrasi & Pembersihan Kode Lama_

- [ ] 15. Final checkpoint - All tests pass, no broken imports
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The cleanup task (14.2) should only be executed after confirming the new editor is fully functional
- Database columns `cover_blocks` and `results_blocks` are intentionally kept for backward compatibility

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["6.2", "6.3", "7.5", "8.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["8.4", "8.5", "11.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "11.2"] },
    { "id": 7, "tasks": ["12.1"] },
    { "id": 8, "tasks": ["14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
