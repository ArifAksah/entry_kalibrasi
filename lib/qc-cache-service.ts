/**
 * lib/qc-cache-service.ts
 *
 * QC Cache Service — orchestrates background computation and cache management.
 * Singleton module-level instance for use across the application.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 7.2
 */

import { computeQCData } from './qc-compute-worker'
import { CacheEntry, read, write, remove } from './qc-cache-storage'

// ─────────────────────────────────────────────
// In-flight computation tracking
// ─────────────────────────────────────────────

/**
 * Tracks in-flight computations by sessionId.
 * Each entry is a Promise that resolves to the computed CacheEntry.
 */
const inFlightMap = new Map<string, Promise<CacheEntry>>()

// ─────────────────────────────────────────────
// Service Methods
// ─────────────────────────────────────────────

/**
 * Triggers background pre-computation for a session in a non-blocking way.
 * Uses setTimeout(..., 0) to defer execution off the current call stack.
 *
 * If a computation is already in-flight for the same sessionId, the call is skipped.
 *
 * @param sessionId - The calibration session ID to compute QC data for
 */
export function triggerComputation(sessionId: string): void {
  // Skip if already computing for this session
  if (inFlightMap.has(sessionId)) {
    return
  }

  // Create the promise that tracks this computation
  const computePromise = new Promise<CacheEntry>((resolve, reject) => {
    setTimeout(async () => {
      try {
        const entry = await computeQCData(sessionId)
        write(sessionId, entry)
        resolve(entry)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown computation error'
        console.error(`[qc-cache-service] Computation failed for session "${sessionId}":`, message)
        reject(error)
      } finally {
        inFlightMap.delete(sessionId)
      }
    }, 0)
  })

  inFlightMap.set(sessionId, computePromise)
}

/**
 * Gets a cached QC entry for a session.
 * Delegates to cacheStorage.read() and returns the CacheEntry or null.
 *
 * @param sessionId - The calibration session ID
 * @returns The cached CacheEntry, or null if not found/invalid
 */
export function get(sessionId: string): CacheEntry | null {
  return read(sessionId)
}

/**
 * Invalidates (removes) the cache entry for a session.
 * Optionally re-triggers background computation.
 *
 * @param sessionId - The calibration session ID
 * @param recompute - If true, triggers a new background computation after invalidation
 */
export function invalidate(sessionId: string, recompute?: boolean): void {
  remove(sessionId)

  if (recompute) {
    triggerComputation(sessionId)
  }
}

/**
 * Force-refreshes the cache for a session.
 * Invalidates the existing entry and returns a Promise that resolves
 * to the newly computed CacheEntry.
 *
 * @param sessionId - The calibration session ID
 * @returns Promise resolving to the new CacheEntry
 */
export function refresh(sessionId: string): Promise<CacheEntry> {
  // Remove existing cache entry
  remove(sessionId)

  // If there's already an in-flight computation, cancel tracking it
  // (we want a fresh one)
  inFlightMap.delete(sessionId)

  // Create a new computation promise
  const computePromise = new Promise<CacheEntry>((resolve, reject) => {
    setTimeout(async () => {
      try {
        const entry = await computeQCData(sessionId)
        write(sessionId, entry)
        resolve(entry)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown computation error'
        console.error(`[qc-cache-service] Refresh failed for session "${sessionId}":`, message)
        reject(error)
      } finally {
        inFlightMap.delete(sessionId)
      }
    }, 0)
  })

  inFlightMap.set(sessionId, computePromise)
  return computePromise
}

/**
 * Checks if a computation is currently in-flight for a session.
 *
 * @param sessionId - The calibration session ID
 * @returns true if computation is in progress, false otherwise
 */
export function isComputing(sessionId: string): boolean {
  return inFlightMap.has(sessionId)
}

// ─────────────────────────────────────────────
// Singleton Export (default object for convenience)
// ─────────────────────────────────────────────

const qcCacheService = {
  triggerComputation,
  get,
  invalidate,
  refresh,
  isComputing,
}

export default qcCacheService
