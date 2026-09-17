import { validateCertificateSigningReadiness } from '../../lib/certificate-signing-readiness'

const validResults = [
  {
    sensorId: 1,
    table: [
      {
        title: 'Hasil Kalibrasi',
        rows: [{ key: '27.78', unit: '0.00166', value: '0.5' }],
      },
    ],
  },
]

describe('certificate signing readiness', () => {
  it('accepts a certificate with public verification ID and result rows', () => {
    expect(
      validateCertificateSigningReadiness({
        public_id: 'public-id',
        results: validResults,
      }),
    ).toEqual({ ready: true })
  })

  it('rejects a certificate without public_id', () => {
    expect(
      validateCertificateSigningReadiness({ results: validResults }),
    ).toMatchObject({ ready: false, code: 'PUBLIC_ID_MISSING' })
  })

  it('rejects a certificate without calibration results', () => {
    expect(
      validateCertificateSigningReadiness({
        public_id: 'public-id',
        results: [],
      }),
    ).toMatchObject({ ready: false, code: 'CALIBRATION_RESULTS_MISSING' })
  })

  it('rejects a sensor with an empty table', () => {
    expect(
      validateCertificateSigningReadiness({
        public_id: 'public-id',
        results: [{ sensorId: 1, table: [] }],
      }),
    ).toMatchObject({ ready: false, code: 'CALIBRATION_TABLE_INCOMPLETE' })
  })

  it('rejects a table section without result rows', () => {
    expect(
      validateCertificateSigningReadiness({
        public_id: 'public-id',
        results: [{ sensorId: 1, table: [{ title: 'Hasil', rows: [] }] }],
      }),
    ).toMatchObject({ ready: false, code: 'CALIBRATION_TABLE_INCOMPLETE' })
  })
})
