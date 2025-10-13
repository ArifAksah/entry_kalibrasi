import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
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
