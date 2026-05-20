/**
 * Variable Helpers - Inlined from deleted variable-registry.ts and variable-engine.ts
 *
 * Contains the VARIABLE_REGISTRY (list of all supported template variables)
 * and getValueByPath utility for resolving data paths.
 *
 * These were previously in separate files but are now inlined here since
 * the TipTap editor code that also used them has been removed.
 */

import { VariableDefinition, CertificateData } from './types'

/**
 * Registry of all supported template variables.
 * Each entry maps a variable name to its data path in CertificateData.
 */
export const VARIABLE_REGISTRY: VariableDefinition[] = [
  // Instrument variables
  { name: 'nama_alat', category: 'instrument', description: 'Nama alat/instrumen', dataKey: 'instrument.nama_alat' },
  { name: 'merk', category: 'instrument', description: 'Merk/pabrikan alat', dataKey: 'instrument.merk' },
  { name: 'tipe', category: 'instrument', description: 'Tipe/model alat', dataKey: 'instrument.tipe' },
  { name: 'no_seri', category: 'instrument', description: 'Nomor seri alat', dataKey: 'instrument.no_seri' },
  { name: 'kapasitas', category: 'instrument', description: 'Kapasitas alat', dataKey: 'instrument.kapasitas' },
  { name: 'resolusi', category: 'instrument', description: 'Resolusi alat', dataKey: 'instrument.resolusi' },

  // Calibration variables
  { name: 'nomor_sertifikat', category: 'calibration', description: 'Nomor sertifikat kalibrasi', dataKey: 'calibration.nomor_sertifikat' },
  { name: 'tanggal_kalibrasi', category: 'calibration', description: 'Tanggal pelaksanaan kalibrasi', dataKey: 'calibration.tanggal_kalibrasi' },
  { name: 'tanggal_terbit', category: 'calibration', description: 'Tanggal terbit sertifikat', dataKey: 'calibration.tanggal_terbit' },
  { name: 'metode_kalibrasi', category: 'calibration', description: 'Metode kalibrasi yang digunakan', dataKey: 'calibration.metode_kalibrasi' },
  { name: 'suhu', category: 'calibration', description: 'Suhu ruangan saat kalibrasi', dataKey: 'calibration.suhu' },
  { name: 'kelembaban', category: 'calibration', description: 'Kelembaban ruangan saat kalibrasi', dataKey: 'calibration.kelembaban' },
  { name: 'tempat_kalibrasi', category: 'calibration', description: 'Tempat pelaksanaan kalibrasi', dataKey: 'calibration.tempat_kalibrasi' },

  // Station variables
  { name: 'nama_stasiun', category: 'station', description: 'Nama stasiun/instansi pemilik', dataKey: 'station.nama_stasiun' },
  { name: 'alamat_stasiun', category: 'station', description: 'Alamat stasiun/instansi', dataKey: 'station.alamat_stasiun' },

  // Personnel variables
  { name: 'nama_penandatangan', category: 'personnel', description: 'Nama penandatangan sertifikat', dataKey: 'personnel.nama_penandatangan' },
  { name: 'nip_penandatangan', category: 'personnel', description: 'NIP penandatangan', dataKey: 'personnel.nip_penandatangan' },
  { name: 'jabatan_penandatangan', category: 'personnel', description: 'Jabatan penandatangan', dataKey: 'personnel.jabatan_penandatangan' },
  { name: 'nama_teknisi', category: 'personnel', description: 'Nama teknisi pelaksana', dataKey: 'personnel.nama_teknisi' },
  { name: 'nip_teknisi', category: 'personnel', description: 'NIP teknisi pelaksana', dataKey: 'personnel.nip_teknisi' },

  // Results variables (used inside loops)
  { name: 'no_urut', category: 'results', description: 'Nomor urut hasil kalibrasi', dataKey: 'results.no_urut' },
  { name: 'titik_ukur', category: 'results', description: 'Titik ukur', dataKey: 'results.titik_ukur' },
  { name: 'pembacaan', category: 'results', description: 'Pembacaan alat', dataKey: 'results.pembacaan' },
  { name: 'koreksi', category: 'results', description: 'Koreksi', dataKey: 'results.koreksi' },
  { name: 'ketidakpastian', category: 'results', description: 'Ketidakpastian pengukuran', dataKey: 'results.ketidakpastian' },

  // System variables
  { name: 'qr_code', category: 'system', description: 'QR Code verifikasi sertifikat', dataKey: 'system.qr_code' },
  { name: 'verification_url', category: 'system', description: 'URL verifikasi sertifikat', dataKey: 'system.verification_url' },
]

/**
 * Resolve a dot-path (e.g., "instrument.nama_alat") to a value in the data object.
 * Returns null if the path cannot be resolved.
 */
export function getValueByPath(data: CertificateData, path: string): string | null {
  const parts = path.split('.')
  let current: any = data

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return null
    }
    current = current[part]
  }

  if (current == null) return null
  return String(current)
}
