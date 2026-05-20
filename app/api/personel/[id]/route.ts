import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

const allowedRoles = new Set(['admin', 'calibrator', 'verifikator', 'assignor', 'user_station'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('personel')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch personel' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, nip, nik, phone, email, password, role, station_id, balai_id, signer_title } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 })
    }

    const normalizedRole = role ? String(role) : ''
    const normalizedStationId = station_id ? parseInt(String(station_id), 10) : null

    if (normalizedRole && !allowedRoles.has(normalizedRole)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    if (normalizedRole === 'user_station' && !normalizedStationId) {
      return NextResponse.json({ error: 'Untuk role user_station, wajib memilih stasiun' }, { status: 400 })
    }

    const updateData: any = { name, nip, phone, email }
    if (nik !== undefined) updateData.nik = nik || null
    if ('balai_id' in body) updateData.balai_id = balai_id || null
    if ('signer_title' in body) updateData.signer_title = signer_title || null

    const { data, error } = await supabaseAdmin
      .from('personel')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const authUpdate: any = {
      email,
      user_metadata: {
        name,
        phone: phone || '',
        nip: nip || '',
        nik: nik || '',
      },
    }

    if (password) authUpdate.password = password

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
    }

    if (normalizedRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: id, role: normalizedRole, station_id: normalizedStationId },
          { onConflict: 'user_id' }
        )

      if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })
    } else {
      const { error: roleDeleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', id)

      if (roleDeleteError) return NextResponse.json({ error: roleDeleteError.message }, { status: 500 })
    }

    const { error: stationDeleteError } = await supabaseAdmin
      .from('user_stations')
      .delete()
      .eq('user_id', id)

    if (stationDeleteError) return NextResponse.json({ error: stationDeleteError.message }, { status: 500 })

    if (normalizedStationId) {
      const { error: stationInsertError } = await supabaseAdmin
        .from('user_stations')
        .insert({ user_id: id, station_id: normalizedStationId })

      if (stationInsertError) return NextResponse.json({ error: stationInsertError.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update personel' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('personel')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Personel deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete personel' }, { status: 500 })
  }
}
