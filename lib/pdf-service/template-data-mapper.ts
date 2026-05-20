/**
 * Template Data Mapper
 *
 * Maps certificate data from the database to the template variable format
 * expected by the Python PDF Template Service (Jinja2 syntax in .docx templates).
 *
 * All null/undefined values are converted to empty strings ("") to ensure
 * templates render cleanly without placeholder errors.
 *
 * Variable categories (matching TAG_CATEGORIES from word-upload page):
 * - instrument: nama_alat, merk, tipe, no_seri, kapasitas, resolusi, unit, lain_lain
 * - calibration: nomor_sertifikat, no_order, tanggal_masuk, tanggal_kalibrasi, tanggal_terbit,
 *               metode_kalibrasi, suhu, kelembaban, tempat_kalibrasi, standar_kalibrasi,
 *               ketertelusuran, dokumen_acuan, catatan
 * - station: nama_stasiun, alamat_stasiun, nama_pemilik
 * - personnel: nama_penandatangan, nip_penandatangan, jabatan_penandatangan,
 *             nama_teknisi, nip_teknisi, nama_verifikator
 * - results (sensors loop): sensors[].sensor_nama, sensor_merk, sensor_tipe, sensor_no_seri,
 *                           sensors[].hasil_kalibrasi[].titik_ukur, pembacaan, koreksi, ketidakpastian
 *
 * @see Requirements 8.2, 8.3
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A single calibration result row for a sensor.
 */
export interface CalibrationResultRow {
  no_urut: string
  titik_ukur: string
  pembacaan: string
  koreksi: string
  ketidakpastian: string
}

/**
 * A sensor entry with its metadata and calibration results.
 */
export interface SensorData {
  sensor_nama: string
  sensor_merk: string
  sensor_tipe: string
  sensor_no_seri: string
  hasil_kalibrasi: CalibrationResultRow[]
}

/**
 * The complete template data structure sent to the PDF Template Service.
 */
export interface TemplateDataOutput {
  // Instrument data
  nama_alat: string
  merk: string
  tipe: string
  no_seri: string
  kapasitas: string
  resolusi: string
  unit: string
  lain_lain: string

  // Calibration data
  nomor_sertifikat: string
  no_order: string
  tanggal_masuk: string
  tanggal_kalibrasi: string
  tanggal_terbit: string
  metode_kalibrasi: string
  suhu: string
  kelembaban: string
  tempat_kalibrasi: string
  standar_kalibrasi: string
  ketertelusuran: string
  dokumen_acuan: string
  catatan: string

  // Station/owner data
  nama_stasiun: string
  alamat_stasiun: string
  nama_pemilik: string

  // Personnel data
  nama_penandatangan: string
  nip_penandatangan: string
  jabatan_penandatangan: string
  nama_teknisi: string
  nip_teknisi: string
  nama_verifikator: string

  // System data
  qr_code: string
  verification_url: string
  halaman: string
  jumlah_halaman: string
  kode_formulir: string
  edisi_revisi: string

  // Sensor results (loop variable for Jinja2: {% for sensor in sensors %})
  sensors: SensorData[]
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Safely converts a value to string, returning "" for null/undefined.
 */
function safeString(value: any): string {
  if (value == null) return ''
  return String(value)
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

/**
 * Maps a database certificate record (with nested relations) to the flat
 * template data format expected by the Python PDF Template Service.
 *
 * The certificate object is expected to have nested objects for related data:
 * - certificate.instrument: { name, brand, type, serial_number, capacity, resolution, unit, other_info }
 * - certificate.station: { name, address }
 * - certificate.sensors: [{ name, brand, type, serial_number, results: [{ measurement_point, reading, correction, uncertainty }] }]
 *
 * @param certificate - The certificate record from database (with joined relations)
 * @returns Record<string, any> with all template variables populated (empty string for nulls)
 *
 * @example
 * ```ts
 * const templateData = mapCertificateToTemplateData({
 *   certificate_number: 'LK.01.01/2024/001',
 *   calibration_date: '2024-01-15',
 *   instrument: { name: 'Barometer Digital', brand: 'Vaisala', type: 'PTB330' },
 *   station: { name: 'Stasiun Klimatologi Bogor', address: 'Jl. Raya Bogor' },
 *   sensors: [{ name: 'Sensor Tekanan', results: [{ measurement_point: '900', reading: '900.1', correction: '0.1', uncertainty: '0.05' }] }],
 * })
 * ```
 */
export function mapCertificateToTemplateData(certificate: any): Record<string, any> {
  const instrument = certificate?.instrument || {}
  const station = certificate?.station || {}
  const sensors = certificate?.sensors || []

  const data: TemplateDataOutput = {
    // Instrument data
    nama_alat: safeString(instrument.name),
    merk: safeString(instrument.brand),
    tipe: safeString(instrument.type),
    no_seri: safeString(instrument.serial_number),
    kapasitas: safeString(instrument.capacity),
    resolusi: safeString(instrument.resolution),
    unit: safeString(instrument.unit),
    lain_lain: safeString(instrument.other_info),

    // Calibration data
    nomor_sertifikat: safeString(certificate?.certificate_number),
    no_order: safeString(certificate?.order_number),
    tanggal_masuk: safeString(certificate?.received_date),
    tanggal_kalibrasi: safeString(certificate?.calibration_date),
    tanggal_terbit: safeString(certificate?.issue_date),
    metode_kalibrasi: safeString(certificate?.calibration_method),
    suhu: safeString(certificate?.temperature),
    kelembaban: safeString(certificate?.humidity),
    tempat_kalibrasi: safeString(certificate?.calibration_place),
    standar_kalibrasi: safeString(certificate?.standard_used),
    ketertelusuran: safeString(certificate?.traceability),
    dokumen_acuan: safeString(certificate?.reference_document),
    catatan: safeString(certificate?.notes),

    // Station/owner data
    nama_stasiun: safeString(station.name),
    alamat_stasiun: safeString(station.address),
    nama_pemilik: safeString(certificate?.owner_name),

    // Personnel data
    nama_penandatangan: safeString(certificate?.signer_name),
    nip_penandatangan: safeString(certificate?.signer_nip),
    jabatan_penandatangan: safeString(certificate?.signer_position),
    nama_teknisi: safeString(certificate?.technician_name),
    nip_teknisi: safeString(certificate?.technician_nip),
    nama_verifikator: safeString(certificate?.verifier_name),

    // System data
    qr_code: safeString(certificate?.qr_code),
    verification_url: safeString(certificate?.verification_url),
    halaman: safeString(certificate?.page_number),
    jumlah_halaman: safeString(certificate?.total_pages),
    kode_formulir: safeString(certificate?.form_code),
    edisi_revisi: safeString(certificate?.edition_revision),

    // Sensor results (structured as array for Jinja2 loop)
    sensors: Array.isArray(sensors)
      ? sensors.map((sensor: any, index: number) => ({
          sensor_nama: safeString(sensor?.name),
          sensor_merk: safeString(sensor?.brand),
          sensor_tipe: safeString(sensor?.type),
          sensor_no_seri: safeString(sensor?.serial_number),
          hasil_kalibrasi: Array.isArray(sensor?.results)
            ? sensor.results.map((result: any, resultIndex: number) => ({
                no_urut: String(resultIndex + 1),
                titik_ukur: safeString(result?.measurement_point),
                pembacaan: safeString(result?.reading),
                koreksi: safeString(result?.correction),
                ketidakpastian: safeString(result?.uncertainty),
              }))
            : [],
        }))
      : [],
  }

  return data
}
