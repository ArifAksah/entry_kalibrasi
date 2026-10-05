import { createClient } from '@supabase/supabase-js'

// Allow fallbacks for self-hosted Supabase envs from VM
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PUBLIC_URL ||
  process.env.API_EXTERNAL_URL ||
  'http://localhost:8000'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.ANON_KEY ||
  ''

// supabaseUrl will default to http://localhost:8000 (Kong) if not provided

if (!supabaseAnonKey) {
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY not found. Public client operations may fail; proceeding without throwing.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client uses the service role on the server. The anon fallback prevents
// this shared module from embedding the service-role secret in browser bundles.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

if (typeof window === 'undefined' && !supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side admin operations.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ─── Browser: auto-attach Bearer token to same-origin /api/* requests ──────
// middleware.ts requires a valid session token on every protected /api route
// (pentest fixes C1/C2/C3/H4). Instead of touching hundreds of call sites we
// patch window.fetch once, here, so any code that reaches the app bundle
// (AuthContext/layout) always gets the header automatically. supabase-js keeps
// talking to the Supabase URL (different origin) and is unaffected.
if (typeof window !== 'undefined') {
  const w = window as any
  const origFetch: typeof window.fetch | undefined =
    w.fetch ? (w.fetch as any).__simkalOriginal ?? w.fetch.bind(w) : undefined

  if (origFetch && !(w.fetch as any).__simkalPatched) {
    const patched = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url =
          typeof input === 'string' ? input
          : input instanceof URL ? input.href
          : (input as Request)?.url

        if (typeof url === 'string') {
          const sameOriginApi =
            url.startsWith('/api/') ||
            (url.startsWith(window.location.origin) && new URL(url).pathname.startsWith('/api'))
          if (sameOriginApi) {
            const { data } = await supabase.auth.getSession()
            const token = data?.session?.access_token
            if (token) {
              const headers = new Headers(
                init?.headers
                ?? (!(typeof input === 'string' || input instanceof URL) ? (input as Request).headers : undefined)
              )
              if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`)
              init = { ...(init || {}), headers }
            }
          }
        }
      } catch {
        // non-fatal: fall through to the original fetch
      }
      return origFetch(input as any, init)
    }
    ;(patched as any).__simkalPatched = true
    ;(patched as any).__simkalOriginal = origFetch
    w.fetch = patched
  }
}

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
  resolution?: number | null  // resolution dari kolom sensor (field baru, float8)
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
  parameter_code?: string | null
  setpoint?: any
  tracebility?: string
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
  source_row_index?: number | null
  standard_certificate_id?: number | null
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
  station_id?: string | null // Station ID (varchar)
  name: string
  address: string
  latitude: number | string | null
  longitude: number | string | null
  elevation: number | string | null
  time_zone: string
  region: string
  province: string
  regency: string
  type_id?: number | null // Foreign key to station_type table
  station_type?: { name: string } | null
  created_by: string
}

export type StationInsert = Omit<Station, 'id' | 'created_at' | 'station_type'>
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
  name?: string | null // Deprecated: use name_alias instead
  name_alias?: string | null // Alias teks bebas untuk instrumen
  names?: number | null // FK ke tabel instrument_names
  instrument_names_id?: number | null // FK to instrument_names table
  station_id?: number | null // Foreign key column
  station?: Station | null // Relasi data (opsional)
  memiliki_lebih_satu?: boolean // Field untuk mengontrol tampilan sensor
  sensor?: Sensor[]
  instrument_type_id?: number | null // 1=Digital, 2=Analog
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
  verifikator_3?: string | null
  station_address?: string | null
  results?: any
  version?: number
  // Komponen format nomor sesuai IKK BMKG
  // 'sert' → "Sert." (surat keterangan mengikuti format nomor sertifikat)
  certificate_type?: 'sert' | 's_ket'
  // 'FC' = lapang eksternal (PTSP), 'IFC' = lapang internal BMKG, 'LC' = laboratorium
  calibration_place?: 'FC' | 'IFC' | 'LC'
  // Kode alat (AWS, TT, PP, ...), dari master instrument_names.code_alat
  instrument_code?: string | null
  // New draft workflow fields
  status?: 'draft' | 'sent' | 'verified' | 'rejected' | 'completed'
  draft_created_at?: string
  sent_to_verifiers_at?: string
  sent_by?: string
  assignor?: string
  // PDF storage fields (generated when level 3 is approved)
  pdf_path?: string | null
  pdf_generated_at?: string | null
  // Penanda user sudah menjalankan "Hitung dan Input Tabel ke Sertifikat" di QC Modal.
  // NULL = belum pernah dihitung → tombol KIRIM KONSEP dikunci di UI.
  calibration_computed_at?: string | null
  // Terisi saat results dibekukan; setelah ini payload results tidak boleh berubah.
  results_frozen_at?: string | null
  // Audit versi kontrak JSONB certificate.results.
  results_schema_version?: number | null
  // Alias audit untuk FC/LC; dibackfill dari calibration_place.
  calibration_kind?: 'FC' | 'IFC' | 'LC' | null
  public_id?: string | null
  // Balai penerbit sertifikat (null = BMKG Pusat)
  balai_id?: number | null
  // Apakah sertifikat ini untuk alat standar kalibrasi
  is_standard?: boolean
  // Link ke booking kalibrasi (null untuk sertifikat legacy)
  calibration_order_id?: number | null
  calibration_order_item_id?: number | null
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
  no_letter: string | null
  no_order?: string | null
  no_identification?: string | null
  certificate_id?: number | null
  calibration_order_id?: number | null
  calibration_order_item_id?: number | null
  instrument: number | null
  owner: number | null
  sensor?: number | null
  issue_date: string | null
  inspection_date?: string | null
  inspection_place?: string | null
  reference_document?: string | null
  notes?: string | null
  inspection_result: number | null
  authorized_by: string | null
  verifikator_1?: string | null
  verifikator_2?: string | null
  verifikator_3?: string | null
  status?: string | null
  created_by?: string | null
}

export interface LetterInspectionResult {
  id: number
  letter_id: number
  inspection_item_id: number | null
  parameter: string
  hasil: string | null
  sort_order: number
  created_at?: string
}

export interface InspectionItem {
  id: number
  instrument_name_id: number | null
  section: string | null
  parameter: string
  sort_order: number
  is_active: boolean
  created_at?: string
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

// Calibration Orders (booking nomor order sebelum keberangkatan)
export type CalibrationOrderStatus =
  | 'draft'
  | 'booked'
  | 'postponed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type CalibrationOrderItemStatus =
  | 'identified'
  | 'certificate_draft'
  | 'completed'
  | 'void'

export interface CalibrationOrder {
  id: number
  numbering_year: number | null
  order_number: number | null
  no_order: string | null
  station_id: number
  station_address_snapshot: string | null
  planned_date: string
  planned_end_date: string
  calibration_place: 'FC' | 'IFC' | 'LC'
  status: CalibrationOrderStatus
  notes: string | null
  created_by: string
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  postponed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface CalibrationOrderPersonnel {
  id: number
  order_id: number
  personel_id: string
  assigned_by: string | null
  created_at: string
}

export interface CalibrationOrderScheduleHistory {
  id: number
  order_id: number
  old_planned_date: string | null
  new_planned_date: string | null
  old_planned_end_date: string | null
  new_planned_end_date: string | null
  reason: string | null
  changed_by: string | null
  changed_at: string
}

export interface CalibrationOrderItem {
  id: number
  order_id: number
  identification_sequence: number
  no_identification: string
  instrument_id: number | null
  instrument_code: string | null
  status: CalibrationOrderItemStatus
  created_by: string | null
  created_at: string
  updated_at: string
  voided_at: string | null
  void_reason: string | null
}

export interface CalibrationOrderCounter {
  numbering_year: number
  calibration_place: 'FC' | 'IFC' | 'LC'
  last_value: number
  updated_at: string
  updated_by: string | null
}

export interface CalibrationOrderCounterLog {
  id: number
  numbering_year: number
  calibration_place: 'FC' | 'IFC' | 'LC'
  previous_value: number | null
  new_value: number | null
  action: string
  reason: string | null
  performed_by: string | null
  performed_at: string
}
