import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { authenticateRequest, getUserRole } from '../../../lib/certificate-access'
import { clientSafeMessage } from '../../../lib/api-error'
import { isRegisteredAdapter } from '../../../lib/calibration-method-profiles'

const scopes = new Set(['pyranometer', 'raw_general', 'tipping_bucket'])

async function adminOnly(request: NextRequest) {
  const { user, error } = await authenticateRequest(request)
  if (error || !user) return { error: error || 'Unauthorized', status: 401 }
  const role = await getUserRole(user.id)
  return role === 'admin' ? null : { error: 'Hanya admin yang dapat mengubah Master Metode', status: 403 }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('calibration_method_profiles')
      .select('*')
      .order('instrument_scope')
      .order('code')
      .order('version', { ascending: false })
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: clientSafeMessage(error) || 'Gagal memuat Master Metode' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await adminOnly(request)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
    const body = await request.json()
    if (!body.code?.trim() || !body.name?.trim() || !scopes.has(body.instrument_scope) || !isRegisteredAdapter(body.instrument_scope, String(body.adapter_id || ''))) {
      return NextResponse.json({ error: 'Kode, nama, dan scope metode wajib diisi' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('calibration_method_profiles')
      .insert({
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        instrument_scope: body.instrument_scope,
        adapter_id: String(body.adapter_id),
        version: Number(body.version || 1),
        source_documents: Array.isArray(body.source_documents) ? body.source_documents : [],
        rules: body.rules && typeof body.rules === 'object' ? body.rules : {},
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        effective_until: body.effective_until || null,
        is_active: body.is_active !== false,
        notes: body.notes || null,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: clientSafeMessage(error) || 'Gagal menyimpan Master Metode' }, { status: 500 })
  }
}
