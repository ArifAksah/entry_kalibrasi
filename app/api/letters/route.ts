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
import { createLetterLog } from '../../../lib/letter-log-helper'

export async function GET(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const status = (searchParams.get('status') || 'all').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 10),
    )

    // Scoping (non-admin): hanya surat buatan sendiri atau dari order timnya.
    let scopeClause: string | null = null
    if (caller.role !== 'admin') {
      const orderIds = await accessibleOrderIds(caller.user.id)
      const parts = [`created_by.eq.${caller.user.id}`]
      if (orderIds.length) parts.push(`calibration_order_id.in.(${orderIds.join(',')})`)
      scopeClause = parts.join(',')
    }

    // Pencarian teks: kolom surat + instrumen + pemilik (nama instrumen/stasiun
    // di-resolve dulu jadi daftar id agar bisa disaring di query).
    let searchClause: string | null = null
    if (q) {
      const safe = q.replace(/[,()%*]/g, ' ').trim()
      if (safe) {
        const [{ data: inst }, { data: st }] = await Promise.all([
          supabaseAdmin
            .from('instrument')
            .select('id')
            .or(
              `name_alias.ilike.%${safe}%,type.ilike.%${safe}%,serial_number.ilike.%${safe}%`,
            )
            .limit(500),
          supabaseAdmin.from('station').select('id').ilike('name', `%${safe}%`).limit(500),
        ])
        const parts = [
          `no_letter.ilike.%${safe}%`,
          `no_order.ilike.%${safe}%`,
          `no_identification.ilike.%${safe}%`,
        ]
        const instIds = (inst || []).map((i: any) => i.id)
        const stIds = (st || []).map((s: any) => s.id)
        if (instIds.length) parts.push(`instrument.in.(${instIds.join(',')})`)
        if (stIds.length) parts.push(`owner.in.(${stIds.join(',')})`)
        searchClause = parts.join(',')
      }
    }

    let query = supabaseAdmin.from('letter').select('*', { count: 'exact' })
    if (status && status !== 'all') query = query.eq('status', status)
    if (scopeClause) query = query.or(scopeClause)
    if (searchClause) query = query.or(searchClause)

    const from = (page - 1) * pageSize
    query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })

    const total = count ?? (Array.isArray(data) ? data.length : 0)
    return NextResponse.json({
      data: Array.isArray(data) ? data : [],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
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
      included_sensor_ids: Array.isArray(body.included_sensor_ids)
        ? body.included_sensor_ids
        : null,
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

    await createLetterLog({
      letter_id: data.id,
      action: 'created',
      performed_by: caller.user.id,
      new_status: 'draft',
      notes: 'Surat Keterangan dibuat',
    })

    return NextResponse.json(
      { ...data, results: await fetchLetterResults(data.id) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: 'Gagal membuat Surat Keterangan' }, { status: 500 })
  }
}
