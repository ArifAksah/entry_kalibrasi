import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { authenticateRequest, getUserRole } from '../../../../lib/certificate-access'

async function requireAdmin(request: NextRequest) {
  const { user, error } = await authenticateRequest(request)
  if (error || !user) return { error: error || 'Unauthorized', status: 401 }
  const role = await getUserRole(user.id)
  if (role !== 'admin') return { error: 'Hanya admin yang dapat mengubah Master CMC', status: 403 }
  return null
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
    const { id } = await params
    const body = await request.json()
    const { data, error } = await supabaseAdmin
      .from('cmc_profiles')
      .update({
        name: body.name,
        calibration_method: body.calibration_method || null,
        source_document: body.source_document || null,
        effective_from: body.effective_from,
        effective_until: body.effective_until || null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    const values = Array.isArray(body.values) ? body.values : []
    for (const value of values) {
      const payload = {
        cmc_value: value.cmc_value,
        range_min: value.range_min === '' ? null : value.range_min,
        range_max: value.range_max === '' ? null : value.range_max,
        unit: value.unit,
        formula: value.formula || null,
        sequence: value.sequence || 1,
      }
      if (value.id) {
        const { error: valueError } = await supabaseAdmin.from('cmc_values').update(payload).eq('id', value.id)
        if (valueError) throw valueError
      } else {
        const { error: valueError } = await supabaseAdmin.from('cmc_values').insert({ ...payload, cmc_profile_id: Number(id) })
        if (valueError) throw valueError
      }
    }
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memperbarui CMC' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('cmc_profiles')
      .update({ is_active: false, effective_until: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ message: 'Profil CMC dinonaktifkan' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menonaktifkan CMC' }, { status: 500 })
  }
}
