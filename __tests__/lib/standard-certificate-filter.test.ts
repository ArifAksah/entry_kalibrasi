import {
  filterStandardCertificates,
  findInvalidStandardSelection,
  isStandardCertificateSelectionValid,
} from '../../lib/standard-certificate-filter'

const instruments = [
  { id: 1, sensor: [{ id: 10 }, { id: 11 }] },
  { id: 2, sensor: [{ id: 20 }] },
] as any

const certificates = [
  { id: 101, sensor_id: 10, no_certificate: 'STD-001' },
  { id: 102, sensor_id: 11, no_certificate: 'STD-002' },
  { id: 201, sensor_id: 20, no_certificate: 'STD-001' },
] as any

describe('standard certificate filtering', () => {
  it('does not include another instrument when certificate numbers are equal', () => {
    expect(
      filterStandardCertificates(certificates, instruments, 1, 'STD-001').map(
        (certificate) => certificate.id,
      ),
    ).toEqual([101])
  })

  it('normalizes numeric IDs and certificate whitespace', () => {
    expect(
      filterStandardCertificates(certificates, instruments, '1', ' STD-002 '),
    ).toHaveLength(1)
  })

  it('rejects a certificate row owned by another instrument', () => {
    expect(
      isStandardCertificateSelectionValid(
        certificates,
        instruments,
        1,
        'STD-001',
        201,
      ),
    ).toBe(false)
  })

  it('detects a raw-data certificate and sensor mismatch', () => {
    const invalidSheet = findInvalidStandardSelection(
      [
        {
          name: 'Sheet 1',
          standard_certificate_id: 101,
          sensor_id_std: 20,
        },
      ],
      [{ id: 101, sensor_id: 10 }],
    )

    expect(invalidSheet?.name).toBe('Sheet 1')
  })

  it('accepts a raw-data certificate linked to the selected sensor', () => {
    expect(
      findInvalidStandardSelection(
        [
          {
            name: 'Sheet 1',
            standard_certificate_id: '101',
            sensor_id_std: '10',
          },
        ],
        [{ id: 101, sensor_id: 10 }],
      ),
    ).toBeUndefined()
  })
})
