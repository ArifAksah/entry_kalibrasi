/**
 * Test untuk write-side normalizer yang dipakai di API POST/PUT.
 * Fokus: tolerant mode behavior + error surfacing + idempotency.
 *
 * Strict mode tidak dites di sini karena dikontrol via env var yang dibaca
 * saat modul di-load (cold start). Untuk tes strict, pakai jest.isolateModules
 * + set env sebelum require — ditambahkan nanti ketika strict siap di-flip.
 */

import {
  normalizeResultsOnWrite,
  ResultsValidationError,
  getResultsValidationMode,
} from '../../lib/validators/certificate-results-normalize'

const LEGACY_MINIMAL = [
  {
    place: 'Lab A',
    sensorId: 42,
    sensorDetails: { name: 'Sensor T/RH' },
    notesForm: {},
    table: [],
    images: [],
    environment: [],
  },
]

describe('getResultsValidationMode', () => {
  it('default-nya tolerant', () => {
    // Env RESULTS_VALIDATION_STRICT tidak di-set di test env → tolerant
    expect(getResultsValidationMode()).toBe('tolerant')
  })
})

describe('normalizeResultsOnWrite — not provided', () => {
  it.each([null, undefined])('null/undefined → kind: not_provided', (val) => {
    const out = normalizeResultsOnWrite(val, { calibration_kind: 'FC' })
    expect(out.kind).toBe('not_provided')
  })
})

describe('normalizeResultsOnWrite — tolerant mode', () => {
  it('V0 legacy auto-convert ke V1', () => {
    const out = normalizeResultsOnWrite(LEGACY_MINIMAL, { calibration_kind: 'FC' })
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') {
      expect(out.wasLegacy).toBe(true)
      expect(out.value.schema_version).toBe(1)
      expect(out.value.calibration_kind).toBe('FC')
      expect(out.value.sensors[0].links.sensor_id).toBe(42)
    }
  })

  it('input sudah V1 → passthrough tanpa convert', () => {
    const first = normalizeResultsOnWrite(LEGACY_MINIMAL, { calibration_kind: 'FC' })
    if (first.kind !== 'ok') throw new Error('precondition gagal')

    const second = normalizeResultsOnWrite(first.value, { calibration_kind: 'FC' })
    expect(second.kind).toBe('ok')
    if (second.kind === 'ok') {
      expect(second.wasLegacy).toBe(false)
      expect(second.value).toEqual(first.value)
    }
  })

  it('terima string JSON (kasus ketika body ter-serialize)', () => {
    const str = JSON.stringify(LEGACY_MINIMAL)
    const out = normalizeResultsOnWrite(str, { calibration_kind: 'LC' })
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') expect(out.value.calibration_kind).toBe('LC')
  })

  it('throw ResultsValidationError dengan status 400 untuk JSON rusak', () => {
    expect(() =>
      normalizeResultsOnWrite('{not-json', { calibration_kind: 'FC' })
    ).toThrow(ResultsValidationError)

    try {
      normalizeResultsOnWrite('{not-json', { calibration_kind: 'FC' })
    } catch (e) {
      expect(e).toBeInstanceOf(ResultsValidationError)
      if (e instanceof ResultsValidationError) {
        expect(e.status).toBe(400)
      }
    }
  })

  it('throw ResultsValidationError untuk payload tanpa sensor_id', () => {
    const broken = [{ place: 'x', sensorDetails: { name: 'y' } }]
    expect(() =>
      normalizeResultsOnWrite(broken, { calibration_kind: 'FC' })
    ).toThrow(ResultsValidationError)
  })
})
