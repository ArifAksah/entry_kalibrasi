import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../lib/supabase'
import { requireRoles } from '../../../../lib/api-auth'
import { clientSafeMessage } from '../../../../lib/api-error'
import { normalizeStationId } from '../../../../lib/station-identity'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('station')
      .select('*, station_type(name)')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
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
    const adminGate = await requireRoles(request, ['admin', 'calibrator'])
    if (adminGate instanceof NextResponse) return adminGate

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
      type_id,
      created_by
    } = body

    const missingFields = []
    if (!name) missingFields.push('name')
    if (!address) missingFields.push('address')
    if (!time_zone) missingFields.push('time_zone')
    if (!region) missingFields.push('region')
    if (!province) missingFields.push('province')
    if (!regency) missingFields.push('regency')
    // type is optional as it exists in DB but might not be required
    if (!created_by) missingFields.push('created_by')

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Required fields are missing: ${missingFields.join(', ')}`,
      }, { status: 400 })
    }

    // Normalisasi dan validasi ID stasiun/WMO
    const normalized = normalizeStationId(station_id)
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    // Cegah duplikasi WMO selain row yang sedang diedit
    if (normalized.value) {
      const { data: existing, error: existingError } = await supabase
        .from('station')
        .select('id, name')
        .eq('station_id', normalized.value)
        .neq('id', id)
        .limit(1)

      if (existingError) {
        return NextResponse.json({ error: clientSafeMessage(existingError) }, { status: 500 })
      }

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            error: `ID Stasiun/WMO ${normalized.value} sudah digunakan oleh "${existing[0].name}".`,
            code: 'STATION_ID_DUPLICATE',
            existingId: existing[0].id,
          },
          { status: 409 },
        )
      }
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
        station_id: normalized.value,
        name,
        address,
        latitude: latitude === '' ? null : latitude,
        longitude: longitude === '' ? null : longitude,
        elevation: elevation === '' ? null : elevation,
        time_zone,
        region,
        province,
        regency,
        type_id: type_id || null,
        created_by
      })
      .eq('id', id)
      .select('*, station_type(name)')
      .single()

    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
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
    const adminGate = await requireRoles(request, ['admin', 'calibrator'])
    if (adminGate instanceof NextResponse) return adminGate

    const { id } = await params
    const { error } = await supabase
      .from('station')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json({ message: 'Station deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 })
  }
}
