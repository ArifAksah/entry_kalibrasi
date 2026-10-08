import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireCaller } from '../../../lib/api-auth'
import {
  saveLetterResults,
  fetchLetterResults,
  accessibleOrderIds,
  resolveOrderItemLetterContext,
  validateOrderItemForLetter,
} from '../../../lib/letter-service'
import { isUserInCalibrationOrderTeam } from '../../../lib/certificate-access'

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
      return NextResponse.json(
        list.filter(
          (letter: any) =>
            letter.created_by === caller.user.id ||
            (letter.calibration_order_id && orderIds.includes(Number(letter.calibration_order_id))),
        ),
      )
    }
    return NextResponse.json(list)
  } catch {
    return NextResponse.json({ error: 'Gagal memuat Surat Keterangan' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  try {
    if (caller.role !== 'admin' && caller.role !== 'calibrator') {
      return NextResponse.json(
        { error: 'Hanya admin atau Petugas Kalibrasi yang dapat membuat Surat Keterangan' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const itemId = Number(body?.calibration_order_item_id)
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json(
        { error: 'Pilih nomor order dan identifikasi terlebih dahulu' },
        { status: 400 },
      )
    }

    const context = await resolveOrderItemLetterContext(itemId)
    if (!context) {
      return NextResponse.json({ error: 'Order item tidak ditemukan' }, { status: 404 })
    }
    if (
      caller.role !== 'admin' &&
      !(await isUserInCalibrationOrderTeam(caller.user.id, context.orderId))
    ) {
      return NextResponse.json(
        { error: 'Order ini bukan milik tim Anda' },
        { status: 403 },
      )
    }

    const validationError = validateOrderItemForLetter(context)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    if (context.letterId) {
      return NextResponse.json(
        { error: 'Identifikasi ini sudah memiliki Surat Keterangan' },
        { status: 409 },
      )
    }

    const header = {
      calibration_order_item_id: context.itemId,
      certificate_id: context.certificateId,
      sensor: body.sensor ? Number(body.sensor) : null,
      issue_date: body.issue_date || null,
      inspection_date: body.inspection_date || null,
      inspection_place: body.inspection_place || null,
      reference_document: body.reference_document || null,
      notes: body.notes || null,
      authorized_by: body.authorized_by || null,
      verifikator_1: body.verifikator_1 || null,
      verifikator_2: body.verifikator_2 || null,
      verifikator_3: body.verifikator_3 || null,
      status: 'draft',
      created_by: caller.user.id,
    }

    const { data, error } = await supabaseAdmin
      .from('letter')
      .insert(header)
      .select()
      .single()
    if (error) {
      const duplicate = error.code === '23505'
      return NextResponse.json(
        { error: duplicate ? 'Identifikasi ini sudah memiliki Surat Keterangan' : clientSafeMessage(error) },
        { status: duplicate ? 409 : 400 },
      )
    }

    await saveLetterResults(data.id, body.results)
    return NextResponse.json(
      { ...data, results: await fetchLetterResults(data.id) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: 'Gagal membuat Surat Keterangan' }, { status: 500 })
  }
}
