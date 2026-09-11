import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../lib/api-auth'
import { clientSafeMessage } from '../../../lib/api-error'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const q = supabaseAdmin.from('role_endpoint_permissions').select('*, endpoint_catalog(*)')
    const { data, error } = role ? await q.eq('role', role) : await q
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch role endpoint permissions' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Only admins may modify role↔endpoint permissions.
    const adminGate = await requireAdmin(request)
    if (adminGate instanceof NextResponse) return adminGate

    const body = await request.json()
    const rows = Array.isArray(body) ? body : [body]
    const { data, error } = await supabaseAdmin.from('role_endpoint_permissions').upsert(rows, { onConflict: 'role,endpoint_id' }).select()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to upsert role endpoint permissions' }, { status: 500 })
  }
}



