import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .select('*')
      .order('role', { ascending: true })
      .order('resource', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch role permissions' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Optional admin check: if you create user_roles table, enforce admin-only here
    // const { data: ur } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).single()
    // if (!ur || ur.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const rows = Array.isArray(body) ? body : []

    if (!rows.length) return NextResponse.json({ message: 'No changes' })

    // normalize keys to avoid reserved words
    const normalized = rows.map((r: any) => ({
      role: r.role,
      resource: r.resource,
      can_create: !!(r.can_create ?? r.create),
      can_read: !!(r.can_read ?? r.read),
      can_update: !!(r.can_update ?? r.update),
      can_delete: !!(r.can_delete ?? r.delete),
    }))

    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .upsert(normalized, { onConflict: 'role,resource' })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update role permissions' }, { status: 500 })
  }
}


