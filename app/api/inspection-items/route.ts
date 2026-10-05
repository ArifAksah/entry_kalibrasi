import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireCaller, requireRoles } from '../../../lib/api-auth'

export async function GET(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { searchParams } = new URL(request.url)
    const nameId = searchParams.get('instrument_name_id')
    let query = supabaseAdmin
      .from('inspection_items')
      .select('*')
      .order('sort_order', { ascending: true })
    if (nameId) query = query.eq('instrument_name_id', Number(nameId))
    const { data, error } = await query
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch inspection items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate
  try {
    const body = await request.json()
    if (!body?.parameter) {
      return NextResponse.json({ error: 'parameter wajib diisi' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('inspection_items')
      .insert({
        instrument_name_id: body.instrument_name_id ? Number(body.instrument_name_id) : null,
        section: body.section || null,
        parameter: String(body.parameter).trim(),
        sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        is_active: body.is_active !== false,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create inspection item' }, { status: 500 })
  }
}
