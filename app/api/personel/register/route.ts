import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const { data: callerRole, error: callerRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single()

    if (callerRoleError || callerRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mendaftarkan personel baru' }, { status: 403 })
    }

    const body = await request.json()
    const { name, nip, nik, phone, email, password, role, station_id } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password wajib diisi' }, { status: 400 })
    }

    if (role === 'user_station' && !station_id) {
      return NextResponse.json({ error: 'Untuk role user_station, wajib memilih stasiun' }, { status: 400 })
    }

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        name,
        phone: phone || '',
        nip: nip || '',
        nik: nik || '',
      },
    })

    if (createUserError || !createdUser.user) {
      return NextResponse.json({ error: createUserError?.message || 'Gagal membuat akun auth' }, { status: 400 })
    }

    createdUserId = createdUser.user.id

    const { error: personelError } = await supabaseAdmin
      .from('personel')
      .insert({
        id: createdUserId,
        name,
        nip: nip || '',
        nik: nik || null,
        nik_index: null,
        phone: phone || '',
        email,
      })

    if (personelError) {
      throw new Error(personelError.message)
    }

    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          {
            user_id: createdUserId,
            role,
            station_id: station_id ? parseInt(String(station_id), 10) : null,
          },
          { onConflict: 'user_id' }
        )

      if (roleError) {
        throw new Error(roleError.message)
      }
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: createdUserId,
          email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => null)
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Gagal mendaftarkan personel',
      },
      { status: 500 }
    )
  }
}
