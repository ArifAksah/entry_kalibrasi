import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { ASSIGNABLE_ROLES, forbidden, getCaller, isAdminCaller, unauthorized } from '../../../lib/api-auth'
import { clientSafeMessage } from '../../../lib/api-error'

export const dynamic = 'force-dynamic'

// C1 (Broken Function Level Authorization) guardrails:
// - unauthenticated callers: 401 (handled here and by middleware.ts)
// - non-admin callers may only read their own role
// - only admins may write roles, and never their own (no self-promote / self-demote)

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request)
    if (!caller) return unauthorized()

    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (user_id && user_id === caller.user.id) {
      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle()
      if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
      return NextResponse.json(data)
    }

    if (!isAdminCaller(caller)) {
      return forbidden('Hanya admin yang dapat melihat role pengguna lain')
    }

    const query = supabaseAdmin.from('user_roles').select('*')
    const { data, error } = user_id ? await query.eq('user_id', user_id).maybeSingle() : await query
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const caller = await getCaller(request)
    if (!caller) return unauthorized()
    if (!isAdminCaller(caller)) {
      return forbidden('Hanya admin yang dapat mengubah role pengguna')
    }

    const body = await request.json()
    const { user_id, role, station_id } = body
    if (!user_id || !role) return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 })
    if (!ASSIGNABLE_ROLES.has(String(role))) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }
    if (String(user_id) === caller.user.id) {
      return forbidden('Tidak dapat mengubah role sendiri. Minta admin lain untuk mengubah role Anda.')
    }
    if (String(role) === 'user_station' && !station_id) {
      return NextResponse.json({ error: 'Untuk role user_station, wajib memilih stasiun' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id, role, station_id: station_id ?? null }, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to upsert user role' }, { status: 500 })
  }
}
