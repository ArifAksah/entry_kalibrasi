import { convertResultsLegacyToV1 } from '../../lib/validators/certificate-results-legacy'
import { resultsToLegacyView } from '../../lib/validators/certificate-results-render-adapter'

describe('tipping bucket certificate results round-trip', () => {
  it('preserves flexible RR form input through Results V1', () => {
    const tippingBucket = {
      funnelDiameterReadings: [200.1, 200.2, 200.3],
      rainUutReadings: [6.1, 6.2, 6.3, 6.4],
      volumePerTip: 6.33,
      resolutionUut: 0.2,
      testVolume: 200,
      volumeCertificateU95: 0.2,
      volumeStandardDrift: 0.001,
      caliperCertificateU95: 0.0018,
      caliperDrift: 0.001,
      caliperResolution: 0.01,
      meniscusUncertainty: 0.19,
      cmcMm: 0.19,
      standards: [
        {
          role: 'volume',
          parameterCode: 'VL',
          certificateId: 101,
          sensorId: 20,
          instrumentId: 200,
          certificateNumber: 'CERT-GELAS-001',
          u95: 0.2,
          drift: 0.001,
          resolution: 0,
        },
        {
          role: 'length',
          parameterCode: 'LN',
          certificateId: 102,
          sensorId: 21,
          instrumentId: 201,
          certificateNumber: 'CERT-CALIPER-001',
          u95: 0.0018,
          drift: 0.001,
          resolution: 0.01,
        },
      ],
      cmcProfileId: 10,
      cmcProfileCode: 'CMC-RR-DIGITAL',
      cmcVersion: 1,
      cmcSourceDocument: 'Workbook CMC BMKG 2026',
    }
    const v1 = convertResultsLegacyToV1(
      [
        {
          sensorId: 10,
          startDate: '',
          endDate: '',
          place: 'Lapangan',
          environment: [],
          images: [],
          table: [
            {
              title: 'Hasil Kalibrasi',
              rows: [{ key: '6.2', unit: '2.9', value: '3.6' }],
            },
          ],
          notesForm: {
            calibration_methode: 'MK 06',
            reference_document: '',
            traceable_to_si_through: '',
            others: '',
            standardInstruments: [20, 21],
          },
          sensorDetails: { name: 'Tipping Bucket' },
          tippingBucket,
        },
      ],
      { calibration_kind: 'FC' },
    )

    expect(v1.sensors[0].setup.tipping_bucket?.rainUutReadings).toHaveLength(4)
    expect(v1.sensors[0].setup.standard_instruments).toHaveLength(2)
    expect(v1.sensors[0].setup.standard_instruments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          certificate_id: 101,
          sensor_id: 20,
          instrument_id: 200,
          certificate_no: 'CERT-GELAS-001',
        }),
        expect.objectContaining({
          certificate_id: 102,
          sensor_id: 21,
          instrument_id: 201,
          certificate_no: 'CERT-CALIPER-001',
        }),
      ]),
    )
    expect(resultsToLegacyView(v1)[0].tippingBucket).toEqual(tippingBucket)
  })

  it('preserves an operator-edited meniscus value through Results V1', () => {
    const tippingBucket = {
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
      meniscusUncertainty: 0.19,
      cmcMm: 0.21,
      methodVersion: 'RR-LEGACY-V1' as const,
      formulaVersion: 1 as const,
    }
    const v1 = convertResultsLegacyToV1(
      [
        {
          sensorId: 10,
          startDate: '',
          endDate: '',
          place: 'Lapangan',
          environment: [],
          images: [],
          table: [],
          notesForm: {
            calibration_methode: 'MK 06',
            reference_document: '',
            traceable_to_si_through: '',
            others: '',
            standardInstruments: [],
          },
          sensorDetails: { name: 'Tipping Bucket' },
          tippingBucket,
        },
      ],
      { calibration_kind: 'FC' },
    )

    expect(resultsToLegacyView(v1)[0].tippingBucket?.meniscusUncertainty).toBe(0.19)
  })
})
