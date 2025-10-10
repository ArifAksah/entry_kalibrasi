import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types

// Station types
export interface Station {
  id: number
  created_at: string
  name: string
  station_id: string
  location?: string
  description?: string
}

export type StationInsert = Omit<Station, 'id' | 'created_at'>
export type StationUpdate = Partial<StationInsert>

// Instrument types
export interface Instrument {
  id: number
  created_at: string
  name: string
  manufacturer?: string
  type?: string
  serial_number?: string
  description?: string
}

export type InstrumentInsert = Omit<Instrument, 'id' | 'created_at'>
export type InstrumentUpdate = Partial<InstrumentInsert>

// Sensor types
export interface SensorName {
  id: string
  created_at: string
  updated_at: string
  name: string
}

export type SensorNameInsert = Omit<SensorName, 'id' | 'created_at' | 'updated_at'>
export type SensorNameUpdate = Partial<SensorNameInsert>

export interface Sensor {
  id: number
  created_at: string
  manufacturer: string
  type: string
  serial_number: string
  range_capacity: string
  range_capacity_unit: string
  graduating: string
  graduating_unit: string
  funnel_diameter: number
  funnel_diameter_unit: string
  volume_per_tip: string
  volume_per_tip_unit: string
  funnel_area: number
  funnel_area_unit: string
  name: string // Name from sensor_names table
  is_standard: boolean
}

export type SensorInsert = Omit<Sensor, 'id' | 'created_at'>
export type SensorUpdate = Partial<SensorInsert>

// Note types
export interface Note {
  id: number
  created_at: string
  traceable_to_si_through: string | null
  reference_document: string | null
  calibration_methode: string | null
  others: string | null
}

export type NoteInsert = Omit<Note, 'id' | 'created_at'>
export type NoteUpdate = Partial<NoteInsert>

// Personel types
export interface Personel {
  id: string
  created_at: string
  name: string
  email?: string
  position?: string
  department?: string
}

export type PersonelInsert = Omit<Personel, 'id' | 'created_at'>
export type PersonelUpdate = Partial<PersonelInsert>

// Certificate types
export interface Certificate {
  id: number
  created_at: string
  no_certificate: string
  no_order: string
  no_identification: string
  authorized_by: string | null
  verifikator_1: string | null
  verifikator_2: string | null
  issue_date: string
  station: number | null
  instrument: number | null
  // Additional fields from your component
  results?: any
  verifikator_1_status?: 'pending' | 'approved' | 'rejected'
  verifikator_2_status?: 'pending' | 'approved' | 'rejected'
  verification_notes?: string
  rejection_reason?: string
  repair_status?: 'none' | 'pending' | 'completed' | 'rejected'
}

export type CertificateInsert = Omit<Certificate, 'id' | 'created_at'> & {
  results?: any
}

export type CertificateUpdate = Partial<CertificateInsert>

// Calibration Result types (for the results array in Certificate)
export interface CalibrationEnvironment {
  key: string
  value: string
}

export interface CalibrationTableRow {
  key: string
  unit: string
  value: string
}

export interface CalibrationTableSection {
  title: string
  rows: CalibrationTableRow[]
}

export interface CalibrationNotes {
  traceable_to_si_through: string
  reference_document: string
  calibration_methode: string
  others: string
  standardInstruments: number[]
}

export interface CalibrationResult {
  sensorId: number | null
  startDate: string
  endDate: string
  place: string
  environment: CalibrationEnvironment[]
  table: CalibrationTableSection[]
  notesForm: CalibrationNotes
  sensorDetails?: Partial<Sensor>
}

// Verification types
export interface Verification {
  id: number
  created_at: string
  certificate_id: number
  verifikator_id: string
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
  verified_at?: string
}

export type VerificationInsert = Omit<Verification, 'id' | 'created_at'>
export type VerificationUpdate = Partial<VerificationInsert>

// Repair types
export interface Repair {
  id: number
  created_at: string
  certificate_id: number
  status: 'pending' | 'completed' | 'rejected'
  notes?: string
  completed_at?: string
  completed_by?: string
}

export type RepairInsert = Omit<Repair, 'id' | 'created_at'>
export type RepairUpdate = Partial<RepairInsert>

// Export all types
export type {
  CalibrationEnvironment,
  CalibrationTableRow,
  CalibrationTableSection,
  CalibrationNotes,
  CalibrationResult
}