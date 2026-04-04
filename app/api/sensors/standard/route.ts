import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

// GET: semua sensor standar beserta info instrumen induknya
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sensor')
      .select(`
        id,
        name,
        manufacturer,
        type,
        serial_number,
        range_capacity,
        range_capacity_unit,
        is_standard,
        tracebility,
        instrument_id,
        instrument:instrument_id (
          id,
          name,
          manufacturer,
          type,
          serial_number
        )
      `)
      .eq('is_standard', true)
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching standard sensors:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
