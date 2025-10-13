import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// GET - Get all sensors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10', 10) || 10))
    const q = (searchParams.get('q') || '').trim()

    const base = supabase
      .from('sensor')
      .select('*', { count: 'exact' })

    const qb = q
      ? base.or(
          [
            `name.ilike.%${q}%`,
            `manufacturer.ilike.%${q}%`,
            `type.ilike.%${q}%`,
            `serial_number.ilike.%${q}%`,
            `range_capacity.ilike.%${q}%`,
            `range_capacity_unit.ilike.%${q}%`,
          ].join(',')
        )
      : base

    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(start, end)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const total = count || 0
    return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
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
