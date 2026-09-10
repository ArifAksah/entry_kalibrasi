import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

const allowedRoles = new Set(['admin', 'calibrator', 'verifikator', 'assignor', 'user_station'])

const BAN_MS = '876000h' // ~100 years; effectively permanent ban
const UNBAN = 'none'

async function getPersonelOrNull(id: string) {
  const { data, error } = await supabaseAdmin
    .from('personel')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

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

    const existing = await getPersonelOrNull(id)
    if (!existing) {
      return NextResponse.json({ error: 'Personel tidak ditemukan' }, { status: 404 })
    }
    if (existing.is_active === false) {
      return NextResponse.json({ error: 'Personel nonaktif. Aktifkan kembali terlebih dahulu.' }, { status: 400 })
    }

    const normalizedRole = role ? String(role) : ''
    const normalizedStationId = station_id ? parseInt(String(station_id), 10) : null

    if (normalizedRole && !allowedRoles.has(normalizedRole)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    if (normalizedRole === 'user_station' && !normalizedStationId) {
      return NextResponse.json({ error: 'Untuk role user_station, wajib memilih stasiun' }, { status: 400 })
    }

    // Hanya tulis kolom yang dikirim dan valid — hindari error schema cache
    // pada environment yang belum menjalankan migrasi balai_id/signer_title.
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (nip !== undefined) updateData.nip = nip || null
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email
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

    // Update metadata akun auth (non-fatal bila tidak tersedia di env tertentu)
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
      console.error('[personel] auth metadata update failed:', authUpdateError.message)
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
    const existing = await getPersonelOrNull(id)
    if (!existing) {
      return NextResponse.json({ error: 'Personel tidak ditemukan' }, { status: 404 })
    }

    // 1. Soft delete personel (riwayat tetap aman)
    const { error: personelError } = await supabaseAdmin
      .from('personel')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })

    // 2. Hapus role assignment
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', id)
    if (roleError) {
      console.error('[personel] role delete failed:', roleError.message)
    }

    // 3. Hapus relasi stasiun
    const { error: stationError } = await supabaseAdmin
      .from('user_stations')
      .delete()
      .eq('user_id', id)
    if (stationError) {
      console.error('[personel] user_stations delete failed:', stationError.message)
    }

    // 4. Ban akun auth supaya tidak bisa login
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: BAN_MS })
    if (banError) {
      return NextResponse.json({ error: banError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Personel dinonaktifkan' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to disable personel' }, { status: 500 })
  }
}
