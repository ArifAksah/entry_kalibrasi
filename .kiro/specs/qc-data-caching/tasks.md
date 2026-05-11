# Implementation Plan: QC Data Caching

## Overview

Implement a client-side caching layer for QC computation results using localStorage and a Web Worker for background pre-computation. The system pre-computes correction maps, QC limits, and calibration results after raw data is saved, enabling instant QC modal loading.

## Tasks

- [x] 1. Set up cache storage layer
  - [x] 1.1 Create `lib/qc-cache-storage.ts` with CacheEntry interface and storage operations
    - Define `CacheEntry` interface with fields: `correction_map`, `qc_limits`, `calibration_results`, `timestamp`, `row_count`
    - Implement `getKey(sessionId)` returning `qc_cache_${sessionId}`
    - Implement `serializeMap(map)` converting `Map<string, number>` to `Array<[string, number]>`
    - Implement `deserializeMap(data)` converting `Array<[string, number]>` back to `Map<string, number>`
    - Implement `validate(obj)` type guard checking all required fields exist and are correctly typed
    - Implement `read(sessionId)` that parses localStorage JSON, validates, removes invalid entries, returns `CacheEntry | null`
    - Implement `write(sessionId, entry)` with LRU eviction on `QuotaExceededError`
    - Implement `remove(sessionId)` to delete a cache entry
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [ ]* 1.2 Write property tests for cache storage serialization and validation
    - **Property 1: Map Serialization Round-Trip** — For any Map<string, number> with valid keys and finite values, `deserializeMap(serializeMap(map))` produces identical entries
    - **Property 3: Cache Entry Structure Invariant** — For any session_id, key is `qc_cache_${session_id}` and stored entries contain all required fields
    - **Property 6: Invalid Cache Entry Rejection** — For any malformed data under a `qc_cache_*` key, `validate()` returns false and `read()` removes the entry
    - **Validates: Requirements 3.1, 3.2, 3.3, 6.1, 6.2, 6.3**

  - [ ]* 1.3 Write property test for LRU eviction ordering
    - **Property 5: LRU Eviction Ordering** — For any set of CacheEntries with distinct timestamps, eviction removes entries from oldest to newest
    - **Validates: Requirements 5.1, 5.3**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Web Worker for background computation
  - [x] 3.1 Create `workers/qc-compute.worker.ts` with computation logic
    - Define `ComputeRequest` and `ComputeResponse`/`ComputeError` message interfaces
    - Implement worker `onmessage` handler that receives `{ type: 'compute', sessionId }`
    - Fetch raw data via `fetch('/api/raw-data?session_id=...')`
    - Extract unique `(sensor_id_std, standard_data)` pairs and call `hitungKoreksiBatch` logic
    - Fetch QC limits for each UUT sensor via `fetchQCLimitForSensor`
    - Compute calibration results per sensor group using `calculateCalibrationResult`
    - Post `ComputeResponse` with assembled `CacheEntry` back to main thread
    - Post `ComputeError` on any failure with error message
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ]* 3.2 Write unit tests for Web Worker message handling
    - Test successful computation posts `ComputeResponse` with valid `CacheEntry`
    - Test network error posts `ComputeError` with descriptive message
    - Test empty raw data does not produce a cache entry
    - _Requirements: 1.1, 1.4_

- [x] 4. Implement QC Cache Service
  - [x] 4.1 Create `lib/qc-cache-service.ts` with service orchestration
    - Implement `triggerComputation(sessionId)` that spawns/reuses Web Worker and sends `ComputeRequest`
    - Implement `get(sessionId)` that delegates to `cacheStorage.read(sessionId)` and returns deserialized entry
    - Implement `invalidate(sessionId, recompute?)` that removes cache entry and optionally re-triggers computation
    - Implement `refresh(sessionId)` that invalidates and returns a Promise resolving to the new `CacheEntry`
    - Implement `isComputing(sessionId)` tracking in-flight computations via internal Map
    - Handle Worker `onmessage` to store results via `cacheStorage.write()` and resolve pending promises
    - Handle Worker `onerror` to log errors and reject pending promises
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 7.2_

  - [ ]* 4.2 Write unit tests for QC Cache Service
    - Test `triggerComputation` dispatches message to worker (mock Worker)
    - Test `get` returns cached entry when valid cache exists (mock localStorage)
    - Test `get` returns null when no cache exists
    - Test `invalidate` removes entry and optionally re-triggers computation
    - Test `refresh` removes old entry and stores new entry with updated timestamp
    - Test `isComputing` returns true while computation is in-flight
    - **Property 4: Cache Invalidation on Data Mutation** — For any session with existing cache, invalidation removes the entry
    - **Property 7: Refresh Replaces Cache** — After refresh, new entry timestamp >= old entry timestamp
    - **Validates: Requirements 1.1, 1.3, 4.1, 4.2, 4.3, 4.4, 7.2**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate caching into QCDataModal
  - [x] 6.1 Modify `components/features/QCDataModal.tsx` to check cache before on-demand computation
    - Import `qcCacheService` and `cacheStorage` from the new modules
    - In the data-loading `useEffect`, check `qcCacheService.get(sessionId)` first
    - On cache hit: set `correctionMap` from deserialized `cached.correction_map`, set `qcLimits` from `cached.qc_limits`, skip API calls
    - On cache miss: fall back to existing `fetchRawData` + `hitungKoreksiBatch` + `fetchQCLimitForSensor` flow
    - Add a "Refresh" button that calls `qcCacheService.refresh(sessionId)` and updates state with new results
    - Show loading indicator while refresh is in progress
    - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.2, 7.3_

  - [ ]* 6.2 Write unit tests for QCDataModal cache integration
    - Test modal uses cached data when cache hit (mock qcCacheService.get)
    - Test modal falls back to on-demand when cache miss
    - Test refresh button triggers fresh computation and updates display
    - Test loading indicator shown during refresh
    - **Property 2: Cache Equivalence** — Results from cache match on-demand computation for same data
    - **Validates: Requirements 2.1, 2.2, 2.3, 7.1, 7.2, 7.3**

- [x] 7. Integrate background trigger into draft-view page
  - [x] 7.1 Modify `app/draft-view/page.tsx` to trigger background computation after raw data save
    - Import `qcCacheService` from `lib/qc-cache-service`
    - After successful raw data save response, call `qcCacheService.triggerComputation(sessionId)`
    - On raw data update/delete, call `qcCacheService.invalidate(sessionId, true)` to clear cache and re-compute
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 7.2 Write integration tests for the full caching flow
    - Test: save raw data → background compute → open modal → cached results displayed
    - Test: save data → cache populated → update data → cache cleared → modal recomputes
    - Test: Web Worker communication round-trip (main thread ↔ worker)
    - _Requirements: 1.1, 1.3, 2.1, 4.1, 4.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Web Worker file (`workers/qc-compute.worker.ts`) may need Next.js webpack configuration for worker bundling
- `fast-check` is already installed in devDependencies for property-based tests
- Test files go in `__tests__/qc-cache/` directory

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2"] }
  ]
}
```
