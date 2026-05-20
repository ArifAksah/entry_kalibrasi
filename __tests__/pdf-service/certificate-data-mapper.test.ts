/**
 * Unit tests for the Certificate Data Mapper module.
 *
 * Tests mapping of database certificate fields to template variable names,
 * null handling, and sensor/results array mapping.
 *
 * @see Requirements 8.2, 8.3
 */

import {
  mapCertificateToTemplateData,
  type TemplateData,
} from '../../lib/pdf-service/certificate-data-mapper'

// ─── Full mapping test ───────────────────────────────────────────────────────

describe('mapCertificateToTemplateData', () => {
  it('should map all fields from a complete certificate record', () => {
    const certificate = {
      certificate_number: 'LK.01.01/2024/001',
      order_number: 'ORD-2024-001',
      calibration_date: '2024-01-15',
      issue_date: '2024-01-20',
      received_date: '2024-01-10',
      calibration_method: 'Perbandingan langsung',
      temperature: '23.5',
      humidity: '55',
      calibration_place: 'Laboratorium',
      standard_used: 'Barometer Standar Vaisala PTB330',
      traceability: 'BMKG → KAN → SI',
      reference_document: 'IK-KAL-001',
      notes: 'Catatan tambahan',
      owner_name: 'PT ABC',
      signer_name: 'Dr. Budi',
      signer_nip: '198001012005011001',
      signer_position: 'Kepala Laboratorium',
      technician_name: 'Andi',
      technician_nip: '199001012010011001',
      verifier_name: 'Siti',
      instrument: {
        name: 'Barometer Digital',
        brand: 'Vaisala',
        type: 'PTB330',
        serial_number: 'S1234567',
        capacity: '500-1100 hPa',
        resolution: '0.1 hPa',
        unit: 'hPa',
      },
      station: {
        name: 'Stasiun Klimatologi Bogor',
        address: 'Jl. Raya Darmaga, Bogor',
      },
      sensors: [
        {
          name: 'Sensor Tekanan',
          results: [
            { measurement_point: '900', reading: '900.1', correction: '0.1', uncertainty: '0.05' },
            { measurement_point: '1000', reading: '1000.2', correction: '0.2', uncertainty: '0.06' },
          ],
        },
        {
          name: 'Sensor Suhu',
          results: [
            { measurement_point: '20', reading: '20.1', correction: '0.1', uncertainty: '0.02' },
          ],
        },
      ],
    }

    const result = mapCertificateToTemplateData(certificate)

    // Instrument data
    expect(result.nama_alat).toBe('Barometer Digital')
    expect(result.merk).toBe('Vaisala')
    expect(result.tipe).toBe('PTB330')
    expect(result.no_seri).toBe('S1234567')
    expect(result.kapasitas).toBe('500-1100 hPa')
    expect(result.resolusi).toBe('0.1 hPa')
    expect(result.unit).toBe('hPa')

    // Certificate data
    expect(result.nomor_sertifikat).toBe('LK.01.01/2024/001')
    expect(result.no_order).toBe('ORD-2024-001')
    expect(result.tanggal_kalibrasi).toBe('2024-01-15')
    expect(result.tanggal_terbit).toBe('2024-01-20')
    expect(result.tanggal_masuk).toBe('2024-01-10')
    expect(result.metode_kalibrasi).toBe('Perbandingan langsung')
    expect(result.suhu).toBe('23.5')
    expect(result.kelembaban).toBe('55')
    expect(result.tempat_kalibrasi).toBe('Laboratorium')
    expect(result.standar_kalibrasi).toBe('Barometer Standar Vaisala PTB330')
    expect(result.ketertelusuran).toBe('BMKG → KAN → SI')
    expect(result.dokumen_acuan).toBe('IK-KAL-001')
    expect(result.catatan).toBe('Catatan tambahan')

    // Station/owner data
    expect(result.nama_stasiun).toBe('Stasiun Klimatologi Bogor')
    expect(result.alamat_stasiun).toBe('Jl. Raya Darmaga, Bogor')
    expect(result.nama_pemilik).toBe('PT ABC')

    // Personnel data
    expect(result.nama_penandatangan).toBe('Dr. Budi')
    expect(result.nip_penandatangan).toBe('198001012005011001')
    expect(result.jabatan_penandatangan).toBe('Kepala Laboratorium')
    expect(result.nama_teknisi).toBe('Andi')
    expect(result.nip_teknisi).toBe('199001012010011001')
    expect(result.nama_verifikator).toBe('Siti')

    // Sensors
    expect(result.sensors).toHaveLength(2)
    expect(result.sensors[0].sensor_nama).toBe('Sensor Tekanan')
    expect(result.sensors[0].hasil_kalibrasi).toHaveLength(2)
    expect(result.sensors[0].hasil_kalibrasi[0]).toEqual({
      titik_ukur: '900',
      pembacaan: '900.1',
      koreksi: '0.1',
      ketidakpastian: '0.05',
    })
    expect(result.sensors[1].sensor_nama).toBe('Sensor Suhu')
    expect(result.sensors[1].hasil_kalibrasi).toHaveLength(1)
  })

  // ─── Null/undefined handling ─────────────────────────────────────────────

  it('should convert null values to empty strings', () => {
    const certificate = {
      certificate_number: null,
      order_number: null,
      calibration_date: null,
      issue_date: null,
      received_date: null,
      calibration_method: null,
      temperature: null,
      humidity: null,
      calibration_place: null,
      standard_used: null,
      traceability: null,
      reference_document: null,
      notes: null,
      owner_name: null,
      signer_name: null,
      signer_nip: null,
      signer_position: null,
      technician_name: null,
      technician_nip: null,
      verifier_name: null,
      instrument: {
        name: null,
        brand: null,
        type: null,
        serial_number: null,
        capacity: null,
        resolution: null,
        unit: null,
      },
      station: {
        name: null,
        address: null,
      },
      sensors: [],
    }

    const result = mapCertificateToTemplateData(certificate)

    // All string fields should be empty string
    expect(result.nama_alat).toBe('')
    expect(result.merk).toBe('')
    expect(result.tipe).toBe('')
    expect(result.no_seri).toBe('')
    expect(result.kapasitas).toBe('')
    expect(result.resolusi).toBe('')
    expect(result.unit).toBe('')
    expect(result.nomor_sertifikat).toBe('')
    expect(result.no_order).toBe('')
    expect(result.tanggal_kalibrasi).toBe('')
    expect(result.tanggal_terbit).toBe('')
    expect(result.tanggal_masuk).toBe('')
    expect(result.metode_kalibrasi).toBe('')
    expect(result.suhu).toBe('')
    expect(result.kelembaban).toBe('')
    expect(result.tempat_kalibrasi).toBe('')
    expect(result.standar_kalibrasi).toBe('')
    expect(result.ketertelusuran).toBe('')
    expect(result.dokumen_acuan).toBe('')
    expect(result.catatan).toBe('')
    expect(result.nama_stasiun).toBe('')
    expect(result.alamat_stasiun).toBe('')
    expect(result.nama_pemilik).toBe('')
    expect(result.nama_penandatangan).toBe('')
    expect(result.nip_penandatangan).toBe('')
    expect(result.jabatan_penandatangan).toBe('')
    expect(result.nama_teknisi).toBe('')
    expect(result.nip_teknisi).toBe('')
    expect(result.nama_verifikator).toBe('')
    expect(result.sensors).toEqual([])
  })

  it('should handle undefined values the same as null', () => {
    const certificate = {
      certificate_number: undefined,
      instrument: { name: undefined },
      station: { name: undefined },
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.nomor_sertifikat).toBe('')
    expect(result.nama_alat).toBe('')
    expect(result.nama_stasiun).toBe('')
  })

  it('should handle completely empty/null certificate object', () => {
    const result = mapCertificateToTemplateData(null)

    expect(result.nama_alat).toBe('')
    expect(result.nomor_sertifikat).toBe('')
    expect(result.nama_stasiun).toBe('')
    expect(result.sensors).toEqual([])
  })

  it('should handle undefined certificate', () => {
    const result = mapCertificateToTemplateData(undefined)

    expect(result.nama_alat).toBe('')
    expect(result.sensors).toEqual([])
  })

  it('should handle certificate with missing nested objects', () => {
    const certificate = {
      certificate_number: 'TEST-001',
      // No instrument, station, or sensors
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.nomor_sertifikat).toBe('TEST-001')
    expect(result.nama_alat).toBe('')
    expect(result.nama_stasiun).toBe('')
    expect(result.sensors).toEqual([])
  })

  // ─── Sensor mapping ──────────────────────────────────────────────────────

  it('should handle sensors with null results', () => {
    const certificate = {
      sensors: [
        { name: 'Sensor A', results: null },
        { name: null, results: [] },
      ],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors).toHaveLength(2)
    expect(result.sensors[0].sensor_nama).toBe('Sensor A')
    expect(result.sensors[0].hasil_kalibrasi).toEqual([])
    expect(result.sensors[1].sensor_nama).toBe('')
    expect(result.sensors[1].hasil_kalibrasi).toEqual([])
  })

  it('should handle sensor results with null fields', () => {
    const certificate = {
      sensors: [
        {
          name: 'Sensor',
          results: [
            { measurement_point: null, reading: null, correction: null, uncertainty: null },
          ],
        },
      ],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors[0].hasil_kalibrasi[0]).toEqual({
      titik_ukur: '',
      pembacaan: '',
      koreksi: '',
      ketidakpastian: '',
    })
  })

  it('should handle non-array sensors field gracefully', () => {
    const certificate = {
      sensors: 'not an array',
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors).toEqual([])
  })

  // ─── Type coercion ───────────────────────────────────────────────────────

  it('should convert numeric values to strings', () => {
    const certificate = {
      temperature: 23.5,
      humidity: 55,
      instrument: { capacity: 1100 },
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.suhu).toBe('23.5')
    expect(result.kelembaban).toBe('55')
    expect(result.kapasitas).toBe('1100')
  })
})
