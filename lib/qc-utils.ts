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

import { formatUnit, normaliseUnit } from './unitConversion';

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
export async function hitungKoreksiDB(reading: number, sensorStdId: number): Promise<number | null> {
    const key = `${sensorStdId}:${reading}`
    if (hitungKoreksiCache.has(key)) return hitungKoreksiCache.get(key)!

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(`/api/hitung-koreksi?reading=${reading}&sensor_std_id=${sensorStdId}`)
            if (res.ok) {
                const json = await res.json()
                const correction = Number(json.correction)
                if (Number.isFinite(correction)) {
                    hitungKoreksiCache.set(key, correction)
                    return correction
                }
            }
        } catch {
            // Retry transient network errors below.
        }
        if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 150))
        }
    }
    return null
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
    const missing = unique.filter(p => !hitungKoreksiCache.has(`${p.sensorStdId}:${p.reading}`))

    if (missing.length > 0) {
        try {
            const res = await fetch('/api/hitung-koreksi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairs: missing }),
            })

            if (res.ok) {
                const json = await res.json()
                const corrections = json?.corrections && typeof json.corrections === 'object'
                    ? json.corrections
                    : {}

                missing.forEach(p => {
                    const key = `${p.sensorStdId}:${p.reading}`
                    if (!(key in corrections)) return
                    const correction = Number(corrections[key])
                    if (Number.isFinite(correction)) hitungKoreksiCache.set(key, correction)
                })

                // Retry only points omitted by the batch response. A transient RPC
                // failure must not silently become a persisted correction fallback.
                const unresolved = missing.filter(p =>
                    !hitungKoreksiCache.has(`${p.sensorStdId}:${p.reading}`)
                )
                for (let i = 0; i < unresolved.length; i += 5) {
                    await Promise.all(
                        unresolved.slice(i, i + 5)
                            .map(p => hitungKoreksiDB(p.reading, p.sensorStdId))
                    )
                }
            } else {
                for (let i = 0; i < missing.length; i += 5) {
                    await Promise.all(
                        missing.slice(i, i + 5)
                            .map(p => hitungKoreksiDB(p.reading, p.sensorStdId))
                    )
                }
            }
        } catch {
            for (let i = 0; i < missing.length; i += 5) {
                await Promise.all(
                    missing.slice(i, i + 5)
                        .map(p => hitungKoreksiDB(p.reading, p.sensorStdId))
                )
            }
        }
    }
    // All results are now cached — build return map
    const result = new Map<string, number>()
    pairs.forEach(p => {
        const key = `${p.sensorStdId}:${p.reading}`
        const correction = hitungKoreksiCache.get(key)
        if (correction != null) result.set(key, correction)
    })
    return result
}

/** Build deterministic corrections from one latest certificate per STD sensor. */
export function buildCorrectionMapFromCertificates(
    pairs: Array<{ reading: number; sensorStdId: number; standardCertificateId?: number | null }>,
    certificates: any[]
): Map<string, number> {
    const latestBySensor = new Map<number, any>()
    certificates.forEach(certificate => {
        const sensorId = Number(certificate?.sensor_id)
        if (!Number.isFinite(sensorId)) return
        const current = latestBySensor.get(sensorId)
        const currentTime = current?.calibration_date ? new Date(current.calibration_date).getTime() : -Infinity
        const candidateTime = certificate?.calibration_date ? new Date(certificate.calibration_date).getTime() : -Infinity
        if (!current || candidateTime > currentTime) latestBySensor.set(sensorId, certificate)
    })

    const pointsBySensor = new Map<number, CertCorrectionPoint[]>()
    latestBySensor.forEach((certificate, sensorId) => {
        const points = parseCertCorrectionPoints(certificate)
        if (points.length > 0) pointsBySensor.set(sensorId, points)
    })

    const result = new Map<string, number>()
    pairs.forEach(({ reading, sensorStdId, standardCertificateId }) => {
        const selectedCertificate = standardCertificateId
            ? certificates.find(certificate => Number(certificate?.id) === Number(standardCertificateId))
            : null
        const points = selectedCertificate
            ? parseCertCorrectionPoints(selectedCertificate)
            : pointsBySensor.get(sensorStdId)
        if (!points || points.length === 0) return
        const key = `${standardCertificateId || 'latest'}:${sensorStdId}:${reading}`
        result.set(key, interpolateCorrectionFromPoints(points, reading))
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
 * Delegates to formatUnit() from unitConversion.ts for comprehensive LaTeX handling.
 */
export function formatLatexUnit(raw: string): string {
    if (!raw) return '';
    return formatUnit(raw).replace(/°\s+/g, '°');
}

/** In-memory cache: sensor_id + normalized UUT unit → QCLimit. */
const cache = new Map<string, QCLimit | null>()

export function getQCLimitCacheKey(sensorId: number, unitUut: string): string {
    return `${sensorId}:${normaliseUnit(unitUut)}`
}

/**
 * Fetches the QC limit for a given sensor ID from the master_qc table.
 * Uses the API endpoint /api/master-qc?sensor_id=N which resolves the chain.
 * Results are cached in memory for the session.
 */
export async function fetchQCLimitForSensor(sensorId: number, unitUut: string): Promise<QCLimit | null> {
    const cacheKey = getQCLimitCacheKey(sensorId, unitUut)
    if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null

    if (!normaliseUnit(unitUut)) {
        cache.set(cacheKey, null)
        return null
    }

    try {
        const params = new URLSearchParams({
            sensor_id: String(sensorId),
            unit_uut: unitUut,
        })
        const res = await fetch(`/api/master-qc?${params.toString()}`)
        if (!res.ok) {
            cache.set(cacheKey, null)
            return null
        }
        const json = await res.json()
        if (!json.data) {
            cache.set(cacheKey, null)
            return null
        }

        const row = json.data
        const limitValue = parseNilaiBatasKoreksi(row.nilai_batas_koreksi)
        const parsedUnit = formatLatexUnit(row.ref_unit?.unit ?? '')
        const result: QCLimit = {
            instrumentName: row.instrument_names?.names ?? row.instrument_names?.name ?? 'Unknown',
            rawLimit: row.nilai_batas_koreksi,
            limitValue,
            unit: parsedUnit,
            masterQcId: row.id,
        }
        cache.set(cacheKey, result)
        return result
    } catch {
        cache.set(cacheKey, null)
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
        correction,
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

export function clearHitungKoreksiCache() {
    hitungKoreksiCache.clear()
}
