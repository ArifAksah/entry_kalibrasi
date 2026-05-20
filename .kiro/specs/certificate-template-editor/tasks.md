# Implementation Plan: Certificate Template Editor

## Overview

This plan implements a database-backed block-based template editor for calibration certificates. The implementation follows a bottom-up approach: types and interfaces first, then service layer (converter, validator, cache, storage), then API routes, then UI components, and finally migration. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Set up project structure, types, and core interfaces
  - [x] 1.1 Create block type definitions and interfaces
    - Create `lib/template-editor/types.ts` with all block type definitions: `BlockType`, `CoverBlockType`, `ResultsBlockType`, `BlockDefinition`, all `BlockProperties` interfaces, `TemplateRecord`, `ValidationResult`, `ValidationError`, `BulkOperationResult`
    - Create `lib/template-editor/index.ts` with public exports
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [x] 1.2 Create block schemas (required properties per block type)
    - Create `lib/template-editor/block-schemas.ts` defining required properties for each `BlockType`
    - Export `getRequiredProperties(blockType: BlockType): string[]` function
    - Export `BLOCK_TYPE_SCHEMAS` constant mapping each block type to its required and optional properties
    - _Requirements: 2.4, 2.5_

  - [x] 1.3 Create database migration SQL
    - Create `database/create_certificate_templates.sql` with the `certificate_templates` table schema, indexes, and `ALTER TABLE certificate ADD COLUMN template_version INTEGER`
    - Include unique constraint on `(certificate_type, version)`, JSONB array checks, and partial index on `(certificate_type, is_active) WHERE is_active = TRUE`
    - _Requirements: 1.1, 6.4_

- [x] 2. Implement BlockConverter (bidirectional conversion)
  - [x] 2.1 Implement templateConfigToBlocks conversion
    - Create `lib/template-editor/block-converter.ts`
    - Implement `templateConfigToBlocks(config: TemplateConfig)` that converts an existing `TemplateConfig` object into `{ cover_blocks: BlockDefinition[], results_blocks: BlockDefinition[] }`
    - Map each TemplateConfig field to the corresponding block type per the design mapping table
    - _Requirements: 8.2, 10.2_

  - [x] 2.2 Implement blocksToTemplateConfig conversion
    - Implement `blocksToTemplateConfig(certificateType, coverBlocks, resultsBlocks)` that converts database block arrays back into a valid `TemplateConfig` object
    - Handle layout-only blocks (spacer, end-marker) by skipping them during conversion
    - Handle unrecognized block types by skipping with a warning log
    - _Requirements: 8.2, 8.4, 10.5_

  - [ ]* 2.3 Write property test: Template config round-trip (Property 1)
    - **Property 1: Template config round-trip (TemplateConfig → blocks → TemplateConfig)**
    - Create `__tests__/template-editor/properties/template-editor.property.test.ts`
    - Implement `arbitraryTemplateConfig()` generator using fast-check
    - Assert deep equality after round-trip conversion (excluding layout-only blocks)
    - **Validates: Requirements 8.2, 10.2, 10.5**

- [x] 3. Implement BlockValidator
  - [x] 3.1 Implement block validation logic
    - Create `lib/template-editor/block-validator.ts`
    - Implement `validateBlocks(coverBlocks, resultsBlocks): ValidationResult`
    - Implement `validateBlock(block): ValidationError[]` checking required properties per block type
    - Return errors with `blockId`, `blockType`, `field`, and `message` for each missing required property
    - Reject unknown block types with "Tipe blok tidak dikenal: {type}"
    - _Requirements: 1.2, 2.4, 2.5_

  - [ ]* 3.2 Write property test: Block validation identifies invalid blocks (Property 2)
    - **Property 2: Block validation correctly identifies invalid blocks**
    - Implement `arbitraryBlockDefinition(type)` generator
    - For any block with randomly omitted required properties, validator returns errors listing every missing property
    - **Validates: Requirements 1.2, 2.4, 2.5**

  - [ ]* 3.3 Write property test: Block structure invariant (Property 13)
    - **Property 13: Block structure invariant**
    - For any block created through add operation, assert: non-empty UUID `id`, valid `type` from BlockType union, `properties` object present, `order` is non-negative integer
    - **Validates: Requirements 2.3**

- [x] 4. Implement TemplateCache
  - [x] 4.1 Implement in-memory cache with 5-minute TTL
    - Create `lib/template-editor/template-cache.ts`
    - Implement `get(certificateType, version?)`, `set(certificateType, config, version?)`, `invalidate(certificateType)`, `invalidateAll()`
    - Use Map with timestamp-based expiry (5 minutes)
    - _Requirements: 8.5_

  - [ ]* 4.2 Write unit tests for TemplateCache
    - Test cache hit returns stored value
    - Test cache miss returns null
    - Test entries expire after 5 minutes (use fake timers)
    - Test invalidation removes entries
    - _Requirements: 8.5_

- [x] 5. Implement TemplateStorageService
  - [x] 5.1 Implement core CRUD operations
    - Create `lib/template-editor/storage-service.ts`
    - Implement `listTemplates()` — returns latest active version per certificate_type
    - Implement `getTemplateById(id)` — returns single template record
    - Implement `getActiveTemplate(certificateType)` — returns active template with highest version
    - Implement `getTemplateByVersion(certificateType, version)` — returns specific version
    - Use Supabase client for database queries
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 5.2 Implement version management (save, create, duplicate)
    - Implement `saveNewVersion(templateId, blocks)` — increments version, deactivates previous, inserts new active record in a transaction
    - Implement `createTemplate(data)` — creates new template with version 1
    - Implement `duplicateTemplate(sourceId, newName)` — creates independent copy with version 1
    - _Requirements: 6.1, 6.2, 6.3, 3.4_

  - [x] 5.3 Implement bulk apply operation
    - Implement `bulkApply(sourceId, targetIds)` — copies source blocks to each target as new version
    - Handle partial failures: continue for remaining targets, report failures with reasons
    - Return `BulkOperationResult` with total, succeeded, and failed details
    - _Requirements: 7.2, 7.5_

  - [ ]* 5.4 Write property test: Active version retrieval (Property 3)
    - **Property 3: Active version retrieval returns highest version**
    - For any set of template records with varying versions and is_active flags, getActiveTemplate returns the record with is_active=TRUE and highest version
    - **Validates: Requirements 1.4**

  - [ ]* 5.5 Write property test: Version save invariant (Property 4)
    - **Property 4: Version save invariant**
    - After saving a new version: new record has version = max(existing) + 1, and exactly one record has is_active=TRUE for that certificate_type
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 5.6 Write property test: Version immutability (Property 5)
    - **Property 5: Version immutability**
    - After any sequence of save operations, all previously created version records remain with original cover_blocks and results_blocks unchanged
    - **Validates: Requirements 6.3**

  - [ ]* 5.7 Write property test: Template duplication (Property 8)
    - **Property 8: Template duplication preserves block configuration**
    - Duplicated template has different id, specified new name, deeply equal blocks, and version = 1
    - **Validates: Requirements 3.4**

  - [ ]* 5.8 Write property test: Bulk apply correctness (Property 9)
    - **Property 9: Bulk apply creates correct new versions for all targets**
    - After successful bulk apply, each target has new version with blocks identical to source
    - **Validates: Requirements 7.2**

  - [ ]* 5.9 Write property test: Bulk apply partial failure (Property 10)
    - **Property 10: Bulk apply partial failure resilience**
    - When some targets fail, operation succeeds for non-failing targets and result accurately reports successes and failures
    - **Validates: Requirements 7.5**

- [x] 6. Checkpoint - Core service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement block manipulation utilities
  - [x] 7.1 Implement block reorder and delete helpers
    - Create utility functions in `lib/template-editor/block-utils.ts`:
      - `reorderBlocks(blocks, sourceIndex, destIndex): BlockDefinition[]` — moves block and updates order values
      - `deleteBlock(blocks, blockId): BlockDefinition[]` — removes block and re-normalizes order values
      - `addBlock(blocks, blockType, position?): BlockDefinition[]` — creates new block with UUID, default properties, and correct order
    - _Requirements: 4.2, 4.4, 4.5_

  - [ ]* 7.2 Write property test: Block reorder preserves all blocks (Property 6)
    - **Property 6: Block reorder preserves all blocks**
    - Implement `arbitraryReorderOp(arrayLength)` generator
    - After reorder, resulting array contains same set of blocks (by id) with updated order values
    - **Validates: Requirements 4.2**

  - [ ]* 7.3 Write property test: Block deletion preserves remaining blocks (Property 7)
    - **Property 7: Block deletion preserves remaining blocks**
    - After deletion, array contains all original blocks except deleted one, with contiguous order values starting from 0
    - **Validates: Requirements 4.5**

- [x] 8. Implement API routes
  - [x] 8.1 Implement GET and POST /api/admin/templates
    - Create `app/api/admin/templates/route.ts`
    - GET: List all templates (active versions) with auth guard (admin role check)
    - POST: Create new template with validation, return 201 with created record
    - Non-admin users receive 403 response
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 8.2 Implement GET and PUT /api/admin/templates/[id]
    - Create `app/api/admin/templates/[id]/route.ts`
    - GET: Return template by ID with full block data
    - PUT: Validate blocks via BlockValidator, save new version via TemplateStorageService
    - Return 400 with validation errors if blocks are invalid
    - Return 404 if template not found
    - _Requirements: 4.6, 1.2, 6.1_

  - [x] 8.3 Implement POST /api/admin/templates/[id]/duplicate
    - Create `app/api/admin/templates/[id]/duplicate/route.ts`
    - Accept `{ name: string }` body, duplicate template via storage service
    - Return 201 with new template record
    - _Requirements: 3.4_

  - [x] 8.4 Implement POST /api/admin/templates/bulk-apply
    - Create `app/api/admin/templates/bulk-apply/route.ts`
    - Accept `{ sourceId: string, targetIds: string[] }` body
    - Execute bulk apply via storage service, return result summary
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 8.5 Implement GET /api/admin/templates/[id]/versions
    - Create `app/api/admin/templates/[id]/versions/route.ts`
    - Return all versions for a template's certificate_type, ordered by version DESC
    - _Requirements: 6.3_

  - [x] 8.6 Implement POST /api/admin/templates/migrate
    - Create `app/api/admin/templates/migrate/route.ts`
    - Execute migration function that reads 13 TypeScript templates, converts to blocks, and inserts into DB
    - Skip existing templates (idempotent), log results
    - Return migration summary
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 9. Implement migration logic
  - [x] 9.1 Implement TypeScript-to-database migration function
    - Create `lib/template-editor/migration.ts`
    - Read all 13 template configs from `lib/pdf-service/templates/`
    - Use BlockConverter to convert each to block format
    - Insert into database as version 1, skip if already exists
    - Perform round-trip validation for each migrated template
    - Log results (migrated, skipped, failed validation)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 9.2 Write property test: Migration idempotency (Property 12)
    - **Property 12: Migration idempotency**
    - When some templates already exist in DB, migration skips them without modification and only inserts new ones
    - **Validates: Requirements 10.3**

- [x] 10. Checkpoint - API and migration layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Template List page (UI)
  - [x] 11.1 Create admin layout with auth guard
    - Create `app/admin/templates/layout.tsx` as Server Component
    - Verify user has admin role, redirect to `/dashboard` with "Akses ditolak" toast if not
    - _Requirements: 3.2, 3.3_

  - [x] 11.2 Create template list page
    - Create `app/admin/templates/page.tsx` as Server Component
    - Fetch templates via GET `/api/admin/templates`
    - Display list with: template name, certificate type, active version, last updated date
    - Include "Buat Template Baru" button and "Duplikat" action per template
    - Clicking template name navigates to `/admin/templates/[id]`
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [ ] 12. Implement Template Editor page (UI)
  - [x] 12.1 Create editor page and main orchestrator component
    - Create `app/admin/templates/[id]/page.tsx`
    - Create `app/admin/templates/components/TemplateEditor.tsx` (Client Component)
    - Manage editor state: selected block, dirty flag, cover_blocks, results_blocks
    - Implement unsaved changes protection (beforeunload + router navigation intercept)
    - _Requirements: 4.1, 4.7_

  - [~] 12.2 Implement BlockPanel with drag-and-drop
    - Create `app/admin/templates/components/BlockPanel.tsx`
    - Create `app/admin/templates/components/BlockItem.tsx`
    - Implement drag-and-drop reordering using a DnD library (e.g., @dnd-kit)
    - Display block type icon and label for each block
    - Include "Tambah Blok" button with AddBlockDropdown
    - Include delete button per block with confirmation dialog
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [~] 12.3 Implement BlockPropertyEditor (dynamic form per block type)
    - Create `app/admin/templates/components/BlockPropertyEditor.tsx`
    - Create property editor components for each block type in `components/property-editors/`:
      - `HeaderBlockEditor.tsx`, `TitleBlockEditor.tsx`, `SectionTableBlockEditor.tsx`, `QrCodeBlockEditor.tsx`, `FooterTextBlockEditor.tsx`, `ResultsTableBlockEditor.tsx`, `SpacerBlockEditor.tsx`, `AuthorizationBlockEditor.tsx`, `RepeatingHeaderBlockEditor.tsx`, `RepeatingFooterBlockEditor.tsx`, `EndMarkerBlockEditor.tsx`
    - Render appropriate editor based on selected block's type
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [~] 12.4 Implement LivePreview panel
    - Create `app/admin/templates/components/LivePreview.tsx`
    - Render HTML preview of certificate based on current block configuration
    - Debounce re-render by 500ms after block changes
    - Display Cover_Page and Results_Page with tab/toggle switch
    - Scale preview proportionally to A4 (210mm × 297mm)
    - Use sample data to fill template fields
    - Show inline error on blocks that fail to render
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [~] 12.5 Implement SaveButton and BulkApplyDialog
    - Create `app/admin/templates/components/SaveButton.tsx` — saves blocks via PUT API, shows version info on success
    - Create `app/admin/templates/components/BulkApplyDialog.tsx` — modal to select target templates and confirm bulk operation
    - _Requirements: 4.6, 7.1, 7.3, 7.4_

- [ ] 13. Integrate with existing PDF Service
  - [~] 13.1 Create DatabaseTemplateSource and integrate with PDF_Service facade
    - Modify `lib/pdf-service/` to add a `DatabaseTemplateSource` that:
      - Checks TemplateCache first
      - Falls back to TemplateStorageService + BlockConverter
      - Falls back to existing TemplateRegistry (hardcoded) if DB has no record
    - When rendering a certificate with `template_version`, fetch that specific version
    - If recorded version not found, use latest active + log warning
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 6.4, 6.5, 6.6_

  - [ ]* 13.2 Write property test: Version pinning for certificate re-rendering (Property 11)
    - **Property 11: Version pinning for certificate re-rendering**
    - For any certificate with recorded template_version, PDF generation uses that specific version, not latest active
    - **Validates: Requirements 6.5**

- [~] 14. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (13 properties total)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the existing codebase
- fast-check v4.7.0 is used for property-based testing
- All UI text uses Indonesian language to match existing application

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.2"] },
    { "id": 3, "tasks": ["2.3", "5.1", "7.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "7.2", "7.3"] },
    { "id": 5, "tasks": ["5.5", "5.6", "5.7", "5.8", "5.9"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "9.1"] },
    { "id": 7, "tasks": ["8.6", "9.2"] },
    { "id": 8, "tasks": ["11.1", "11.2"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 11, "tasks": ["13.1"] },
    { "id": 12, "tasks": ["13.2"] }
  ]
}
```
