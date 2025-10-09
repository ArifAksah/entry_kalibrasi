import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

// GET - Get single sensor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('sensor')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update sensor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({ 
        error: 'Manufacturer, type, serial number, and name are required' 
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('sensor')
      .update({
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
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete sensor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase
      .from('sensor')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Sensor deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
