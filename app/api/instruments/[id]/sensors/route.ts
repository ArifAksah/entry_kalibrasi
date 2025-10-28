import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client to avoid RLS issues on server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get sensors associated with this instrument using instrument_id column
    const { data, error } = await supabaseAdmin
      .from('sensor')
      .select(`
        id,
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
        is_standard,
        created_at
      `)
      .eq('instrument_id', id)

    if (error) {
      console.error('Error fetching sensors:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform the data to match the expected format
    const sensors = data?.map(sensor => ({
      id: sensor.id.toString(),
      nama_sensor: sensor.name || '',
      merk_sensor: sensor.manufacturer || '',
      tipe_sensor: sensor.type || '',
      serial_number_sensor: sensor.serial_number || '',
      range_capacity: sensor.range_capacity || '',
      range_capacity_unit: sensor.range_capacity_unit || '',
      graduating: sensor.graduating || '',
      graduating_unit: sensor.graduating_unit || '',
      funnel_diameter: sensor.funnel_diameter || 0,
      funnel_diameter_unit: sensor.funnel_diameter_unit || '',
      volume_per_tip: sensor.volume_per_tip || '',
      volume_per_tip_unit: sensor.volume_per_tip_unit || '',
      funnel_area: sensor.funnel_area || 0,
      funnel_area_unit: sensor.funnel_area_unit || '',
      is_standard: sensor.is_standard || false
    })) || []

    return NextResponse.json(sensors)
  } catch (e) {
    console.error('Unexpected error in GET /api/instruments/[id]/sensors:', e)
    return NextResponse.json({ error: 'Failed to fetch instrument sensors' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // Create new sensor with instrument_id
    const { data: sensorData, error: sensorError } = await supabaseAdmin
      .from('sensor')
      .insert({
        manufacturer: body.merk_sensor || '',
        type: body.tipe_sensor || '',
        serial_number: body.serial_number_sensor || '',
        range_capacity: body.range_capacity || '',
        range_capacity_unit: body.range_capacity_unit || '',
        graduating: body.graduating || '',
        graduating_unit: body.graduating_unit || '',
        funnel_diameter: body.funnel_diameter || 0,
        funnel_diameter_unit: body.funnel_diameter_unit || '',
        volume_per_tip: body.volume_per_tip || '',
        volume_per_tip_unit: body.volume_per_tip_unit || '',
        funnel_area: body.funnel_area || 0,
        funnel_area_unit: body.funnel_area_unit || '',
        name: body.nama_sensor || '',
        is_standard: body.is_standard || false,
        instrument_id: parseInt(id)
      })
      .select()
      .single()

    if (sensorError) {
      console.error('Error creating sensor:', sensorError)
      return NextResponse.json({ error: sensorError.message }, { status: 500 })
    }

    // Transform response to match frontend format
    const responseSensor = {
      id: sensorData.id.toString(),
      nama_sensor: sensorData.name || '',
      merk_sensor: sensorData.manufacturer || '',
      tipe_sensor: sensorData.type || '',
      serial_number_sensor: sensorData.serial_number || '',
      range_capacity: sensorData.range_capacity || '',
      range_capacity_unit: sensorData.range_capacity_unit || '',
      graduating: sensorData.graduating || '',
      graduating_unit: sensorData.graduating_unit || '',
      funnel_diameter: sensorData.funnel_diameter || 0,
      funnel_diameter_unit: sensorData.funnel_diameter_unit || '',
      volume_per_tip: sensorData.volume_per_tip || '',
      volume_per_tip_unit: sensorData.volume_per_tip_unit || '',
      funnel_area: sensorData.funnel_area || 0,
      funnel_area_unit: sensorData.funnel_area_unit || '',
      is_standard: sensorData.is_standard || false
    }

    return NextResponse.json(responseSensor, { status: 201 })
  } catch (e) {
    console.error('Unexpected error in POST /api/instruments/[id]/sensors:', e)
    return NextResponse.json({ error: 'Failed to create instrument sensor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const sensorId = searchParams.get('sensorId')

    if (!sensorId) {
      return NextResponse.json({ error: 'sensorId parameter is required' }, { status: 400 })
    }

    // Delete sensor from sensor table
    const { error: deleteError } = await supabaseAdmin
      .from('sensor')
      .delete()
      .eq('id', sensorId)
      .eq('instrument_id', id)

    if (deleteError) {
      console.error('Error deleting sensor:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Sensor deleted successfully' })
  } catch (e) {
    console.error('Unexpected error in DELETE /api/instruments/[id]/sensors:', e)
    return NextResponse.json({ error: 'Failed to delete instrument sensor' }, { status: 500 })
  }
}
