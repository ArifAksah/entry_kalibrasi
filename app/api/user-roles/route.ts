import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const query = supabaseAdmin.from('user_roles').select('*')
    const { data, error } = user_id ? await query.eq('user_id', user_id).maybeSingle() : await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, role, station_id } = body
    if (!user_id || !role) return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 })
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id, role, station_id: station_id ?? null }, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to upsert user role' }, { status: 500 })
  }
}




