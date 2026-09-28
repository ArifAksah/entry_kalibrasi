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
    expect(resultsToLegacyView(v1)[0].tippingBucket).toEqual(tippingBucket)
  })
})
