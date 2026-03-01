/**
 * lib/qc-utils.ts
 * 
 * Utilities for fetching dynamic QC limits from the master_qc table.
 * This replaces the hardcoded wmo-limits.ts approach.
 * 
 * Chain: sensor_id → sensor.instrument_id → instrument.instrument_names_id → master_qc.nilai_batas_koreksi
 */

export interface QCLimit {
    /** Instrument name from instrument_names table */
    instrumentName: string
    /** Raw nilai_batas_koreksi string e.g. "± 0.3" or "0.3" */
    rawLimit: string
    /** Parsed numeric limit value (absolute) */
    limitValue: number
    /** Unit string e.g. "°C", "%", "hPa" */
    unit: string
    /** Source master_qc id */
    masterQcId: number
}

/**
 * Parses a nilai_batas_koreksi string like "± 0.3", "0.3", "5%" into a number.
 * Returns the absolute numeric value, or Infinity if parsing fails (= always pass).
 */
export function parseNilaiBatasKoreksi(raw: string): number {
    if (!raw) return Infinity
    // Remove ±, spaces, commas, percentage handled by unit
    const cleaned = raw.replace(/[±\s,]/g, '').replace('%', '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? Infinity : Math.abs(num)
}

/** In-memory cache: sensor_id → QCLimit (null = no entry in DB) */
const cache = new Map<number, QCLimit | null>()

/**
 * Fetches the QC limit for a given sensor ID from the master_qc table.
 * Uses the API endpoint /api/master-qc?sensor_id=N which resolves the chain.
 * Results are cached in memory for the session.
 */
export async function fetchQCLimitForSensor(sensorId: number): Promise<QCLimit | null> {
    if (cache.has(sensorId)) return cache.get(sensorId) ?? null

    try {
        const res = await fetch(`/api/master-qc?sensor_id=${sensorId}`)
        if (!res.ok) {
            cache.set(sensorId, null)
            return null
        }
        const json = await res.json()
        if (!json.data) {
            cache.set(sensorId, null)
            return null
        }

        const row = json.data
        const limitValue = parseNilaiBatasKoreksi(row.nilai_batas_koreksi)
        const result: QCLimit = {
            instrumentName: row.instrument_names?.name ?? 'Unknown',
            rawLimit: row.nilai_batas_koreksi,
            limitValue,
            unit: row.ref_unit?.unit ?? '',
            masterQcId: row.id,
        }
        cache.set(sensorId, result)
        return result
    } catch {
        cache.set(sensorId, null)
        return null
    }
}

/**
 * Checks whether |correction| is within the QC limit.
 * Falls back to Infinity (always pass) if no limit found.
 */
export function checkQCResult(correction: number, limit: QCLimit | null): {
    passed: boolean
    correction: number
    limit: number
    limitStr: string
    instrumentName: string
} {
    const absCorrection = Math.abs(correction)
    const limitValue = limit?.limitValue ?? Infinity
    const passed = absCorrection <= limitValue + 0.000001 // small epsilon for float

    return {
        passed,
        correction: Number(correction.toFixed(4)),
        limit: limitValue,
        limitStr: limit ? `± ${limit.rawLimit} ${limit.unit}`.replace(/± ±/, '±').trim() : 'N/A',
        instrumentName: limit?.instrumentName ?? 'Unknown',
    }
}

/** Clears the in-memory cache (call on component unmount if needed) */
export function clearQCLimitCache() {
    cache.clear()
}
