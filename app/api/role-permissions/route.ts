import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../lib/api-auth'
import { clientSafeMessage } from '../../../lib/api-error'

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

    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch role permissions' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Only admins may modify the RBAC permission matrix.
    const adminGate = await requireAdmin(request)
    if (adminGate instanceof NextResponse) return adminGate

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

    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update role permissions' }, { status: 500 })
  }
}


