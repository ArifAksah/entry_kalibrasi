/**
 * ============================================================================
 * CERTIFICATE RESULTS — RENDER ADAPTER (V1 → V0-VIEW)
 * ============================================================================
 *
 * Menyediakan "jembatan" agar semua renderer lama (print, view, draft-view,
 * LHKS) tetap bisa pakai shape V0 lama tanpa refactor masif.
 *
 * STRATEGI
 * --------
 *   Data di DB boleh berupa V0 (legacy) atau V1 (new). Renderer TIDAK perlu
 *   tahu — mereka selalu menerima array of V0-shaped entries via helper
 *   `resultsToLegacyView()`.
 *
 *   Ketika Opsi C (full normalization) datang nanti, helper ini akan
 *   diganti output-nya jadi "query hasil dari tabel relational, assemble
 *   ke V0-shape". Renderer tetap tidak berubah.
 *
 * INVARIANTS
 * ----------
 *   - Input boleh: null, undefined, string JSON, array V0, objek V1.
 *   - Output: SELALU `LegacyResultEntry[]` (bisa kosong).
 *   - Tidak throw untuk data rusak — kembalikan [] supaya renderer tidak crash.
 *     Error ditulis ke console.warn supaya ter-monitor.
 * ============================================================================
 */

import {
  isResultsV1Shape,
  parseResultsV1Safe,
  type CertificateResultsV1,
  type SensorResultV1,
} from './certificate-results'

// ---------------------------------------------------------------------------
// Shape V0 yang diharapkan renderer (dokumentasi kontrak, bukan runtime)
// ---------------------------------------------------------------------------

export interface LegacyResultEntry {
  sensorId: number | null
  session_id?: string | null
  unitUut?: string | null
  unitStd?: string | null
  place: string
  startDate: string
  endDate: string
  table: Array<{ title: string; headers?: string[]; rows: Array<{ key: string; value: string; unit: string; extraValues?: string[] }> }>
  images: Array<{ url: string; caption: string }>
  environment: Array<{ key: string; value: string; unit: string }>
  notesForm: {
    calibration_methode: string
    reference_document: string
    traceable_to_si_through: string
    others: string
    others_enabled?: boolean
    /** Array of sensor IDs — sesuai type renderer di certificates-crud.tsx */
    standardInstruments: number[]
  }
  sensorDetails: {
    id: number | null
    name: string
    manufacturer: string
    type: string
    serial_number: string
    range_capacity: string
    range_capacity_unit: string
    graduating: string
    graduating_unit: string
    funnel_diameter: number | string | null
    funnel_diameter_unit: string
    funnel_area: number | string | null
    funnel_area_unit: string
    volume_per_tip: number | string | null
    volume_per_tip_unit: string
  }
}

// ---------------------------------------------------------------------------
// V1 SensorResult → LegacyResultEntry
// ---------------------------------------------------------------------------

function sensorV1ToLegacyEntry(s: SensorResultV1): LegacyResultEntry {
  return {
    sensorId: s.links.sensor_id,
    session_id: s.links.session_id ?? null,
    unitUut: s.setup.measurement_units?.uut || s.snapshot.graduating_unit || s.snapshot.range_capacity_unit || null,
    unitStd: s.setup.measurement_units?.std ?? null,
    place: s.display.place,
    startDate: s.setup.start_date,
    endDate: s.setup.end_date,
    table: s.display.tables.map((t) => ({
      title: t.title,
      ...(Array.isArray(t.headers) ? { headers: t.headers } : {}),
      rows: t.rows.map((r) => ({
        key: r.key,
        value: r.value,
        unit: r.unit,
        ...(r.extraValues && r.extraValues.length > 0 ? { extraValues: r.extraValues } : {}),
      })),
    })),
    images: s.display.images.map((img) => ({ url: img.url, caption: img.caption })),
    environment: s.setup.environment.map((c) => ({ key: c.key, value: c.value, unit: c.unit })),
    notesForm: {
      calibration_methode: s.setup.calibration_method,
      reference_document: s.setup.reference_document,
      traceable_to_si_through: s.setup.traceable_to_si_through,
      others: s.setup.others,
      ...(typeof s.setup.others_enabled === 'boolean'
        ? { others_enabled: s.setup.others_enabled }
        : {}),
      // Ambil hanya instrument_id — itulah yang dibutuhkan renderer lookup.
      // name/sn dari V1 snapshot belum dipakai renderer hari ini, disimpan
      // saja di V1 untuk kepentingan Opsi C.
      standardInstruments: s.setup.standard_instruments
        .map((si) => si.sensor_id ?? si.instrument_id)
        .filter((id): id is number => typeof id === 'number'),
    },
    sensorDetails: {
      id: s.links.sensor_id,
      name: s.snapshot.name,
      manufacturer: s.snapshot.manufacturer,
      type: s.snapshot.type,
      serial_number: s.snapshot.serial_number,
      range_capacity: s.snapshot.range_capacity,
      range_capacity_unit: s.snapshot.range_capacity_unit,
      graduating: s.snapshot.graduating,
      graduating_unit: s.snapshot.graduating_unit,
      funnel_diameter: s.snapshot.funnel_diameter ?? null,
      funnel_diameter_unit: s.snapshot.funnel_diameter_unit,
      funnel_area: s.snapshot.funnel_area ?? null,
      funnel_area_unit: s.snapshot.funnel_area_unit,
      volume_per_tip: s.snapshot.volume_per_tip ?? null,
      volume_per_tip_unit: s.snapshot.volume_per_tip_unit,
    },
  }
}

function v1ToLegacyArray(doc: CertificateResultsV1): LegacyResultEntry[] {
  return doc.sensors.map(sensorV1ToLegacyEntry)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Konversi raw `certificate.results` (apapun shape-nya) → V0 array yang
 * siap di-konsumsi renderer lama. Tidak pernah throw.
 *
 * Jika input null/undefined/invalid → kembalikan [] dan log warn (kecuali
 * null/undefined murni yang memang berarti "tidak ada data").
 */
export function resultsToLegacyView(raw: unknown): LegacyResultEntry[] {
  if (raw == null) return []

  // Unwrap string JSON
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch (e) {
      console.warn('[render-adapter] results string bukan JSON valid:', e)
      return []
    }
  }

  // V1: validate & convert
  if (isResultsV1Shape(value)) {
    const parsed = parseResultsV1Safe(value)
    if (!parsed.success) {
      console.warn(
        '[render-adapter] V1 shape tapi tidak valid:',
        parsed.error.issues.slice(0, 3)
      )
      return []
    }
    return v1ToLegacyArray(parsed.data)
  }

  // V0: passthrough as-is (renderer sudah handle defensive)
  if (Array.isArray(value)) {
    return value as LegacyResultEntry[]
  }

  // Unknown shape
  console.warn('[render-adapter] shape tidak dikenali (bukan V0/V1), skip')
  return []
}

/** Helper praktis untuk renderer: dapatkan entry pertama atau null. */
export function firstLegacyResult(raw: unknown): LegacyResultEntry | null {
  const arr = resultsToLegacyView(raw)
  return arr.length > 0 ? arr[0] : null
}
