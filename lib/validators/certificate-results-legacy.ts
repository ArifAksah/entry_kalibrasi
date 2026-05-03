/**
 * ============================================================================
 * CERTIFICATE RESULTS — LEGACY (V0) ADAPTER
 * ============================================================================
 *
 * Konversi data `certificate.results` legacy (shape flat/array tanpa
 * schema_version) menjadi `CertificateResultsV1`. Idempoten: kalau input
 * sudah V1, dikembalikan apa adanya setelah validasi.
 *
 * Tujuan utama:
 *   - dipakai oleh API POST/PUT untuk "normalisasi on write"
 *   - dipakai oleh backfill script (dry-run dulu, commit kemudian)
 *   - dipakai oleh renderer sebagai fallback dual-read
 *
 * Filosofi konversi:
 *   - CONSERVATIVE: kalau field legacy bisa diambil apa adanya, pakai itu.
 *     JANGAN menebak-nebak/infer (mis. memindahkan tabel "Kondisi Kalibrasi"
 *     ke environment). Data preservation > normalization beauty.
 *   - GRACEFUL: field hilang → default kosong, bukan throw.
 *   - EXPLICIT ERRORS: struktur dasar tidak dikenali → throw dengan pesan
 *     jelas (dipakai di backfill report).
 * ============================================================================
 */

import {
  CertificateResultsV1,
  CertificateResultsV1Schema,
  RESULTS_SCHEMA_VERSION,
  isResultsV1Shape,
  SensorResultV1,
} from './certificate-results'

/** Kind kalibrasi diambil dari kolom `certificate.calibration_place`. */
export type CalibrationKind = 'FC' | 'LC'

/**
 * Input legacy bisa berupa:
 *   - string JSON (kolom JSONB kadang ter-serialize)
 *   - array V0 (format lama yang paling umum)
 *   - object V1 (data yang sudah dinormalisasi)
 *   - null/undefined (certificate belum punya hasil)
 */
export type LegacyResultsInput = unknown

// ---------------------------------------------------------------------------
// 1. Unwrap — normalisasi input awal
// ---------------------------------------------------------------------------

function unwrap(raw: LegacyResultsInput): unknown {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error('results: string bukan JSON valid')
    }
  }
  return raw
}

// ---------------------------------------------------------------------------
// 2. Field extractors (defensive — tidak crash untuk shape aneh)
// ---------------------------------------------------------------------------

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function asPlainObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

// ---------------------------------------------------------------------------
// 3. Per-entry converter (satu elemen array legacy → satu SensorResultV1)
// ---------------------------------------------------------------------------

function convertLegacyEntry(raw: unknown, index: number): SensorResultV1 {
  const entry = asPlainObject(raw)

  // --- links ------------------------------------------------------------
  const sensorId = asNumberOrNull(entry.sensorId ?? entry.sensor_id)
  if (!sensorId) {
    throw new Error(`results[${index}]: sensorId/sensor_id wajib ada`)
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const sessionIdRaw = asString(entry.session_id ?? entry.sessionId)
  const sessionId = UUID_RE.test(sessionIdRaw) ? sessionIdRaw : undefined
  const stationIdRaw = asNumberOrNull(entry.stationId ?? entry.station_id)

  // --- snapshot ---------------------------------------------------------
  // Sumber snapshot legacy = `sensorDetails`. Field tidak seragam antar
  // versi lama, jadi ambil dengan fallback yang banyak.
  const sd = asPlainObject(entry.sensorDetails ?? entry.sensor_details)

  const snapshot: SensorResultV1['snapshot'] = {
    name: asString(sd.name ?? sd.nama_sensor ?? entry.name),
    manufacturer: asString(sd.manufacturer ?? sd.merk_sensor ?? sd.merk),
    type: asString(sd.type ?? sd.tipe_sensor ?? sd.tipe),
    serial_number: asString(sd.serial_number ?? sd.serial_number_sensor ?? sd.sn),

    range_capacity: asString(sd.range_capacity),
    range_capacity_unit: asString(sd.range_capacity_unit),

    graduating: asString(sd.graduating),
    graduating_unit: asString(sd.graduating_unit),

    resolution: asNumberOrNull(sd.resolution),

    funnel_diameter: asNumberOrNull(sd.funnel_diameter),
    funnel_diameter_unit: asString(sd.funnel_diameter_unit),
    volume_per_tip: (sd.volume_per_tip == null || sd.volume_per_tip === '') ? null : asString(sd.volume_per_tip),
    volume_per_tip_unit: asString(sd.volume_per_tip_unit),
    funnel_area: asNumberOrNull(sd.funnel_area),
    funnel_area_unit: asString(sd.funnel_area_unit),
  }

  // --- setup ------------------------------------------------------------
  // Legacy menyimpan ini di `notesForm`. Waspadai typo lama:
  //   `calibration_methode` (sic) vs `calibration_method`.
  const nf = asPlainObject(entry.notesForm ?? entry.notes_form)

  // V0 menyimpan `standardInstruments` sebagai `number[]` (array of sensor IDs)
  // — dibuktikan di certificates-crud.tsx. V1 expect rich object supaya siap
  // snapshot-freeze di Opsi C. Support kedua bentuk di sini.
  const rawStandards = asArray<unknown>(nf.standardInstruments ?? nf.standard_instruments)
  const standardInstruments = rawStandards.map((si) => {
    if (typeof si === 'number' || typeof si === 'string') {
      const sensorId = asNumberOrNull(si)
      return {
        instrument_id: asNumberOrNull((entry as any).standardInstrumentId ?? (entry as any).standard_instrument_id),
        sensor_id: sensorId,
        name: '',
        serial_number: '',
        certificate_no: asString((entry as any).standardCertificateNumber ?? (entry as any).standard_certificate_number),
        traceable_to: '',
      }
    }
    const obj = asPlainObject(si)
    return {
      instrument_id: asNumberOrNull(obj.instrument_id ?? obj.id),
      sensor_id: asNumberOrNull(obj.sensor_id),
      name: asString(obj.name),
      serial_number: asString(obj.serial_number ?? obj.sn),
      certificate_no: asString(
        obj.certificate_no ??
        obj.no_certificate ??
        (entry as any).standardCertificateNumber ??
        (entry as any).standard_certificate_number
      ),
      traceable_to: asString(obj.traceable_to ?? obj.traceability),
    }
  })

  const environment = asArray<Record<string, unknown>>(entry.environment).map((c) => ({
    key: asString(c.key),
    value: asString(c.value),
    unit: asString(c.unit),
  }))

  const setup: SensorResultV1['setup'] = {
    calibration_method: asString(nf.calibration_method ?? nf.calibration_methode),
    reference_document: asString(nf.reference_document),
    traceable_to_si_through: asString(nf.traceable_to_si_through),
    others: asString(nf.others),
    // Hanya set kalau eksplisit boolean. Undefined → renderer fallback ke
    // `Boolean(others)` (pola isOthersEnabled di renderer).
    ...(typeof nf.others_enabled === 'boolean' ? { others_enabled: nf.others_enabled } : {}),
    start_date: asString(entry.startDate ?? entry.start_date),
    end_date: asString(entry.endDate ?? entry.end_date),
    environment,
    standard_instruments: standardInstruments,
    measurement_units: {
      uut: asString(entry.unitUut ?? entry.unit_uut),
      std: asString(entry.unitStd ?? entry.unit_std),
    },
  }

  // --- display ----------------------------------------------------------
  const tables = asArray<Record<string, unknown>>(entry.table ?? entry.tables).map((t) => ({
    title: asString(t.title),
    ...(Array.isArray(t.headers) ? { headers: (t.headers as unknown[]).map((h) => asString(h)) } : {}),
    rows: asArray<Record<string, unknown>>(t.rows).map((r) => ({
      key: asString(r.key),
      value: asString(r.value),
      unit: asString(r.unit),
      ...(Array.isArray(r.extraValues) && r.extraValues.length > 0
        ? { extraValues: (r.extraValues as unknown[]).map((x) => asString(x)) }
        : {}),
    })),
  }))

  const images = asArray<Record<string, unknown>>(entry.images).map((img) => ({
    url: asString(img.url),
    caption: asString(img.caption),
  }))

  const display: SensorResultV1['display'] = {
    place: asString(entry.place),
    tables,
    images,
  }

  return {
    links: {
      sensor_id: sensorId,
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(stationIdRaw ? { station_id: stationIdRaw } : {}),
    },
    snapshot,
    setup,
    display,
  }
}

// ---------------------------------------------------------------------------
// 4. Public API — konversi sertifikat utuh
// ---------------------------------------------------------------------------

export interface ConvertContext {
  /** Dibaca dari kolom `certificate.calibration_place`. */
  calibration_kind: CalibrationKind
}

/**
 * Konversi legacy V0 → V1. Idempoten: kalau input sudah V1, divalidasi
 * lalu dikembalikan.
 *
 * Throw `Error` dengan pesan deskriptif kalau data fatally broken
 * (mis. sensor_id tidak ada sama sekali). Backfill script akan
 * menangkap ini dan mencatat di report.
 */
export function convertResultsLegacyToV1(
  raw: LegacyResultsInput,
  ctx: ConvertContext
): CertificateResultsV1 {
  const unwrapped = unwrap(raw)

  // Already V1 → validate & passthrough
  if (isResultsV1Shape(unwrapped)) {
    return CertificateResultsV1Schema.parse(unwrapped)
  }

  // Legacy V0 atau null
  const legacyArr = asArray(unwrapped)
  const sensors = legacyArr.map((entry, i) => convertLegacyEntry(entry, i))

  if (sensors.length === 0) {
    throw new Error('results: tidak ada entri sensor (legacy kosong atau shape tidak dikenali)')
  }

  const v1: CertificateResultsV1 = {
    schema_version: RESULTS_SCHEMA_VERSION,
    calibration_kind: ctx.calibration_kind,
    sensors,
  }

  // Validasi akhir — ini menjamin output selalu sesuai Zod schema.
  return CertificateResultsV1Schema.parse(v1)
}

// ---------------------------------------------------------------------------
// 5. Safe wrapper untuk backfill / renderer yang butuh result objektif
// ---------------------------------------------------------------------------

export type ConvertOutcome =
  | { ok: true; data: CertificateResultsV1; wasLegacy: boolean }
  | { ok: false; error: string }

/**
 * Versi non-throwing — pakai ini di backfill script dan di renderer
 * supaya satu data rusak tidak mematikan loop.
 */
export function tryConvertResultsLegacyToV1(
  raw: LegacyResultsInput,
  ctx: ConvertContext
): ConvertOutcome {
  try {
    const wasLegacy = !isResultsV1Shape(unwrap(raw))
    const data = convertResultsLegacyToV1(raw, ctx)
    return { ok: true, data, wasLegacy }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
