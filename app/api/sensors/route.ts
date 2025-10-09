import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// GET - Get all sensors
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sensor')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Return the array directly for consistency with other endpoints
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new sensor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      manufacturer,
      type,
      serial_number,
      range_capacity,
      range_capacity_unit,
      graduating,
      graduating_unit,
      funnel_diameter,
      funnel_diameter_unit,
      volume_per_tip,
      volume_per_tip_unit,
      funnel_area,
      funnel_area_unit,
      name,
      is_standard
    } = body

    // Validation
    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({ 
        error: 'Manufacturer, type, serial number, and name are required' 
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('sensor')
      .insert({
        manufacturer,
        type,
        serial_number,
        range_capacity: range_capacity || '',
        range_capacity_unit: range_capacity_unit || '',
        graduating: graduating || '',
        graduating_unit: graduating_unit || '',
        funnel_diameter: funnel_diameter || 0,
        funnel_diameter_unit: funnel_diameter_unit || '',
        volume_per_tip: volume_per_tip || '',
        volume_per_tip_unit: volume_per_tip_unit || '',
        funnel_area: funnel_area || 0,
        funnel_area_unit: funnel_area_unit || '',
        name,
        is_standard: !!is_standard
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Return the created row directly
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
