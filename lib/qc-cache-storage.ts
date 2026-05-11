/**
 * lib/qc-cache-storage.ts
 *
 * Cache storage layer for QC computation results.
 * Handles localStorage read/write with serialization, validation, and LRU eviction.
 *
 * Key format: `qc_cache_{session_id}`
 */

import type { QCLimit } from './qc-utils'

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────

export interface CalibrationResult {
  uutAvg: number
  correctionAvg: number
  uncertainty: number
}

export interface CacheEntry {
  /** Serialized correction map: Array of [key, value] tuples */
  correction_map: Array<[string, number]>

  /** QC limits per sensor ID */
  qc_limits: Record<string, QCLimit | null>

  /** Calibration results per sensor group */
  calibration_results: Record<string, CalibrationResult>

  /** ISO timestamp of when this cache entry was created */
  timestamp: string

  /** Raw data row count at time of caching (for quick staleness check) */
  row_count: number
}

// ─────────────────────────────────────────────
// Key Generation
// ─────────────────────────────────────────────

const CACHE_PREFIX = 'qc_cache_'

/**
 * Returns the localStorage key for a given session ID.
 */
export function getKey(sessionId: string): string {
  return `${CACHE_PREFIX}${sessionId}`
}

// ─────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────

/**
 * Converts a Map<string, number> to a JSON-compatible Array<[string, number]>.
 */
export function serializeMap(map: Map<string, number>): Array<[string, number]> {
  return Array.from(map.entries())
}

/**
 * Converts an Array<[string, number]> back to a Map<string, number>.
 */
export function deserializeMap(data: Array<[string, number]>): Map<string, number> {
  return new Map(data)
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

/**
 * Type guard that validates a parsed object has all required CacheEntry fields
 * with correct types.
 */
export function validate(obj: unknown): obj is CacheEntry {
  if (obj === null || typeof obj !== 'object') return false

  const candidate = obj as Record<string, unknown>

  // Check correction_map is an array of [string, number] tuples
  if (!Array.isArray(candidate.correction_map)) return false
  for (const entry of candidate.correction_map) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    if (typeof entry[0] !== 'string' || typeof entry[1] !== 'number') return false
  }

  // Check qc_limits is a non-null object
  if (candidate.qc_limits === null || typeof candidate.qc_limits !== 'object' || Array.isArray(candidate.qc_limits)) {
    return false
  }

  // Check calibration_results is a non-null object
  if (
    candidate.calibration_results === null ||
    typeof candidate.calibration_results !== 'object' ||
    Array.isArray(candidate.calibration_results)
  ) {
    return false
  }

  // Validate each calibration result entry has required numeric fields
  const calResults = candidate.calibration_results as Record<string, unknown>
  for (const key of Object.keys(calResults)) {
    const result = calResults[key]
    if (result === null || typeof result !== 'object') return false
    const r = result as Record<string, unknown>
    if (typeof r.uutAvg !== 'number') return false
    if (typeof r.correctionAvg !== 'number') return false
    if (typeof r.uncertainty !== 'number') return false
  }

  // Check timestamp is a non-empty string
  if (typeof candidate.timestamp !== 'string' || candidate.timestamp.length === 0) return false

  // Check row_count is a number
  if (typeof candidate.row_count !== 'number') return false

  return true
}

// ─────────────────────────────────────────────
// Storage Operations
// ─────────────────────────────────────────────

/**
 * Reads and validates a cache entry from localStorage.
 * If the entry is invalid or malformed, it is removed and null is returned.
 */
export function read(sessionId: string): CacheEntry | null {
  const key = getKey(sessionId)

  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)

    if (validate(parsed)) {
      return parsed
    }

    // Invalid entry — remove it
    localStorage.removeItem(key)
    return null
  } catch {
    // JSON parse error or other issue — remove the invalid entry
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Writes a cache entry to localStorage.
 * On QuotaExceededError, performs LRU eviction (oldest entries first) and retries.
 * Returns true if write succeeded, false if it failed even after eviction.
 */
export function write(sessionId: string, entry: CacheEntry): boolean {
  const key = getKey(sessionId)
  const value = JSON.stringify(entry)

  try {
    localStorage.setItem(key, value)
    return true
  } catch (error: unknown) {
    if (isQuotaExceededError(error)) {
      return evictAndRetry(key, value)
    }
    return false
  }
}

/**
 * Removes a cache entry from localStorage.
 */
export function remove(sessionId: string): void {
  const key = getKey(sessionId)
  localStorage.removeItem(key)
}

// ─────────────────────────────────────────────
// LRU Eviction
// ─────────────────────────────────────────────

/**
 * Finds all qc_cache_* entries, sorts by timestamp (oldest first),
 * and removes them one by one until the write succeeds.
 */
function evictAndRetry(targetKey: string, value: string): boolean {
  const cacheEntries = getAllCacheEntries(targetKey)

  // Sort by timestamp ascending (oldest first)
  cacheEntries.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    return timeA - timeB
  })

  for (const entry of cacheEntries) {
    localStorage.removeItem(entry.key)

    try {
      localStorage.setItem(targetKey, value)
      return true
    } catch (error: unknown) {
      if (!isQuotaExceededError(error)) {
        return false
      }
      // Continue evicting
    }
  }

  // All entries evicted, try one last time
  try {
    localStorage.setItem(targetKey, value)
    return true
  } catch {
    // Still fails — log warning and give up
    console.warn(
      `[qc-cache-storage] Unable to write cache entry for key "${targetKey}" even after evicting all other cache entries.`
    )
    return false
  }
}

/**
 * Collects all qc_cache_* entries from localStorage (excluding the target key).
 * Returns entries with their key and parsed timestamp for sorting.
 */
function getAllCacheEntries(excludeKey: string): Array<{ key: string; timestamp: string }> {
  const entries: Array<{ key: string; timestamp: string }> = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key === null) continue
    if (!key.startsWith(CACHE_PREFIX)) continue
    if (key === excludeKey) continue

    try {
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      const parsed = JSON.parse(raw)
      if (typeof parsed.timestamp === 'string') {
        entries.push({ key, timestamp: parsed.timestamp })
      }
    } catch {
      // Malformed entry — include it for eviction with epoch timestamp
      entries.push({ key, timestamp: '1970-01-01T00:00:00.000Z' })
    }
  }

  return entries
}

/**
 * Checks if an error is a QuotaExceededError.
 */
function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    // Most browsers
    return error.code === 22 || error.name === 'QuotaExceededError'
  }
  return false
}
