import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { clientSafeMessage } from '../../../../lib/api-error'
import { requireRoles } from '../../../../lib/api-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate
  try {
    const { id } = await params
    const body = await request.json()
    const update: Record<string, any> = {}
    if (body.parameter !== undefined) update.parameter = String(body.parameter).trim()
    if (body.instrument_name_id !== undefined)
      update.instrument_name_id = body.instrument_name_id ? Number(body.instrument_name_id) : null
    if (body.section !== undefined) update.section = body.section || null
    if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order) || 0
    if (body.is_active !== undefined) update.is_active = body.is_active !== false

    const { data, error } = await supabaseAdmin
      .from('inspection_items')
      .update(update)
      .eq('id', Number(id))
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update inspection item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('inspection_items').delete().eq('id', Number(id))
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete inspection item' }, { status: 500 })
  }
}
