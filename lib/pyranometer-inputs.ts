import { interpolateCorrectionFromPoints, parseCertCorrectionPoints } from './qc-utils'
import {
    calculateCalibrationFactor,
    calculatePyranometerUncertainty,
    interpolateU95FromPoints,
    type CalibrationFactorResult,
} from './uncertainty-utils'

/**
 * ============================================================================
 * PYRANOMETER — PERAKITAN INPUT (SATU SUMBER)
 * ============================================================================
 *
 * Nilai U95 pyranometer di sertifikat DITULIS oleh dua tempat:
 *   - `QCDataModal` (tombol "Hitung dan Input Tabel ke Sertifikat")
 *   - `certificates-crud` (tombol "Hitung Otomatis")
 * sedangkan `UncertaintyModal` menampilkan hasil perhitungannya sendiri.
 *
 * Bila inputnya dirakit berbeda, angka di sertifikat menyimpang dari modal
 * (temuan petugas kalibrasi). Helper ini menyalin **persis** resep
 * UncertaintyModal supaya ketiganya menghasilkan angka yang sama.
 * ============================================================================
 */

/** Resolusi UUT seperti UncertaintyModal: `resolution` → `graduating` → 0. */
export function resolveUutResolution(sensor: any): number {
    const raw =
        sensor?.resolution != null
            ? sensor.resolution
            : parseFloat(sensor?.graduating ?? '0')
    const value = typeof raw === 'number' ? raw : parseFloat(String(raw))
    return Number.isFinite(value) ? value : 0
}

/** Resolusi standar seperti UncertaintyModal: `resolution` → 0. */
export function resolveStdResolution(standardCertRecord: any): number {
    const raw =
        typeof standardCertRecord?.resolution === 'number'
            ? standardCertRecord.resolution
            : parseFloat(standardCertRecord?.resolution)
    return Number.isFinite(raw) ? raw : 0
}

/**
 * Ambil data sensor standar dengan aman.
 *
 * Sensor standar seringkali TIDAK ada di daftar sensor yang dimuat aplikasi: daftar
 * yang dikirim ke QC Check hanya memuat sensor milik instrumen UUT
 * (`getFullSensorsForInstrument`). Bila pencarian gagal, tipe alat standar tidak
 * terbaca sehingga drift ISO 9060 jatuh menjadi 0 dan U95 sertifikat salah
 * (mis. 2,109 % alih-alih 4,029 %). Karena itu, bila tidak ada di daftar, sensor
 * diambil langsung lewat API.
 *
 * `fetcher` disediakan agar bisa diuji tanpa jaringan.
 */
export async function resolveStdSensor(
    id: number | string | null | undefined,
    sensors?: any[] | null,
    fetcher: typeof fetch = fetch,
): Promise<any | null> {
    if (id == null || id === '') return null

    const found = (Array.isArray(sensors) ? sensors : []).find(
        (sensor: any) => String(sensor?.id) === String(id),
    )
    if (found) return found

    try {
        const response = await fetcher(`/api/sensors/${id}`)
        if (!response?.ok) return null
        const payload: any = await response.json()
        return payload?.data ?? payload ?? null
    } catch {
        return null
    }
}

/**
 * U95 sertifikat standar (dalam %): interpolasi dari titik setpoint, kalau
 * tidak ada titik baru pakai `u95_general`, kalau tidak ada sama sekali → 0.
 * Ini yang membedakan dari perilaku lama `u95_general || 2.1`.
 */
export function resolveCertU95Percent(args: {
    standardCertRecord?: any
    rows?: any[]
}): number {
    const points = args.standardCertRecord
        ? parseCertCorrectionPoints(args.standardCertRecord)
        : []

    if (points.length > 0) {
        const rows = Array.isArray(args.rows) ? args.rows : []
        const stdCorrected =
            rows.length > 0
                ? rows.reduce((sum, row) => {
                      const stdData = Number(row?.standard_data) || 0
                      return sum + stdData + interpolateCorrectionFromPoints(points, stdData)
                  }, 0) / rows.length
                : 0
        return interpolateU95FromPoints(points, stdCorrected)
    }

    const general = args.standardCertRecord?.u95_general
    const value = typeof general === 'number' ? general : parseFloat(general)
    return Number.isFinite(value) ? value : 0
}

export interface PyranometerInputSources {
    /** Baris data mentah sesi sensor (punya `standard_data` & `uut_data`). */
    rows: any[]
    /** Record `certificate_standard` milik alat standar. */
    standardCertRecord?: any
    /** Sensor UUT (pyranometer). */
    uutSensor?: any
    /** Sensor standar — dipakai untuk aturan drift ISO 9060. */
    stdSensor?: any
    /** Kontrak metode (profil aktif atau snapshot sertifikat). */
    rules?: unknown
}

export interface PyranometerInputs {
    params: Parameters<typeof calculatePyranometerUncertainty>[0]
    cfResult: CalibrationFactorResult
    stdMean: number
    uutMean: number
}

/**
 * Rakit input pyranometer persis seperti UncertaintyModal. Mengembalikan `null`
 * bila tidak ada pasangan (std, uut) yang valid.
 */
export function buildPyranometerInputs(
    sources: PyranometerInputSources,
): PyranometerInputs | null {
    const rows = Array.isArray(sources.rows) ? sources.rows : []
    const validPairs = rows
        .map((row) => ({
            std: Number(row?.standard_data),
            uut: Number(row?.uut_data),
        }))
        .filter(
            (pair) =>
                Number.isFinite(pair.std) &&
                Number.isFinite(pair.uut) &&
                pair.std > 0 &&
                pair.uut > 0,
        )

    if (validPairs.length === 0) return null

    const stdReadings = validPairs.map((pair) => pair.std)
    const uutReadings = validPairs.map((pair) => pair.uut)
    const cfResult = calculateCalibrationFactor(stdReadings, uutReadings, {
        filterOutliers: false,
    })
    const stdMean = stdReadings.reduce((a, b) => a + b, 0) / stdReadings.length
    const uutMean = uutReadings.reduce((a, b) => a + b, 0) / uutReadings.length
    const range = parseFloat(sources.uutSensor?.range_capacity || '2000') || 2000

    return {
        cfResult,
        stdMean,
        uutMean,
        params: {
            cf_result: cfResult,
            certU95_percent: resolveCertU95Percent({
                standardCertRecord: sources.standardCertRecord,
                rows,
            }),
            resolutionStd: resolveStdResolution(sources.standardCertRecord),
            resolutionUut: resolveUutResolution(sources.uutSensor),
            range,
            sensorType: sources.uutSensor?.type || sources.uutSensor?.name || '',
            stdMean,
            uutMean,
            stdSensorType: sources.stdSensor?.type || sources.stdSensor?.name || '',
            // Cadangan bila tipe alat standar tidak diketahui (sensor standar tidak
            // ada di daftar yang dimuat aplikasi): pakai drift dari record sertifikat.
            driftPercentOverride: Number(sources.standardCertRecord?.drift) || undefined,
            rules: sources.rules,
        },
    }
}

/**
 * Sensitivitas baru pyranometer analog: `Sbaru = Slama × CF final`
 * (workbook pyranometer, sheet Brief — "3.0 Perhitungan sensitivitas baru").
 * Mengembalikan `null` bila salah satu nilai tidak valid (<= 0 / bukan angka).
 */
export function calculateNewSensitivity(slama: unknown, cfFinal: unknown): number | null {
    const oldValue = typeof slama === 'number' ? slama : parseFloat(String(slama ?? ''))
    const cf = typeof cfFinal === 'number' ? cfFinal : parseFloat(String(cfFinal ?? ''))
    if (!Number.isFinite(oldValue) || oldValue <= 0) return null
    if (!Number.isFinite(cf) || cf <= 0) return null
    return Number((oldValue * cf).toPrecision(6))
}

/** Pyranometer analog (instrument_type_id = 2) — dasar perhitungan sensitivitas baru. */
export function isAnalogPyranometer(instrument: any): boolean {
    return Number(instrument?.instrument_type_id) === 2
}
