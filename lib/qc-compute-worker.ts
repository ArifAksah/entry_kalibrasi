/**
 * lib/qc-compute-worker.ts
 *
 * Background computation module for QC data caching.
 * Exports an async function that performs the full QC computation pipeline:
 *   1. Fetch raw data via API
 *   2. Compute corrections via hitungKoreksiBatch
 *   3. Fetch QC limits for each UUT sensor
 *   4. Calculate calibration results per sensor group
 *
 * This is a regular module (not a Web Worker) to avoid Next.js bundling issues.
 * It can be called in a non-blocking way via setTimeout or requestIdleCallback
 * from the cache service layer.
 *
 * Requirements: 1.1, 1.2, 1.4
 */

import { hitungKoreksiBatch, fetchQCLimitForSensor, QCLimit } from './qc-utils'
import { calculateCalibrationResult } from './uncertainty-utils'
import { CacheEntry, serializeMap } from './qc-cache-storage'

// ─────────────────────────────────────────────
// Message Interfaces (for compatibility with design spec)
// ─────────────────────────────────────────────

export interface ComputeRequest {
  type: 'compute'
  sessionId: string
}

export interface ComputeResponse {
  type: 'result'
  sessionId: string
  entry: CacheEntry
}

export interface ComputeError {
  type: 'error'
  sessionId: string
  error: string
}

// ─────────────────────────────────────────────
// Raw data row shape (matches API response)
// ─────────────────────────────────────────────

interface RawDataRow {
  id: number
  created_at: string
  timestamp: string | null
  standard_data: number | null
  uut_data: number | null
  session_id: string
  sensor_id_uut?: number
  sensor_id_std?: number
  sheet_name?: string | null
  unit_uut?: string | null
  unit_std?: string | null
}

// ─────────────────────────────────────────────
// Main Computation Function
// ─────────────────────────────────────────────

/**
 * Performs the full QC computation pipeline for a given session.
 * Returns a CacheEntry on success, or throws on failure.
 *
 * Steps:
 *   1. Fetch raw data from /api/raw-data?session_id=...
 *   2. Extract unique (sensor_id_std, standard_data) pairs → call hitungKoreksiBatch
 *   3. Fetch QC limits for each unique UUT sensor via fetchQCLimitForSensor
 *   4. Group data by sensor_id_uut and compute calibration results per group
 *   5. Assemble and return a CacheEntry
 */
export async function computeQCData(sessionId: string): Promise<CacheEntry> {
  // Step 1: Fetch raw data
  const rawDataResponse = await fetch(`/api/raw-data?session_id=${sessionId}`)
  if (!rawDataResponse.ok) {
    throw new Error(`Failed to fetch raw data: ${rawDataResponse.status} ${rawDataResponse.statusText}`)
  }
  const rawDataJson = await rawDataResponse.json()
  const rawData: RawDataRow[] = rawDataJson.data || []

  if (rawData.length === 0) {
    throw new Error('No raw data found for session')
  }

  // Step 2: Extract unique (sensor_id_std, standard_data) pairs and call hitungKoreksiBatch
  const pairs = rawData
    .filter(r => r.sensor_id_std != null && r.standard_data != null)
    .map(r => ({ reading: r.standard_data as number, sensorStdId: r.sensor_id_std! }))

  let correctionMap = new Map<string, number>()
  if (pairs.length > 0) {
    correctionMap = await hitungKoreksiBatch(pairs)
  }

  // Step 3: Fetch QC limits for each unique UUT sensor
  const uutSensorIds = Array.from(
    new Set(
      rawData
        .filter(r => r.sensor_id_uut != null)
        .map(r => r.sensor_id_uut!)
    )
  )

  const qcLimits: Record<string, QCLimit | null> = {}
  await Promise.all(
    uutSensorIds.map(async (sensorId) => {
      const limit = await fetchQCLimitForSensor(sensorId)
      qcLimits[String(sensorId)] = limit
    })
  )

  // Step 4: Group data by sensor_id_uut and compute calibration results
  const groupedData: Record<string, RawDataRow[]> = {}
  rawData.forEach(row => {
    const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown'
    if (!groupedData[key]) groupedData[key] = []
    groupedData[key].push(row)
  })

  // Fetch standard cert records for each unique sensor_id_std
  const stdSensorIds = Array.from(
    new Set(
      rawData
        .filter(r => r.sensor_id_std != null)
        .map(r => r.sensor_id_std!)
    )
  )

  const standardCertMap: Record<number, any> = {}
  await Promise.all(
    stdSensorIds.map(async (stdSensorId) => {
      try {
        const res = await fetch(`/api/cert-standards?sensor_id=${stdSensorId}`)
        if (res.ok) {
          const json = await res.json()
          // API returns array of cert records; use the first one
          const certs = json.data || json
          if (Array.isArray(certs) && certs.length > 0) {
            standardCertMap[stdSensorId] = certs[0]
          }
        }
      } catch {
        // Skip - will result in no cert correction for this sensor
      }
    })
  )

  // Fetch UUT sensor details for resolution/type info
  const uutSensorMap: Record<number, any> = {}
  await Promise.all(
    uutSensorIds.map(async (sensorId) => {
      try {
        const res = await fetch(`/api/sensors/${sensorId}`)
        if (res.ok) {
          const json = await res.json()
          uutSensorMap[sensorId] = json.data || json
        }
      } catch {
        // Skip - will use defaults
      }
    })
  )

  // Compute calibration results per sensor group
  const calibrationResults: Record<string, { uutAvg: number; correctionAvg: number; uncertainty: number }> = {}

  for (const key of Object.keys(groupedData)) {
    const groupData = groupedData[key]
    if (groupData.length === 0) continue

    const sensorId = key === 'unknown' ? null : Number(key)
    const uutSensor = sensorId ? uutSensorMap[sensorId] || null : null

    // Find standard cert for this sensor group
    const stdSensorId = groupData[0]?.sensor_id_std
    const standardCertRecord = stdSensorId ? standardCertMap[stdSensorId] || null : null

    const { uutAvg, correction, uncertainty } = calculateCalibrationResult({
      currentData: groupData,
      uutSensor,
      standardCertRecord,
    })

    calibrationResults[key] = {
      uutAvg: uutAvg || 0,
      correctionAvg: correction || 0,
      uncertainty: uncertainty || 0,
    }
  }

  // Step 5: Assemble CacheEntry
  const entry: CacheEntry = {
    correction_map: serializeMap(correctionMap),
    qc_limits: qcLimits,
    calibration_results: calibrationResults,
    timestamp: new Date().toISOString(),
    row_count: rawData.length,
  }

  return entry
}

/**
 * Wraps computeQCData to return a ComputeResponse or ComputeError message.
 * This mirrors the Web Worker message interface from the design spec.
 */
export async function handleComputeRequest(
  request: ComputeRequest
): Promise<ComputeResponse | ComputeError> {
  try {
    const entry = await computeQCData(request.sessionId)
    return {
      type: 'result',
      sessionId: request.sessionId,
      entry,
    }
  } catch (err: any) {
    return {
      type: 'error',
      sessionId: request.sessionId,
      error: err?.message || 'Unknown computation error',
    }
  }
}
