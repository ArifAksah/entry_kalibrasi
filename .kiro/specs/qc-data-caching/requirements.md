# Requirements Document

## Introduction

This feature implements background pre-computation and localStorage caching for QC (Quality Control) check data in the calibration system. Currently, opening the "QC Check Data" modal triggers multiple sequential database calls (`hitungKoreksiBatch`, `fetchQCLimitForSensor`) and heavy computation (`calculateCalibrationResult`) on every open. This feature moves the computation to a background process triggered after raw data is saved, storing results in localStorage keyed by `session_id`, so the QC modal loads pre-computed results instantly.

## Glossary

- **QC_Cache_Service**: The client-side service responsible for orchestrating background pre-computation of QC results and managing their storage in localStorage
- **Cache_Storage**: The localStorage-based persistence layer that stores pre-computed QC results keyed by session_id
- **QCDataModal**: The React modal component (`components/features/QCDataModal.tsx`) that displays QC check results for a calibration session
- **Raw_Data**: Measurement readings stored in the `raw_data` Supabase table, linked by `session_id`
- **Correction_Map**: A mapping of `${sensor_id_std}:${standard_data}` keys to interpolated correction values computed by the `hitung_koreksi()` database function
- **QC_Limit**: The permissible correction threshold fetched from `master_qc` table for a given UUT sensor
- **Calibration_Result**: The computed output (UUT average, correction average, uncertainty U95) produced by `calculateCalibrationResult()`
- **Session_ID**: A unique identifier linking all raw data rows belonging to a single calibration session
- **Cache_Entry**: A single cached record containing correction_map, qc_limits, and calibration_results for one session_id
- **Invalidation_Trigger**: An event (data insert, update, or delete) that marks a cache entry as stale

## Requirements

### Requirement 1: Background Pre-Computation After Raw Data Save

**User Story:** As a calibration technician, I want QC results to be computed automatically after I save raw data, so that the QC modal opens instantly without waiting for database calls.

#### Acceptance Criteria

1. WHEN raw data is successfully saved to the database for a session, THE QC_Cache_Service SHALL initiate background computation of the Correction_Map, QC_Limits, and Calibration_Result for that Session_ID
2. WHILE background computation is in progress, THE QC_Cache_Service SHALL allow the user to continue interacting with the application without blocking the UI thread
3. WHEN background computation completes successfully, THE QC_Cache_Service SHALL store the computed Cache_Entry in Cache_Storage keyed by the Session_ID
4. IF background computation fails due to a network error or database error, THEN THE QC_Cache_Service SHALL log the error to the console and allow the QCDataModal to fall back to on-demand computation

### Requirement 2: Load Pre-Computed Results in QC Modal

**User Story:** As a calibration technician, I want the QC Check Data modal to load cached results instantly, so that I do not wait for repeated database calls every time I open the modal.

#### Acceptance Criteria

1. WHEN the QCDataModal is opened and a valid Cache_Entry exists in Cache_Storage for the given Session_ID, THE QCDataModal SHALL display the pre-computed Correction_Map, QC_Limits, and Calibration_Result from the cache without making additional API calls
2. WHEN the QCDataModal is opened and no Cache_Entry exists in Cache_Storage for the given Session_ID, THE QCDataModal SHALL fall back to the existing on-demand computation flow (fetch raw data, call hitungKoreksiBatch, fetchQCLimitForSensor, calculateCalibrationResult)
3. THE QCDataModal SHALL display identical results whether loaded from Cache_Storage or computed on-demand for the same raw data

### Requirement 3: Cache Key Structure

**User Story:** As a developer, I want cache entries to be keyed by session_id, so that each calibration session's QC data is independently cached and retrievable.

#### Acceptance Criteria

1. THE Cache_Storage SHALL use a key format of `qc_cache_{session_id}` for each Cache_Entry
2. THE Cache_Entry SHALL contain the following fields: correction_map (serialized Map), qc_limits (per-sensor QC limit records), calibration_results (per-sensor uncertainty results), and a timestamp indicating when the cache was created
3. WHEN storing a Cache_Entry, THE QC_Cache_Service SHALL serialize the Correction_Map from a JavaScript Map to a JSON-compatible format suitable for localStorage

### Requirement 4: Cache Invalidation on Raw Data Changes

**User Story:** As a calibration technician, I want cached QC results to be automatically invalidated when raw data changes, so that I always see results based on the latest data.

#### Acceptance Criteria

1. WHEN new raw data rows are inserted for a Session_ID, THE QC_Cache_Service SHALL remove the existing Cache_Entry for that Session_ID from Cache_Storage
2. WHEN existing raw data rows are updated for a Session_ID, THE QC_Cache_Service SHALL remove the existing Cache_Entry for that Session_ID from Cache_Storage
3. WHEN raw data rows are deleted for a Session_ID, THE QC_Cache_Service SHALL remove the existing Cache_Entry for that Session_ID from Cache_Storage
4. WHEN a Cache_Entry is invalidated, THE QC_Cache_Service SHALL initiate a new background pre-computation for the affected Session_ID

### Requirement 5: Cache Storage Size Management

**User Story:** As a developer, I want the caching system to manage localStorage usage responsibly, so that the application does not exceed browser storage limits.

#### Acceptance Criteria

1. IF localStorage write fails due to a QuotaExceededError, THEN THE QC_Cache_Service SHALL remove the oldest Cache_Entries (by timestamp) until sufficient space is available and retry the write
2. IF localStorage write still fails after evicting all other Cache_Entries, THEN THE QC_Cache_Service SHALL log a warning and proceed without caching for that session
3. THE Cache_Storage SHALL store each Cache_Entry with a creation timestamp to support least-recently-created eviction

### Requirement 6: Cache Data Integrity

**User Story:** As a calibration technician, I want to be confident that cached QC results are accurate and not corrupted, so that I can trust the displayed data.

#### Acceptance Criteria

1. WHEN reading a Cache_Entry from Cache_Storage, THE QC_Cache_Service SHALL validate that the entry contains all required fields (correction_map, qc_limits, calibration_results, timestamp)
2. IF a Cache_Entry fails validation (missing fields, malformed JSON, or parse error), THEN THE QC_Cache_Service SHALL remove the invalid entry from Cache_Storage and fall back to on-demand computation
3. THE QC_Cache_Service SHALL deserialize the Correction_Map from JSON back into a JavaScript Map, and the deserialized map SHALL produce identical lookup results as the original computed map

### Requirement 7: Re-Computation Trigger from QC Modal

**User Story:** As a calibration technician, I want the ability to force a fresh computation from the QC modal, so that I can manually refresh results if I suspect the cache is stale.

#### Acceptance Criteria

1. THE QCDataModal SHALL provide a "Refresh" control that triggers a fresh on-demand computation regardless of cache state
2. WHEN the user activates the Refresh control, THE QC_Cache_Service SHALL remove the existing Cache_Entry for the current Session_ID, perform a full computation, and store the new results in Cache_Storage
3. WHILE a refresh computation is in progress, THE QCDataModal SHALL display a loading indicator to the user
