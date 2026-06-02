/**
 * Certificate Data Mapper
 *
 * Maps database certificate fields to template variable names expected
 * by the Python PDF Template Service (.docx templates using Jinja2 syntax).
 *
 * Null/undefined values are converted to empty strings ("") to ensure
 * templates render cleanly without placeholder errors.
 *
 * @see Requirements 8.2, 8.3
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A single calibration result row for a sensor.
 */
export interface TemplateCalibrationResult {
  titik_ukur: string
  pembacaan: string
  koreksi: string
  ketidakpastian: string
}

/**
 * A sensor entry with its calibration results.
 */
export interface TemplateSensor {
  sensor_nama: string
  hasil_kalibrasi: TemplateCalibrationResult[]
}

/**
 * The complete data structure sent to the PDF Template Service.
 * All string fields default to "" if the source value is null/undefined.
 */
export interface TemplateData {
  // Instrument data
  nama_alat: string
  merk: string
  tipe: string
  no_seri: string
  kapasitas: string
  resolusi: string
  unit: string

  // Certificate data
  nomor_sertifikat: string
  no_order: string
  tanggal_kalibrasi: string
  tanggal_terbit: string
  tanggal_masuk: string
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

  // Sensor results (loop variable)
  sensors: TemplateSensor[]
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
 * @param certificate - The certificate record from database (with joined relations)
 * @returns TemplateData object with all fields populated (empty string for nulls)
 *
 * @example
 * ```ts
 * const templateData = mapCertificateToTemplateData({
 *   certificate_number: 'LK.01.01/2024/001',
 *   calibration_date: '2024-01-15',
 *   instrument: { name: 'Barometer Digital', brand: 'Vaisala', ... },
 *   station: { name: 'Stasiun Klimatologi Bogor', address: 'Jl. ...' },
 *   sensors: [{ name: 'Sensor Tekanan', results: [...] }],
 * })
 * ```
 */
export function mapCertificateToTemplateData(certificate: any): TemplateData {
  const instrument = certificate?.instrument || {}
  const station = certificate?.station || {}
  const sensors = certificate?.sensors || []

  return {
    // Instrument data
    nama_alat: safeString(instrument.names),
    merk: safeString(instrument.brand),
    tipe: safeString(instrument.type),
    no_seri: safeString(instrument.serial_number),
    kapasitas: safeString(instrument.capacity),
    resolusi: safeString(instrument.resolution),
    unit: safeString(instrument.unit),

    // Certificate data
    nomor_sertifikat: safeString(certificate?.certificate_number),
    no_order: safeString(certificate?.order_number),
    tanggal_kalibrasi: safeString(certificate?.calibration_date),
    tanggal_terbit: safeString(certificate?.issue_date),
    tanggal_masuk: safeString(certificate?.received_date),
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

    // Sensor results
    sensors: Array.isArray(sensors)
      ? sensors.map((sensor: any) => ({
          sensor_nama: safeString(sensor?.name),
          hasil_kalibrasi: Array.isArray(sensor?.results)
            ? sensor.results.map((result: any) => ({
                titik_ukur: safeString(result?.measurement_point),
                pembacaan: safeString(result?.reading),
                koreksi: safeString(result?.correction),
                ketidakpastian: safeString(result?.uncertainty),
              }))
            : [],
        }))
      : [],
  }
}
