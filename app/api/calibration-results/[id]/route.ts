import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('calibration_result')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch calibration result' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      calibration_date_start, 
      calibration_date_end, 
      calibration_place, 
      environment, 
      table_result, 
      sensor, 
      notes
    } = body

    if (!calibration_date_start || !calibration_date_end || !calibration_place) {
      return NextResponse.json({ error: 'calibration_date_start, calibration_date_end, and calibration_place are required' }, { status: 400 })
    }

    // Validate foreign keys if provided
    if (sensor) {
      const { data: sensorData, error: sensorError } = await supabase
        .from('sensor')
        .select('id')
        .eq('id', sensor)
        .single()
      
      if (sensorError || !sensorData) {
        return NextResponse.json({ error: 'Invalid sensor ID' }, { status: 400 })
      }
    }

    if (notes) {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id')
        .eq('id', notes)
        .single()
      
      if (notesError || !notesData) {
        return NextResponse.json({ error: 'Invalid notes ID' }, { status: 400 })
      }
    }

    // no station in schema

    const { data, error } = await supabase
      .from('calibration_result')
      .update({
        calibration_date_start,
        calibration_date_end,
        calibration_place,
        environment: environment || null,
        table_result: table_result || null,
        sensor: sensor || null,
        notes: notes || null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update calibration result' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase
      .from('calibration_result')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Calibration result deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete calibration result' }, { status: 500 })
  }
}
