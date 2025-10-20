import { createClient } from '@supabase/supabase-js'

// Allow fallbacks for self-hosted Supabase envs from VM
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PUBLIC_URL ||
  process.env.API_EXTERNAL_URL ||
  'http://localhost:7000'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.ANON_KEY ||
  ''

// supabaseUrl will default to http://localhost:7000 for local dev if not provided

if (!supabaseAnonKey) {
  throw new Error('supabaseAnonKey is required. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (or ANON_KEY).')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found. Admin operations may fail.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types
export interface SensorName {
  id: string
  created_at: string
  updated_at: string
  name: string
}

export type SensorNameInsert = Omit<SensorName, 'id' | 'created_at' | 'updated_at'>
export type SensorNameUpdate = Partial<SensorNameInsert>

// Instrument names
export interface InstrumentName {
  id: string
  created_at: string
  updated_at: string
  name: string
}

export type InstrumentNameInsert = Omit<InstrumentName, 'id' | 'created_at' | 'updated_at'>
export type InstrumentNameUpdate = Partial<InstrumentNameInsert>

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
  is_standard: boolean   // ✅ tambahkan ini
}

export type SensorInsert = Omit<Sensor, 'id' | 'created_at'>
export type SensorUpdate = Partial<SensorInsert>

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

// Station
export interface Station {
  id: number
  created_at: string
  station_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  elevation: number
  time_zone: string
  region: string
  province: string
  regency: string
  type: string
  created_by: string
}

export type StationInsert = Omit<Station, 'id' | 'created_at'>
export type StationUpdate = Partial<StationInsert>

// Instrument
export interface Instrument {
  id: number
  created_at: string
  manufacturer: string
  type: string
  serial_number: string
  others?: string | null
  name: string
  station_id?: number | null
  station?: Station | null
}

export type InstrumentInsert = Omit<Instrument, 'id' | 'created_at' | 'station'>
export type InstrumentUpdate = Partial<InstrumentInsert>

// Certificate
export interface Certificate {
  id: number
  created_at: string
  no_certificate: string
  no_order: string
  no_identification: string
  issue_date: string
  station: number | null
  instrument: number | null
  authorized_by: string | null
  verifikator_1: string | null
  verifikator_2: string | null
  station_address?: string | null
  results?: any
  version?: number
}

export type CertificateInsert = Omit<Certificate, 'id' | 'created_at' | 'version'>
export type CertificateUpdate = Partial<CertificateInsert>

// Inspection person
export interface InspectionPerson {
  id: number
  created_at: string
  result: number | null
  inspection_by: string | null
}

export type InspectionPersonInsert = Omit<InspectionPerson, 'id' | 'created_at'>
export type InspectionPersonUpdate = Partial<InspectionPersonInsert>

// Letter
export interface Letter {
  id: number
  created_at: string
  no_letter: string
  instrument: number | null
  owner: number | null
  issue_date: string | null
  inspection_result: number | null
  authorized_by: string | null
}

export type LetterInsert = Omit<Letter, 'id' | 'created_at'>
export type LetterUpdate = Partial<LetterInsert>

// NotesInstrumenStandard
export interface NotesInstrumenStandard {
  id: number
  created_at: string
  notes: number | null
  instrumen_standard: number | null
}

export type NotesInstrumenStandardInsert = Omit<NotesInstrumenStandard, 'id' | 'created_at'>
export type NotesInstrumenStandardUpdate = Partial<NotesInstrumenStandardInsert>

// Personel
export interface Personel {
  id: string
  name: string
  email?: string | null
}

// VerifikatorCalResult
export interface VerifikatorCalResult {
  id: number
  created_at: string
  cal_result: number
  verified_by: string
}

export type VerifikatorCalResultInsert = Omit<VerifikatorCalResult, 'id' | 'created_at'>
export type VerifikatorCalResultUpdate = Partial<VerifikatorCalResultInsert>

// VerifikatorInspectionResult (insp_verified_person)
export interface VerifikatorInspectionResult {
  id: number
  created_at: string
  result: number
  verified_by: string
}

export type VerifikatorInspectionResultInsert = Omit<VerifikatorInspectionResult, 'id' | 'created_at'>
export type VerifikatorInspectionResultUpdate = Partial<VerifikatorInspectionResultInsert>

// Calibration results
export interface CalibrationResult {
  id: number
  created_at: string
  calibration_date_start: string
  calibration_date_end: string
  calibration_place: string
  environment: Record<string, string> | null
  table_result: Record<string, string> | null
  sensor: number | null
  notes: number | null
}

export type CalibrationResultInsert = Omit<CalibrationResult, 'id' | 'created_at'>
export type CalibrationResultUpdate = Partial<CalibrationResultInsert>
