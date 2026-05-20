/**
 * Unit tests for the Template Data Mapper module.
 *
 * Tests mapping of database certificate fields to template variable names,
 * null handling, sensor/results array mapping, and system fields.
 *
 * @see Requirements 8.2, 8.3
 */

import { mapCertificateToTemplateData } from '../../lib/pdf-service/template-data-mapper'

describe('mapCertificateToTemplateData (template-data-mapper)', () => {
  // ─── Full mapping test ─────────────────────────────────────────────────────

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
      qr_code: 'data:image/png;base64,abc123',
      verification_url: 'https://example.com/verify/abc',
      page_number: '1',
      total_pages: '3',
      form_code: 'F/IKK 7.8.1',
      edition_revision: '11/1',
      instrument: {
        name: 'Barometer Digital',
        brand: 'Vaisala',
        type: 'PTB330',
        serial_number: 'S1234567',
        capacity: '500-1100 hPa',
        resolution: '0.1 hPa',
        unit: 'hPa',
        other_info: 'Sensor tekanan dan suhu',
      },
      station: {
        name: 'Stasiun Klimatologi Bogor',
        address: 'Jl. Raya Darmaga, Bogor',
      },
      sensors: [
        {
          name: 'Sensor Tekanan',
          brand: 'Vaisala',
          type: 'PTB330-P',
          serial_number: 'SP-001',
          results: [
            { measurement_point: '900', reading: '900.1', correction: '0.1', uncertainty: '0.05' },
            { measurement_point: '1000', reading: '1000.2', correction: '0.2', uncertainty: '0.06' },
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
    expect(result.lain_lain).toBe('Sensor tekanan dan suhu')

    // Calibration data
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

    // System data
    expect(result.qr_code).toBe('data:image/png;base64,abc123')
    expect(result.verification_url).toBe('https://example.com/verify/abc')
    expect(result.halaman).toBe('1')
    expect(result.jumlah_halaman).toBe('3')
    expect(result.kode_formulir).toBe('F/IKK 7.8.1')
    expect(result.edisi_revisi).toBe('11/1')

    // Sensors with full metadata
    expect(result.sensors).toHaveLength(1)
    expect(result.sensors[0].sensor_nama).toBe('Sensor Tekanan')
    expect(result.sensors[0].sensor_merk).toBe('Vaisala')
    expect(result.sensors[0].sensor_tipe).toBe('PTB330-P')
    expect(result.sensors[0].sensor_no_seri).toBe('SP-001')
    expect(result.sensors[0].hasil_kalibrasi).toHaveLength(2)
    expect(result.sensors[0].hasil_kalibrasi[0]).toEqual({
      no_urut: '1',
      titik_ukur: '900',
      pembacaan: '900.1',
      koreksi: '0.1',
      ketidakpastian: '0.05',
    })
    expect(result.sensors[0].hasil_kalibrasi[1]).toEqual({
      no_urut: '2',
      titik_ukur: '1000',
      pembacaan: '1000.2',
      koreksi: '0.2',
      ketidakpastian: '0.06',
    })
  })

  // ─── Null/undefined handling ─────────────────────────────────────────────

  it('should convert null values to empty strings', () => {
    const certificate = {
      certificate_number: null,
      instrument: { name: null, brand: null, other_info: null },
      station: { name: null },
      sensors: [],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.nomor_sertifikat).toBe('')
    expect(result.nama_alat).toBe('')
    expect(result.merk).toBe('')
    expect(result.lain_lain).toBe('')
    expect(result.nama_stasiun).toBe('')
  })

  it('should handle completely null certificate', () => {
    const result = mapCertificateToTemplateData(null)

    expect(result.nama_alat).toBe('')
    expect(result.nomor_sertifikat).toBe('')
    expect(result.sensors).toEqual([])
  })

  it('should handle undefined certificate', () => {
    const result = mapCertificateToTemplateData(undefined)

    expect(result.nama_alat).toBe('')
    expect(result.sensors).toEqual([])
  })

  // ─── Sensor data structure ─────────────────────────────────────────────────

  it('should structure sensors as array for Jinja2 loop', () => {
    const certificate = {
      sensors: [
        {
          name: 'Sensor A',
          brand: 'Brand A',
          type: 'Type A',
          serial_number: 'SN-A',
          results: [
            { measurement_point: '10', reading: '10.1', correction: '0.1', uncertainty: '0.01' },
          ],
        },
        {
          name: 'Sensor B',
          brand: 'Brand B',
          type: 'Type B',
          serial_number: 'SN-B',
          results: [],
        },
      ],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors).toHaveLength(2)
    expect(result.sensors[0]).toEqual({
      sensor_nama: 'Sensor A',
      sensor_merk: 'Brand A',
      sensor_tipe: 'Type A',
      sensor_no_seri: 'SN-A',
      hasil_kalibrasi: [
        { no_urut: '1', titik_ukur: '10', pembacaan: '10.1', koreksi: '0.1', ketidakpastian: '0.01' },
      ],
    })
    expect(result.sensors[1]).toEqual({
      sensor_nama: 'Sensor B',
      sensor_merk: 'Brand B',
      sensor_tipe: 'Type B',
      sensor_no_seri: 'SN-B',
      hasil_kalibrasi: [],
    })
  })

  it('should handle sensors with null metadata fields', () => {
    const certificate = {
      sensors: [{ name: null, brand: null, type: null, serial_number: null, results: null }],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors[0].sensor_nama).toBe('')
    expect(result.sensors[0].sensor_merk).toBe('')
    expect(result.sensors[0].sensor_tipe).toBe('')
    expect(result.sensors[0].sensor_no_seri).toBe('')
    expect(result.sensors[0].hasil_kalibrasi).toEqual([])
  })

  it('should auto-number hasil_kalibrasi rows with no_urut', () => {
    const certificate = {
      sensors: [
        {
          name: 'Sensor',
          results: [
            { measurement_point: 'A' },
            { measurement_point: 'B' },
            { measurement_point: 'C' },
          ],
        },
      ],
    }

    const result = mapCertificateToTemplateData(certificate)

    expect(result.sensors[0].hasil_kalibrasi[0].no_urut).toBe('1')
    expect(result.sensors[0].hasil_kalibrasi[1].no_urut).toBe('2')
    expect(result.sensors[0].hasil_kalibrasi[2].no_urut).toBe('3')
  })
})
