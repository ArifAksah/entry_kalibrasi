import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('station')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch station' }, { status: 500 })
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
      station_id, 
      name, 
      address, 
      latitude, 
      longitude, 
      elevation, 
      time_zone, 
      region, 
      province, 
      regency, 
      type,
      created_by 
    } = body

    if (!station_id || !name || !address || !latitude || !longitude || !elevation || !time_zone || !region || !province || !regency || !type || !created_by) {
      return NextResponse.json({
        error: 'All fields are required',
      }, { status: 400 })
    }

    // Validate that created_by exists in personel table
    const { data: personelData, error: personelError } = await supabase
      .from('personel')
      .select('id')
      .eq('id', created_by)
      .single()

    if (personelError || !personelData) {
      return NextResponse.json({
        error: 'Personel does not exist. Please select a valid personel.',
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('station')
      .update({ 
        station_id, 
        name, 
        address, 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude), 
        elevation: parseFloat(elevation), 
        time_zone, 
        region, 
        province, 
        regency, 
        type,
        created_by 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update station' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase
      .from('station')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Station deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 })
  }
}
