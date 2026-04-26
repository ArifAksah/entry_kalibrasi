import React from 'react'
import { render, screen } from '../utils/test-utils'
import LHKSReport from '../../components/features/LHKSReport'
import { convertResultsLegacyToV1 } from '../../lib/validators/certificate-results-legacy'
import { resultsToLegacyView } from '../../lib/validators/certificate-results-render-adapter'

jest.mock('../../app/bmkg.png', () => ({
  __esModule: true,
  default: { src: '/bmkg.png' },
}))

jest.mock('../../lib/qc-utils', () => ({
  fetchQCLimitForSensor: jest.fn(async () => null),
  checkQCResult: jest.fn(() => ({ passed: true })),
}))

jest.mock('../../components/ui/SigFigBadge', () => ({
  SigFigBadge: () => <span data-testid="sigfig-badge" />,
}))

const LEGACY_RESULTS = [
  {
    sensorId: 42,
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    place: 'Lab Kalibrasi BMKG',
    startDate: '2026-04-25',
    endDate: '2026-04-25',
    table: [],
    images: [],
    environment: [{ key: 'Suhu', value: '24', unit: 'degC' }],
    notesForm: {
      calibration_methode: '',
      reference_document: '',
      traceable_to_si_through: '',
      others: '',
      standardInstruments: [],
    },
    sensorDetails: {
      id: 42,
      name: 'Sensor Suhu',
      manufacturer: 'Vaisala',
      type: 'TMP-01',
      serial_number: 'SNS-TMP-001',
      range_capacity: '-20 s/d 60',
      range_capacity_unit: 'degC',
      graduating: '0.1',
      graduating_unit: 'degC',
      funnel_diameter: null,
      funnel_diameter_unit: '',
      funnel_area: null,
      funnel_area_unit: '',
      volume_per_tip: null,
      volume_per_tip_unit: '',
    },
  },
]

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  certificate: {
    no_order: '001',
    no_certificate: 'SERT/001',
    results: null,
  },
  owner: {
    name: 'Stasiun Uji',
    address: 'Jl. Pengujian No.1',
  },
  instrument: {
    name: 'Automatic Weather Station',
    manufacturer: 'Vaisala',
    type: 'AWS-310',
    serial_number: 'AWS-SH-001',
  },
  sensors: [
    {
      id: 42,
      name: 'Sensor Suhu',
      type: 'TMP-01',
      manufacturer: 'Vaisala',
      serial_number: 'SNS-TMP-001',
      graduating: '0.1',
      graduating_unit: 'degC',
      range_capacity: '-20 s/d 60',
      range_capacity_unit: 'degC',
      is_standard: false,
    },
  ],
  rawData: [],
  standardCerts: [],
  calibrationDate: '2026-04-25',
  calibrationLocation: 'Lab Kalibrasi BMKG',
  environmentConditions: { temperature: '24', humidity: '70' },
}

describe('LHKSReport renderer smoke', () => {
  it('tetap render untuk payload legacy V0', () => {
    render(
      <LHKSReport
        {...(baseProps as any)}
        sessionResults={LEGACY_RESULTS}
      />
    )

    expect(screen.getByText('Preview LHKS')).toBeInTheDocument()
    expect(screen.getByText(/Automatic Weather Station/i)).toBeInTheDocument()
    expect(screen.getByText(/No\. Order/i)).toBeInTheDocument()
  })

  it('tetap render untuk payload V1 yang di-dual-read via adapter', () => {
    const v1 = convertResultsLegacyToV1(LEGACY_RESULTS, { calibration_kind: 'FC' })
    const adapted = resultsToLegacyView(v1)

    render(
      <LHKSReport
        {...(baseProps as any)}
        sessionResults={adapted}
      />
    )

    expect(screen.getByText('Preview LHKS')).toBeInTheDocument()
    expect(screen.getByText(/Automatic Weather Station/i)).toBeInTheDocument()
    expect(screen.getByText(/LAPORAN HASIL KALIBRASI SEMENTARA/i)).toBeInTheDocument()
  })
})
