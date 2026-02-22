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
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY not found. Public client operations may fail; proceeding without throwing.')
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
  // New fields for sensor identity from schema
  instrument_id?: number
  sensor_name_id?: number
  setpoint?: any
}

export interface CertStandard {
  id: number
  created_at: string
  no_certificate: string
  calibration_date: string
  drift: number
  range: string
  resolution: number
  u95_general: number
  sensor_id: number
  correction_std: any
}

export interface CalibrationSession {
  id: string // UUID
  created_at: string
  station_id: number | null
  start_date: string | null
  end_date: string | null
  place: string | null
  notes: string | null
  users: string[] // Array of user IDs (evaluators, etc.)
  status: string
}

export interface RawData {
  id: number
  created_at: string
  session_id: string
  data: any // JSONB or array
  filename: string
  uploaded_by: string
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
  station_wmo_id?: string | null // Mapped to station_id in UI often
  station_id?: string // Legacy or alias
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

export interface RefStation {
  station_id: string
  station_wmo_id: string | null
  station_name: string
  current_latitude: number
  current_longitude: number
  current_elevation: number
  timezone: string
  region_description: string
  propinsi_name: string
  kabupaten_name: string
  wigos_id: string | null
  station_type_id: number | null
}

// Instrument
export interface Instrument {
  id: number
  created_at: string
  manufacturer: string
  type: string
  serial_number: string
  others?: string | null
  name: string
  instrument_names_id?: number | null // FK to instrument_names table
  station_id?: number | null // Foreign key column
  station?: Station | null // Relasi data (opsional)
  memiliki_lebih_satu?: boolean // Field untuk mengontrol tampilan sensor
  sensor?: Sensor[]
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
  // New draft workflow fields
  status?: 'draft' | 'sent' | 'verified' | 'rejected' | 'completed'
  draft_created_at?: string
  sent_to_verifiers_at?: string
  sent_by?: string
  assignor?: string
  // PDF storage fields (generated when level 3 is approved)
  pdf_path?: string | null
  pdf_generated_at?: string | null
}

export type CertificateInsert = Omit<Certificate, 'id' | 'created_at' | 'version'>
export type CertificateUpdate = Partial<CertificateInsert>

// Certificate Logs
export interface CertificateLog {
  id: number
  certificate_id: number
  action: 'created' | 'sent' | 'approved_v1' | 'approved_v2' | 'approved_assignor' | 'rejected_v1' | 'rejected_v2' | 'rejected_assignor' | 'updated' | 'deleted'
  performed_by: string
  performed_by_name?: string | null
  notes?: string | null
  rejection_reason?: string | null
  approval_notes?: string | null
  verification_level?: number | null // 1 = verifikator_1, 2 = verifikator_2, 3 = assignor/authorized_by
  previous_status?: string | null
  new_status?: string | null
  metadata?: Record<string, any> | null
  created_at: string
}

export type CertificateLogInsert = Omit<CertificateLog, 'id' | 'created_at'>
export type CertificateLogUpdate = Partial<CertificateLogInsert>

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
  approver_name?: string | null
  inspection_payload?: any | null
  verification?: any[] | null
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
