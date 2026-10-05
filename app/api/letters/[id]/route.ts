import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientSafeMessage } from '../../../../lib/api-error'
import { requireCaller } from '../../../../lib/api-auth'
import { fetchLetterResults, canAccessLetter, saveLetterResults } from '../../../../lib/letter-service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('letter')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    if (!(await canAccessLetter(caller.user.id, caller.role, data))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const results = await fetchLetterResults(Number(id))
    return NextResponse.json({ ...data, results })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch letter' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { id } = await params
    const { data: existingLetter } = await supabaseAdmin
      .from('letter')
      .select('created_by, calibration_order_id')
      .eq('id', Number(id))
      .maybeSingle()
    if (!(await canAccessLetter(caller.user.id, caller.role, existingLetter))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const body = await request.json()
    const { no_letter, instrument, owner, issue_date, inspection_result, authorized_by } = body

    if (instrument) {
      const { data: inst, error: instErr } = await supabaseAdmin
        .from('instrument')
        .select('id')
        .eq('id', instrument)
        .single()
      if (instErr || !inst) return NextResponse.json({ error: 'Invalid instrument id' }, { status: 400 })
    }
    if (owner) {
      const { data: st, error: stErr } = await supabaseAdmin
        .from('station')
        .select('id')
        .eq('id', owner)
        .single()
      if (stErr || !st) return NextResponse.json({ error: 'Invalid owner (station) id' }, { status: 400 })
    }
    if (inspection_result) {
      const { data: insr, error: insrErr } = await supabaseAdmin
        .from('inspection_results')
        .select('id')
        .eq('id', inspection_result)
        .single()
      if (insrErr || !insr) return NextResponse.json({ error: 'Invalid inspection_result id' }, { status: 400 })
    }
    if (authorized_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', authorized_by)
        .single()
      if (pErr || !p) return NextResponse.json({ error: 'Invalid authorized_by (personel) id' }, { status: 400 })
    }

    const update = {
      no_letter: no_letter ?? null,
      instrument: instrument != null ? Number(instrument) : null,
      owner: owner != null ? Number(owner) : null,
      issue_date: issue_date || null,
      inspection_result: inspection_result || null,
      authorized_by: authorized_by || null,
      ...(body.inspection_date !== undefined ? { inspection_date: body.inspection_date || null } : {}),
      ...(body.inspection_place !== undefined ? { inspection_place: body.inspection_place || null } : {}),
      ...(body.reference_document !== undefined ? { reference_document: body.reference_document || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.verifikator_1 !== undefined ? { verifikator_1: body.verifikator_1 || null } : {}),
      ...(body.verifikator_2 !== undefined ? { verifikator_2: body.verifikator_2 || null } : {}),
      ...(body.verifikator_3 !== undefined ? { verifikator_3: body.verifikator_3 || null } : {}),
      ...(body.status !== undefined ? { status: body.status || 'draft' } : {}),
    }

    const { data, error } = await supabaseAdmin
      .from('letter')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })

    await saveLetterResults(Number(id), body.results)
    return NextResponse.json({ ...data, results: await fetchLetterResults(Number(id)) })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update letter' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { id } = await params
    const { data: existingLetter } = await supabaseAdmin
      .from('letter')
      .select('created_by, calibration_order_id')
      .eq('id', Number(id))
      .maybeSingle()
    if (!(await canAccessLetter(caller.user.id, caller.role, existingLetter))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('letter')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete letter' }, { status: 500 })
  }
}











