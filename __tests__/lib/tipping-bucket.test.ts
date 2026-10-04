import {
  aggregateStandardRoles,
  calculateTippingBucket,
  isRainGaugeSensor,
  isTippingBucketSensor,
  roleFromParameterCode,
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

    // Budget ketidakpastian harus identik dengan workbook (sheet Hit_RR).
    expect(result.combinedUncertaintyMm).toBeCloseTo(0.05189489648, 8)
    expect(result.effectiveDegreesOfFreedom).toBeCloseTo(2.03981096, 6)
    // Coverage factor = Excel TINV(0.05, veff) = t(0.975, 2) eksak, bukan 4.303.
    expect(result.coverageFactor).toBeCloseTo(4.30265273, 6)
    expect(result.rawU95Mm).toBeCloseTo(0.223285718, 6)
    expect(result.reportedU95Mm).toBeCloseTo(0.223285718, 6)
    expect(result.reportedU95Percent).toBeCloseTo(3.640528011, 6)
    expect(result.methodVersion).toBe('RR-LEGACY-V1')
    expect(result.formulaVersion).toBe(1)
    expect(result.coverageRule).toBe('STUDENT_T_95_EFFECTIVE_DOF')
    expect(result.warnings).toEqual([])
  })

  it('keeps the RR legacy result deterministic when old divisors differ', () => {
    const base = {
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
    }
    const result = calculateTippingBucket({
      ...base,
      methodVersion: 'RR-LEGACY-V1',
      repeatabilityDivisor: 1,
      diameterDivisor: 1,
    })
    expect(result.rawU95Mm).toBeCloseTo(0.223285718, 6)
    expect(result.warnings).toEqual([
      'Pembagi repeatability lama diabaikan; RR memakai pembagi workbook sqrt(5).',
      'Pembagi diameter lama diabaikan; RR memakai pembagi workbook sqrt(5).',
    ])
  })

  it('matches workbook uncertainty components for caliper and rain simulation', () => {
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
      methodVersion: 'RR-LEGACY-V1',
    })
    const caliper = result.components.find(
      (component) => component.name === 'Pengukuran Jangka Sorong',
    )
    const repeatability = result.components.find(
      (component) => component.name === 'Repeatibilitas',
    )

    expect(result.standardRainfall).toBeCloseTo(6.314439976, 8)
    expect(result.correctionStandardDeviation).toBeCloseTo(0.1154700538, 8)
    expect(caliper?.uOrA).toBeCloseTo(0.4333878171, 8)
    expect(caliper?.divisor).toBeCloseTo(Math.sqrt(5), 12)
    expect(caliper?.degreesOfFreedom).toBe(3)
    expect(repeatability?.uOrA).toBeCloseTo(0.1154700538, 8)
    expect(repeatability?.divisor).toBeCloseTo(Math.sqrt(5), 12)
    expect(result.rawU95Mm).toBeCloseTo(0.223285718, 6)
  })

  it('preserves the operator meniscus value during recalculation', () => {
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
      meniscusUncertainty: 0.019,
      cmcMm: 0.21,
      methodVersion: 'RR-LEGACY-V1',
    })

    expect(result.rawU95Mm).toBeCloseTo(0.222765983, 6)
  })

  it('explains when CMC replaces a smaller calculated uncertainty', () => {
    const result = calculateTippingBucket({
      funnelDiameterReadings: [201.2, 200.55, 200.93, 200.21],
      rainUutReadings: [6.2, 6.2, 6.2],
      volumePerTip: 6.334686868744455,
      resolutionUut: 0.2,
      testVolume: 200,
      volumeCertificateU95: 0.2,
      volumeStandardDrift: 0,
      caliperCertificateU95: 0.0018,
      caliperDrift: 0.001,
      caliperResolution: 0.01,
      meniscusUncertainty: 0.19,
      cmcMm: 0.19,
      methodVersion: 'RR-LEGACY-V1',
    })

    expect(result.correctionStandardDeviation).toBe(0)
    expect(result.cmcApplied).toBe(true)
    expect(result.reportedU95Mm).toBe(0.19)
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Repeatibilitas bernilai 0 karena seluruh pembacaan hujan menghasilkan nilai yang sama.',
        'Drift gelas ukur bernilai 0 dari data standar yang tersimpan.',
      ]),
    )
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

  it('isRainGaugeSensor wraps sensor + instrument code', () => {
    expect(
      isRainGaugeSensor({ name: 'Sensor XYZ' }, 'RR', null, null),
    ).toBe(true)
    expect(
      isRainGaugeSensor({ name: 'Curah Hujan' }, 'AWS', null, null),
    ).toBe(true)
    expect(
      isRainGaugeSensor({ name: 'Kecepatan Angin' }, 'AWS', null, 'MK 06'),
    ).toBe(true)
    expect(
      isRainGaugeSensor({ name: 'Thermometer' }, 'TT', null, 'MK 01'),
    ).toBe(false)
    expect(isRainGaugeSensor(null, 'TT', null, null)).toBe(false)
  })

  it('roleFromParameterCode maps Master CMC codes VL/LN', () => {
    expect(roleFromParameterCode('VL')).toBe('volume')
    expect(roleFromParameterCode('LN')).toBe('length')
    expect(roleFromParameterCode('vl')).toBe('volume')
    expect(roleFromParameterCode('ln')).toBe('length')
    // Katalog instrument_code memakai 'VN' untuk Volume (alias diterima).
    expect(roleFromParameterCode('VN')).toBe('volume')
    expect(roleFromParameterCode('tt')).toBeNull()
    expect(roleFromParameterCode('TT')).toBeNull()
    expect(roleFromParameterCode('RR')).toBeNull()
    expect(roleFromParameterCode(null)).toBeNull()
  })

  it('aggregateStandardRoles takes MAX per role', () => {
    const aggregated = aggregateStandardRoles([
      { role: 'volume', u95: 0.2, drift: 0.001, resolution: 0 },
      { role: 'volume', u95: 0.3, drift: 0.0005, resolution: 0 },
      { role: 'length', u95: 0.0018, drift: 0.001, resolution: 0.01 },
      { role: 'length', u95: 0.0009, drift: 0.002, resolution: 0.02 },
    ])
    expect(aggregated.volumeCertificateU95).toBeCloseTo(0.3, 10)
    expect(aggregated.volumeStandardDrift).toBeCloseTo(0.001, 10)
    expect(aggregated.caliperCertificateU95).toBeCloseTo(0.0018, 10)
    expect(aggregated.caliperDrift).toBeCloseTo(0.002, 10)
    expect(aggregated.caliperResolution).toBeCloseTo(0.02, 10)
  })

  it('calculates RR budget from dynamic standards[] identically to flat slots', () => {
    const base = {
      funnelDiameterReadings: [201.2, 200.55, 200.93, 200.21],
      rainUutReadings: [6.2, 6.2, 6.0],
      volumePerTip: 6.334686868744455,
      resolutionUut: 0.2,
      testVolume: 200,
      meniscusUncertainty: 0.1946279481,
      cmcMm: 0.21,
    }
    const viaStandards = calculateTippingBucket({
      ...base,
      volumeCertificateU95: 0,
      volumeStandardDrift: 0,
      caliperCertificateU95: 0,
      caliperDrift: 0,
      caliperResolution: 0,
      standards: [
        { role: 'volume', u95: 0.2, drift: 0.001, resolution: 0 },
        { role: 'length', u95: 0.0018, drift: 0.001, resolution: 0.01 },
      ],
    })
    const viaFlat = calculateTippingBucket({
      ...base,
      volumeCertificateU95: 0.2,
      volumeStandardDrift: 0.001,
      caliperCertificateU95: 0.0018,
      caliperDrift: 0.001,
      caliperResolution: 0.01,
    })

    // Standar dinamis harus menghasilkan angka yang sama persis dengan flat.
    expect(viaStandards.combinedUncertaintyMm).toBeCloseTo(
      viaFlat.combinedUncertaintyMm,
      12,
    )
    expect(viaStandards.reportedU95Mm).toBeCloseTo(viaFlat.reportedU95Mm, 12)
    expect(viaStandards.reportedU95Percent).toBeCloseTo(
      viaFlat.reportedU95Percent,
      12,
    )
    // Nilai utama workbook (tanpa bergantung faktor cakupan).
    expect(viaStandards.standardRainfall).toBeCloseTo(6.314439976, 8)
    expect(viaStandards.averageUut).toBeCloseTo(6.133333333, 8)
    expect(viaStandards.averageCorrectionPercent).toBeCloseTo(2.977426133, 8)
  })
})
