import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { authenticateRequest, getUserRole } from '../../../../lib/certificate-access'
import { clientSafeMessage } from '../../../../lib/api-error'
import { isRegisteredAdapter } from '../../../../lib/calibration-method-profiles'

async function adminOnly(request: NextRequest) {
  const { user, error } = await authenticateRequest(request)
  if (error || !user) return { error: error || 'Unauthorized', status: 401 }
  const role = await getUserRole(user.id)
  return role === 'admin' ? null : { error: 'Hanya admin yang dapat mengubah Master Metode', status: 403 }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await adminOnly(request)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
    const { id } = await context.params
    const body = await request.json()
    if (!isRegisteredAdapter(body.instrument_scope, String(body.adapter_id || ''))) {
      return NextResponse.json({ error: 'Adapter metode belum terdaftar di sistem' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('calibration_method_profiles')
      .update({
        name: String(body.name || '').trim(),
        source_documents: Array.isArray(body.source_documents) ? body.source_documents : [],
        adapter_id: String(body.adapter_id),
        rules: body.rules && typeof body.rules === 'object' ? body.rules : {},
        effective_from: body.effective_from,
        effective_until: body.effective_until || null,
        is_active: body.is_active !== false,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: clientSafeMessage(error) || 'Gagal memperbarui Master Metode' }, { status: 500 })
  }
}
