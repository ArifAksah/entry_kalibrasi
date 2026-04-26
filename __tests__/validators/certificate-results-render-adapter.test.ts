/**
 * Contract tests untuk render adapter V1 → V0-view.
 *
 * Pentingnya test ini: renderer TIDAK BOLEH tahu tentang V1. Semua data
 * masuk via resultsToLegacyView() dan keluar jadi V0-shape. Regresi di
 * sini = regresi visual di PDF/LHKS/draft-view.
 */

import {
  resultsToLegacyView,
  firstLegacyResult,
} from '../../lib/validators/certificate-results-render-adapter'
import { convertResultsLegacyToV1 } from '../../lib/validators/certificate-results-legacy'
import type { CertificateResultsV1 } from '../../lib/validators/certificate-results'

// Sampel V0 lengkap (superset field yang dipakai renderer)
const V0_FULL = [
  {
    place: 'Lab A - Sensor X',
    sensorId: 7,
    session_id: '11111111-1111-4111-8111-111111111111',
    table: [
      {
        title: 'Hasil Pengukuran',
        rows: [{ key: 'Range', unit: 'g', value: '100' }],
      },
    ],
    images: [{ url: 'http://ex.com/a.png', caption: 'foo' }],
    environment: [{ key: 'Suhu', value: '25', unit: '°C' }],
    startDate: '2025-01-01',
    endDate: '2025-01-02',
    notesForm: {
      calibration_methode: 'IKK 2024',
      reference_document: 'doc-123',
      traceable_to_si_through: 'KIM-LIPI',
      others: 'Catatan tambahan',
      others_enabled: true,
      standardInstruments: [10, 20, 30],
    },
    sensorDetails: {
      id: 7,
      name: 'Sensor X',
      manufacturer: 'ACME',
      type: 'T-1000',
      serial_number: 'SN-XYZ',
      range_capacity: '100',
      range_capacity_unit: 'kg',
      graduating: '0.1',
      graduating_unit: 'kg',
      funnel_diameter: 203,
      funnel_diameter_unit: 'mm',
      funnel_area: 0,
      funnel_area_unit: 'cm²',
      volume_per_tip: '0.5',
      volume_per_tip_unit: 'ml',
    },
  },
]

// ---------------------------------------------------------------------------
// Input null / string / array
// ---------------------------------------------------------------------------

describe('resultsToLegacyView — input edge cases', () => {
  it('null/undefined → []', () => {
    expect(resultsToLegacyView(null)).toEqual([])
    expect(resultsToLegacyView(undefined)).toEqual([])
  })

  it('string JSON valid → parsed & returned sebagai V0 array', () => {
    const out = resultsToLegacyView(JSON.stringify(V0_FULL))
    expect(out).toHaveLength(1)
    expect((out[0] as any).sensorId).toBe(7)
  })

  it('string JSON rusak → [] + console.warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resultsToLegacyView('{not-json')).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('array V0 → passthrough', () => {
    const out = resultsToLegacyView(V0_FULL)
    expect(out).toEqual(V0_FULL)
  })

  it('shape aneh (objek non-V1) → [] + warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resultsToLegacyView({ random: 'blob' })).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Roundtrip V0 → V1 → V0 — inti safety net
// ---------------------------------------------------------------------------

describe('roundtrip V0 → V1 → V0 via adapter', () => {
  it('semua field renderer tetap terbaca setelah roundtrip', () => {
    const v1 = convertResultsLegacyToV1(V0_FULL, { calibration_kind: 'FC' })
    const v0back = resultsToLegacyView(v1)

    expect(v0back).toHaveLength(1)
    const e = v0back[0]

    // links / ids
    expect(e.sensorId).toBe(7)
    expect(e.session_id).toBe('11111111-1111-4111-8111-111111111111')

    // display
    expect(e.place).toBe('Lab A - Sensor X')
    expect(e.table).toHaveLength(1)
    expect(e.table[0].title).toBe('Hasil Pengukuran')
    expect(e.table[0].rows[0].value).toBe('100')
    expect(e.images[0].url).toBe('http://ex.com/a.png')

    // setup
    expect(e.startDate).toBe('2025-01-01')
    expect(e.endDate).toBe('2025-01-02')
    expect(e.environment[0].key).toBe('Suhu')
    expect(e.notesForm.calibration_methode).toBe('IKK 2024')
    expect(e.notesForm.reference_document).toBe('doc-123')
    expect(e.notesForm.traceable_to_si_through).toBe('KIM-LIPI')
    expect(e.notesForm.others).toBe('Catatan tambahan')
    expect(e.notesForm.others_enabled).toBe(true)
    expect(e.notesForm.standardInstruments).toEqual([10, 20, 30])

    // sensorDetails
    expect(e.sensorDetails.name).toBe('Sensor X')
    expect(e.sensorDetails.manufacturer).toBe('ACME')
    expect(e.sensorDetails.serial_number).toBe('SN-XYZ')
    expect(e.sensorDetails.funnel_diameter).toBe(203)
    expect(e.sensorDetails.funnel_area).toBe(0)
  })

  it('others_enabled undefined di V0 → tetap undefined di V0 hasil roundtrip', () => {
    const v0NoEnabled = [
      {
        ...V0_FULL[0],
        notesForm: { ...V0_FULL[0].notesForm, others_enabled: undefined } as any,
      },
    ]
    delete (v0NoEnabled[0].notesForm as any).others_enabled

    const v1 = convertResultsLegacyToV1(v0NoEnabled, { calibration_kind: 'FC' })
    const v0back = resultsToLegacyView(v1)
    expect(v0back[0].notesForm.others_enabled).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// V1 input langsung
// ---------------------------------------------------------------------------

describe('resultsToLegacyView — input V1 langsung', () => {
  it('V1 valid → konversi ke V0-view', () => {
    const v1: CertificateResultsV1 = {
      schema_version: 1,
      calibration_kind: 'LC',
      sensors: [
        {
          links: { sensor_id: 99 },
          snapshot: {
            name: 'Direct V1',
            manufacturer: '',
            type: '',
            serial_number: '',
            range_capacity: '',
            range_capacity_unit: '',
            graduating: '',
            graduating_unit: '',
            funnel_diameter_unit: '',
            volume_per_tip_unit: '',
            funnel_area_unit: '',
          },
          setup: {
            calibration_method: '',
            reference_document: '',
            traceable_to_si_through: '',
            others: '',
            start_date: '',
            end_date: '',
            environment: [],
            standard_instruments: [],
          },
          display: { place: 'Lab V1', tables: [], images: [] },
        },
      ],
    }
    const out = resultsToLegacyView(v1)
    expect(out).toHaveLength(1)
    expect(out[0].sensorId).toBe(99)
    expect(out[0].place).toBe('Lab V1')
    expect(out[0].notesForm.standardInstruments).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// firstLegacyResult convenience
// ---------------------------------------------------------------------------

describe('firstLegacyResult', () => {
  it('kembalikan entry pertama', () => {
    const e = firstLegacyResult(V0_FULL)
    expect(e).not.toBeNull()
    expect(e!.sensorId).toBe(7)
  })

  it('null kalau kosong', () => {
    expect(firstLegacyResult(null)).toBeNull()
    expect(firstLegacyResult([])).toBeNull()
  })
})
