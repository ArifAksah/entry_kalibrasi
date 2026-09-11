import { buildUutTrendSeries, filterTrendPoints } from '../../lib/dashboard/uut-trend'

describe('UUT calibration trend', () => {
  const instruments = [{ id: 10, name: 'Barometer AWOS', code: 'PP' }]
  const results = [{
    sensorId: 20,
    unitUut: 'inHg',
    sensorDetails: { name: 'Barometer' },
    table: [{ rows: [
      { key: '29.5', unit: '0.002', value: '0.0085', uncertaintyMeta: { raw_u95: 0.00847, reported_u95: 0.0085, cmc_value_output: 0.00077 } },
      { key: '30.0', unit: '0.004', value: '0.0091', uncertaintyMeta: { raw_u95: 0.009, reported_u95: 0.0091, cmc_value_output: 0.00077 } },
    ] }],
    environment: [], images: [], notesForm: { calibration_methode: '', reference_document: '', traceable_to_si_through: '', others: '', standardInstruments: [] },
  }]

  it('aggregates correction and uncertainty per certificate/sensor event', () => {
    const series = buildUutTrendSeries([{
      id: 1,
      no_certificate: 'SERT-001',
      instrument: 10,
      issue_date: '2026-01-15',
      results,
    }], instruments)

    expect(series).toHaveLength(1)
    expect(series[0].sensor_name).toBe('Barometer')
    expect(series[0].points[0]).toMatchObject({
      certificate_no: 'SERT-001',
      correction: 0.003,
      uncertainty: 0.0088,
      raw_uncertainty: 0.008735,
      cmc: 0.00077,
      unit: 'inHg',
    })
  })

  it('filters by rolling month period', () => {
    const points = [
      { certificate_id: 1, certificate_no: 'A', date: '2025-01-01', correction: 0, uncertainty: 1, raw_uncertainty: 1, cmc: null, unit: 'C' },
      { certificate_id: 2, certificate_no: 'B', date: '2026-06-01', correction: 0, uncertainty: 1, raw_uncertainty: 1, cmc: null, unit: 'C' },
    ]
    expect(filterTrendPoints(points, 6, new Date('2026-09-10'))).toHaveLength(1)
    expect(filterTrendPoints(points, null)).toHaveLength(2)
  })
})
