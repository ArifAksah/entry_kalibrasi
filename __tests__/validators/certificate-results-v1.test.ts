/**
 * Contract tests untuk kontrak data certificate.results V1.
 *
 * Test ini menjadi "safety net" untuk transisi A → B → C:
 *   - V1 schema: bentuk valid harus lolos, bentuk menyimpang harus gagal.
 *   - Legacy adapter: JSON V0 existing (contoh nyata dari user) harus
 *     terkonversi ke V1 yang valid tanpa kehilangan data inti.
 *   - Idempotent: V1 → convert → V1 sama persis.
 */

import {
  CertificateResultsV1Schema,
  RESULTS_SCHEMA_VERSION,
  isResultsV1Shape,
  parseResultsV1Safe,
  type CertificateResultsV1,
} from '../../lib/validators/certificate-results'

import {
  convertResultsLegacyToV1,
  tryConvertResultsLegacyToV1,
} from '../../lib/validators/certificate-results-legacy'

/** Sampel legacy V0 — diambil persis dari data produksi user. */
const LEGACY_V0_SAMPLE = [
  {
    place: 'Laboratorium Kalibrasi BMKG - Sensor T/RH 10m',
    table: [
      {
        rows: [
          { key: 'Range Pengukuran', unit: 'g', value: '89' },
          { key: 'Resolusi', unit: 'kg', value: 'd' },
          { key: 'Akurasi', unit: '%', value: '± 0.5' },
        ],
        title: 'Hasil Pengukuran',
      },
      {
        rows: [
          { key: 'Suhu', unit: '°C', value: '20 ± 2' },
          { key: 'Kelembaban', unit: '% RH', value: '45-75' },
        ],
        title: 'Kondisi Kalibrasi',
      },
    ],
    images: [
      { url: 'http://example.com/img.png', caption: '' },
    ],
    endDate: '',
    sensorId: 1,
    notesForm: {
      others: '',
      reference_document: '',
      calibration_methode: '', // NOTE: typo legacy
      standardInstruments: [],
      traceable_to_si_through: '',
    },
    startDate: '',
    environment: [],
    sensorDetails: {
      id: 1,
      name: 'Sensor T/RH 10m',
      type: 'DMA672.1',
      created_at: '2025-10-13T05:55:07.086049+00:00',
      graduating: 'd',
      funnel_area: 0,
      manufacturer: 'LSI Lastern',
      serial_number: 'S16107353',
      range_capacity: '89',
      volume_per_tip: '9',
      funnel_diameter: 0,
      graduating_unit: 'kg',
      funnel_area_unit: 'cm²',
      range_capacity_unit: 'g',
      volume_per_tip_unit: 'ml',
      funnel_diameter_unit: 'mm',
    },
  },
]

// ---------------------------------------------------------------------------
// Schema V1 — positive & negative
// ---------------------------------------------------------------------------

describe('CertificateResultsV1Schema — validasi positif', () => {
  it('menerima dokumen V1 minimal yang valid', () => {
    const doc: CertificateResultsV1 = {
      schema_version: RESULTS_SCHEMA_VERSION,
      calibration_kind: 'FC',
      sensors: [
        {
          links: { sensor_id: 1 },
          snapshot: { name: 'S1' } as any, // defaults akan mengisi sisanya
          setup: {} as any,
          display: { place: 'Lab A' } as any,
        },
      ],
    }
    const parsed = CertificateResultsV1Schema.parse(doc)
    expect(parsed.schema_version).toBe(1)
    expect(parsed.sensors[0].links.sensor_id).toBe(1)
  })
})

describe('CertificateResultsV1Schema — validasi negatif', () => {
  it('menolak schema_version selain 1', () => {
    const res = parseResultsV1Safe({
      schema_version: 2,
      calibration_kind: 'FC',
      sensors: [{ links: { sensor_id: 1 }, snapshot: { name: '' }, setup: {}, display: { place: '' } }],
    })
    expect(res.success).toBe(false)
  })

  it('menolak calibration_kind di luar FC/LC', () => {
    const res = parseResultsV1Safe({
      schema_version: 1,
      calibration_kind: 'XX',
      sensors: [{ links: { sensor_id: 1 }, snapshot: { name: '' }, setup: {}, display: { place: '' } }],
    })
    expect(res.success).toBe(false)
  })

  it('menolak sensors array kosong', () => {
    const res = parseResultsV1Safe({
      schema_version: 1,
      calibration_kind: 'FC',
      sensors: [],
    })
    expect(res.success).toBe(false)
  })

  it('menolak sensor tanpa sensor_id', () => {
    const res = parseResultsV1Safe({
      schema_version: 1,
      calibration_kind: 'FC',
      sensors: [{ links: {}, snapshot: { name: '' }, setup: {}, display: { place: '' } } as any],
    })
    expect(res.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Version discriminator
// ---------------------------------------------------------------------------

describe('isResultsV1Shape', () => {
  it('true untuk objek dengan schema_version === 1', () => {
    expect(isResultsV1Shape({ schema_version: 1 })).toBe(true)
  })
  it('false untuk array legacy', () => {
    expect(isResultsV1Shape(LEGACY_V0_SAMPLE)).toBe(false)
  })
  it('false untuk null / undefined / string', () => {
    expect(isResultsV1Shape(null)).toBe(false)
    expect(isResultsV1Shape(undefined)).toBe(false)
    expect(isResultsV1Shape('{}')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Legacy V0 → V1 converter — smoke test dengan data produksi
// ---------------------------------------------------------------------------

describe('convertResultsLegacyToV1 — data legacy user', () => {
  it('mengkonversi array V0 lengkap ke V1 yang valid', () => {
    const v1 = convertResultsLegacyToV1(LEGACY_V0_SAMPLE, { calibration_kind: 'FC' })

    expect(v1.schema_version).toBe(1)
    expect(v1.calibration_kind).toBe('FC')
    expect(v1.sensors).toHaveLength(1)

    const s = v1.sensors[0]
    // links
    expect(s.links.sensor_id).toBe(1)
    // snapshot — nilai dari sensorDetails ikut terbawa
    expect(s.snapshot.name).toBe('Sensor T/RH 10m')
    expect(s.snapshot.manufacturer).toBe('LSI Lastern')
    expect(s.snapshot.serial_number).toBe('S16107353')
    expect(s.snapshot.range_capacity).toBe('89')
    // setup — typo legacy `calibration_methode` tetap terbaca sebagai method
    expect(s.setup.calibration_method).toBe('')
    expect(s.setup.standard_instruments).toHaveLength(0)
    // display — tabel & gambar ikut
    expect(s.display.place).toContain('Laboratorium Kalibrasi BMKG')
    expect(s.display.tables).toHaveLength(2)
    expect(s.display.tables[0].title).toBe('Hasil Pengukuran')
    expect(s.display.tables[0].rows[0].key).toBe('Range Pengukuran')
    expect(s.display.images).toHaveLength(1)
    expect(s.display.images[0].url).toBe('http://example.com/img.png')
  })

  it('terima input string JSON (kasus ketika JSONB di-serialize)', () => {
    const jsonString = JSON.stringify(LEGACY_V0_SAMPLE)
    const v1 = convertResultsLegacyToV1(jsonString, { calibration_kind: 'LC' })
    expect(v1.calibration_kind).toBe('LC')
    expect(v1.sensors[0].snapshot.name).toBe('Sensor T/RH 10m')
  })

  it('membaca typo legacy `calibration_methode` → field `calibration_method`', () => {
    const legacyWithValue = [
      {
        ...LEGACY_V0_SAMPLE[0],
        notesForm: { ...LEGACY_V0_SAMPLE[0].notesForm, calibration_methode: 'IKK BMKG 2024' },
      },
    ]
    const v1 = convertResultsLegacyToV1(legacyWithValue, { calibration_kind: 'FC' })
    expect(v1.sensors[0].setup.calibration_method).toBe('IKK BMKG 2024')
  })
})

describe('convertResultsLegacyToV1 — idempoten', () => {
  it('V1 masuk → V1 keluar sama persis', () => {
    const v1First = convertResultsLegacyToV1(LEGACY_V0_SAMPLE, { calibration_kind: 'FC' })
    const v1Second = convertResultsLegacyToV1(v1First, { calibration_kind: 'FC' })
    expect(v1Second).toEqual(v1First)
  })
})

describe('convertResultsLegacyToV1 — error paths', () => {
  it('throw kalau sensor_id tidak ada sama sekali', () => {
    const broken = [{ ...LEGACY_V0_SAMPLE[0], sensorId: undefined, sensor_id: undefined }]
    expect(() => convertResultsLegacyToV1(broken, { calibration_kind: 'FC' })).toThrow(/sensor_id/)
  })

  it('throw kalau results kosong', () => {
    expect(() => convertResultsLegacyToV1([], { calibration_kind: 'FC' })).toThrow(/tidak ada/)
  })

  it('throw kalau string bukan JSON valid', () => {
    expect(() => convertResultsLegacyToV1('{not-json', { calibration_kind: 'FC' })).toThrow(/JSON/)
  })
})

// ---------------------------------------------------------------------------
// Safe wrapper — dipakai backfill & renderer
// ---------------------------------------------------------------------------

describe('tryConvertResultsLegacyToV1', () => {
  it('ok:true + wasLegacy:true untuk V0', () => {
    const r = tryConvertResultsLegacyToV1(LEGACY_V0_SAMPLE, { calibration_kind: 'FC' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.wasLegacy).toBe(true)
  })

  it('ok:true + wasLegacy:false untuk input yang sudah V1', () => {
    const v1 = convertResultsLegacyToV1(LEGACY_V0_SAMPLE, { calibration_kind: 'FC' })
    const r = tryConvertResultsLegacyToV1(v1, { calibration_kind: 'FC' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.wasLegacy).toBe(false)
  })

  it('ok:false dengan pesan deskriptif untuk data rusak', () => {
    const r = tryConvertResultsLegacyToV1('{broken', { calibration_kind: 'FC' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/JSON/)
  })
})
