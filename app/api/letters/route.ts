import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireCaller } from '../../../lib/api-auth'
import {
  saveLetterResults,
  fetchLetterResults,
  resolveLetterContext,
  accessibleOrderIds,
  canReferenceCertificate,
} from '../../../lib/letter-service'

export async function GET(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { data, error } = await supabaseAdmin
      .from('letter')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    const list = Array.isArray(data) ? data : []
    if (caller.role !== 'admin') {
      const orderIds = await accessibleOrderIds(caller.user.id)
      const visible = list.filter(
        (l: any) =>
          (l.created_by && l.created_by === caller.user.id) ||
          (l.calibration_order_id && orderIds.includes(Number(l.calibration_order_id))),
      )
      return NextResponse.json(visible)
    }
    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch letters' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const body = await request.json()
    const ctx = await resolveLetterContext(body)

    // Batasi: sertifikat sumber harus milik tim/pihak terkait user (kecuali admin).
    if (body.certificate_id) {
      const { data: cert } = await supabaseAdmin
        .from('certificate')
        .select('id, created_by, verifikator_1, verifikator_2, verifikator_3, authorized_by, sent_by, assignor, calibration_order_id')
        .eq('id', Number(body.certificate_id))
        .maybeSingle()
      if (!(await canReferenceCertificate(caller.user.id, caller.role, cert))) {
        return NextResponse.json(
          { error: 'Sertifikat bukan milik tim Anda' },
          { status: 403 },
        )
      }
    }

    const header = {
      certificate_id: body.certificate_id ? Number(body.certificate_id) : null,
      calibration_order_id:
        body.calibration_order_id != null ? Number(body.calibration_order_id) : ctx.orderId ?? null,
      calibration_order_item_id: ctx.itemId ?? null,
      sensor: body.sensor ? Number(body.sensor) : null,
      no_letter: body.no_letter ?? ctx.noLetter ?? null,
      no_order: body.no_order ?? ctx.noOrder ?? null,
      no_identification: body.no_identification ?? ctx.noIdentification ?? null,
      instrument: body.instrument != null ? Number(body.instrument) : ctx.instrument ?? null,
      owner: body.owner != null ? Number(body.owner) : ctx.owner ?? null,
      issue_date: body.issue_date || null,
      inspection_date: body.inspection_date || null,
      inspection_place: body.inspection_place || null,
      reference_document: body.reference_document || null,
      notes: body.notes || null,
      authorized_by: body.authorized_by || ctx.authorizedBy || null,
      verifikator_1: body.verifikator_1 || ctx.v1 || null,
      verifikator_2: body.verifikator_2 || ctx.v2 || null,
      verifikator_3: body.verifikator_3 || ctx.v3 || null,
      status: body.status || 'draft',
      created_by: body.created_by || caller.user.id,
    }

    const { data, error } = await supabaseAdmin
      .from('letter')
      .insert(header)
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })

    await saveLetterResults(data.id, body.results)
    return NextResponse.json(
      { ...data, results: await fetchLetterResults(data.id) },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create letter' }, { status: 500 })
  }
}
