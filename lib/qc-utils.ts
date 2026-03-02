/**
 * lib/qc-utils.ts
 *
 * Utilities for:
 * 1. Fetching dynamic QC limits from master_qc (by sensor_id)
 * 2. Fetching correction table from cert_standards (by sensor_id_std)
 * 3. Interpolating correction values from the setpoint table
 *
 * Calculation flow:
 *   raw standard_data
 *   → interpolate correction from cert_standard.setpoint[] / correction_std[]
 *   → std_corrected = standard_data + correction_from_cert
 *   → uut_correction = std_corrected - uut_data
 *   → compare |uut_correction| with master_qc batas_koreksi
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

// ─────────────────────────────────────────────
// Cert Standard Correction Interpolation
// ─────────────────────────────────────────────

export interface CertCorrectionPoint {
    setpoint: number
    correction: number
    u95: number
}

export interface CertCorrectionTable {
    sensorId: number
    noСertificate: string
    points: CertCorrectionPoint[]
}

/**
 * Parses a cert_standard row (from /api/cert-standards) into an array of correction points.
 * Handles all known DB formats:
 *   - setpoint[] + correction_std[] (most common)
 *   - correction_std as array of {setpoint, correction} objects
 */
export function parseCertCorrectionPoints(cert: any): CertCorrectionPoint[] {
    if (!cert) return []

    // Format A: separate setpoint[] and correction_std[] arrays (current schema)
    if (Array.isArray(cert.setpoint) && cert.setpoint.length > 0 && Array.isArray(cert.correction_std)) {
        return cert.setpoint
            .map((s: any, idx: number) => ({
                setpoint: parseFloat(String(s ?? '').replace(',', '.')) || 0,
                correction: parseFloat(String((cert.correction_std as any[])[idx] ?? '').replace(',', '.')) || 0,
                u95: parseFloat(String((Array.isArray(cert.u95_std) ? (cert.u95_std as any[])[idx] : 0) ?? '').replace(',', '.')) || 0,
            }))
            .filter((p: CertCorrectionPoint) => !isNaN(p.setpoint))
    }

    // Format B: correction_std is an array of objects
    if (Array.isArray(cert.correction_std) && cert.correction_std.length > 0 && typeof cert.correction_std[0] === 'object') {
        return cert.correction_std
            .map((d: any) => ({
                setpoint: parseFloat(String(d.setpoint ?? '').replace(',', '.')) || 0,
                correction: parseFloat(String(d.correction ?? d.koreksi ?? '').replace(',', '.')) || 0,
                u95: parseFloat(String(d.u95 ?? d.u95_std ?? '').replace(',', '.')) || 0,
            }))
            .filter((p: CertCorrectionPoint) => !isNaN(p.setpoint))
    }

    return []
}

/**
 * Linear interpolation of correction value for a given standard reading.
 * If reading is outside the range, returns the nearest boundary correction.
 */
export function interpolateCorrectionFromPoints(
    points: CertCorrectionPoint[],
    standardReading: number
): number {
    if (points.length === 0) return 0
    if (points.length === 1) return points[0].correction

    // Sort ascending by setpoint
    const sorted = [...points].sort((a, b) => a.setpoint - b.setpoint)

    // Below minimum setpoint → use first correction
    if (standardReading <= sorted[0].setpoint) return sorted[0].correction
    // Above maximum setpoint → use last correction
    if (standardReading >= sorted[sorted.length - 1].setpoint) return sorted[sorted.length - 1].correction

    // Find the two surrounding points and interpolate
    for (let i = 0; i < sorted.length - 1; i++) {
        const lo = sorted[i]
        const hi = sorted[i + 1]
        if (standardReading >= lo.setpoint && standardReading <= hi.setpoint) {
            const t = (standardReading - lo.setpoint) / (hi.setpoint - lo.setpoint)
            return lo.correction + t * (hi.correction - lo.correction)
        }
    }
    return 0
}

/** Cache: `${sensorIdStd}:${reading}` → correction value from DB */
const hitungKoreksiCache = new Map<string, number>()

/**
 * Calls the Supabase `hitung_koreksi(reading, sensor_std_id)` function via API.
 * Returns the interpolated correction value from the certificate_standard table.
 * Results are cached per (reading, sensor_std_id) pair.
 */
export async function hitungKoreksiDB(reading: number, sensorStdId: number): Promise<number> {
    const key = `${sensorStdId}:${reading}`
    if (hitungKoreksiCache.has(key)) return hitungKoreksiCache.get(key)!

    try {
        const res = await fetch(`/api/hitung-koreksi?reading=${reading}&sensor_std_id=${sensorStdId}`)
        if (!res.ok) { hitungKoreksiCache.set(key, 0); return 0 }
        const json = await res.json()
        const correction = typeof json.correction === 'number' ? json.correction : 0
        hitungKoreksiCache.set(key, correction)
        return correction
    } catch {
        hitungKoreksiCache.set(key, 0)
        return 0
    }
}

/**
 * Batch version: calls hitungKoreksiDB for multiple (reading, sensorStdId) pairs.
 * Returns a Map keyed as `${sensorStdId}:${reading}` → correction.
 */
export async function hitungKoreksiBatch(
    pairs: Array<{ reading: number; sensorStdId: number }>
): Promise<Map<string, number>> {
    // Deduplicate pairs
    const unique = Array.from(
        new Map(pairs.map(p => [`${p.sensorStdId}:${p.reading}`, p])).values()
    )
    await Promise.all(unique.map(p => hitungKoreksiDB(p.reading, p.sensorStdId)))
    // All results are now cached — build return map
    const result = new Map<string, number>()
    pairs.forEach(p => {
        const key = `${p.sensorStdId}:${p.reading}`
        result.set(key, hitungKoreksiCache.get(key) ?? 0)
    })
    return result
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

/**
 * Format LaTeX unit strings from the database (e.g., ^\circ C) into readable Unicode strings.
 */
export function formatLatexUnit(raw: string): string {
    if (!raw) return '';
    return raw
        // Handle degree Celsius
        .replace(/\^\\circ C/g, '°C')
        .replace(/\\circ C/g, '°C')
        .replace(/\^\\circ/g, '°')
        .replace(/\\circ/g, '°')
        // General text formatting replacements
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\mu/g, 'µ')
        .replace(/\\Omega/g, 'Ω')
        .replace(/\\%\s?RH/g, '%RH')
        // Clean up any stray curly braces
        .replace(/[{}]/g, '')
        .trim();
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
        const parsedUnit = formatLatexUnit(row.ref_unit?.unit ?? '')
        const result: QCLimit = {
            instrumentName: row.instrument_names?.name ?? 'Unknown',
            rawLimit: row.nilai_batas_koreksi,
            limitValue,
            unit: parsedUnit,
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

/** Clears all in-memory caches */
export function clearQCLimitCache() {
    cache.clear()
    hitungKoreksiCache.clear()
}
