import {
  calculateTippingBucket,
  isTippingBucketSensor,
} from '../../lib/tipping-bucket'

describe('tipping bucket calibration', () => {
  it('reproduces the flexible workbook calculation', () => {
    const result = calculateTippingBucket({
      funnelDiameterReadings: [201.2, 200.55, 200.93, 200.21],
      rainUutReadings: [6.2, 6.2, 6.0],
      volumePerTip: 6.334686868744455,
      resolutionUut: 0.2,
      testVolume: 200,
      volumeCertificateU95: 0.2,
      volumeStandardDrift: 0.001,
      caliperCertificateU95: 0.0018,
      caliperDrift: 0.001,
      caliperResolution: 0.01,
      meniscusUncertainty: 0.1946279481,
      cmcMm: 0.21,
    })

    expect(result.averageFunnelDiameter).toBeCloseTo(200.7225, 8)
    expect(result.standardRainfall).toBeCloseTo(6.314439976, 8)
    expect(result.averageUut).toBeCloseTo(6.133333333, 8)
    expect(result.averageCorrectionPercent).toBeCloseTo(2.977426133, 8)
    expect(result.rows).toHaveLength(3)
    expect(result.reportedU95Percent).toBeGreaterThan(0)
  })

  it('accepts a dynamic number of diameter and rain readings', () => {
    const result = calculateTippingBucket({
      funnelDiameterReadings: [200, 201],
      rainUutReadings: [6.1, 6.2, 6.3, 6.4, 6.5],
      volumePerTip: 6.3,
      resolutionUut: 0.2,
      testVolume: 200,
      volumeCertificateU95: 0.2,
      volumeStandardDrift: 0.001,
      caliperCertificateU95: 0.002,
      caliperDrift: 0.001,
      caliperResolution: 0.01,
      meniscusUncertainty: 0.19,
      cmcMm: 0.19,
    })

    expect(result.rows).toHaveLength(5)
    expect(result.components).toHaveLength(8)
    expect(Number.isFinite(result.reportedU95Percent)).toBe(true)
  })

  it('detects RR without classifying unrelated sensors', () => {
    expect(isTippingBucketSensor({ name: 'Tipping Bucket' })).toBe(true)
    expect(isTippingBucketSensor({ name: 'Penakar Hujan' })).toBe(true)
    expect(isTippingBucketSensor({ name: 'Thermometer' }, null, 'MK 01')).toBe(false)
  })
})
