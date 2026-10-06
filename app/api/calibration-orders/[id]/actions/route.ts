import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireCaller, isAdminCaller, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

type Action = 'confirm' | 'postpone' | 'resume' | 'start' | 'cancel' | 'complete'

/**
 * POST /api/calibration-orders/[id]/actions
 * Body: { action, planned_date?, planned_end_date?, reason? }
 * Lifecycle:
 *   draft      --confirm---> booked (alokasi no_order)
 *   booked     --postpone--> postponed
 *   postponed  --resume----> booked
 *   booked/postponed --start--> in_progress
 *   *          --cancel----> cancelled   (nomor tetap, tidak dipakai ulang)
 *   in_progress --complete-> completed
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 })
  }

  const action = String(body?.action || '') as Action
  const allowed: Action[] = ['confirm', 'postpone', 'resume', 'start', 'cancel', 'complete']
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: `action tidak dikenal: ${action}` }, { status: 400 })
  }

  const { data: order } = await supabase
    .from('calibration_orders')
    .select('id, status, created_by, planned_date, planned_end_date, no_order')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return notFound('Order tidak ditemukan')

  // Wewenang: admin, atau calibrator pembuat order.
  const isOwner = caller.role === 'calibrator' && order.created_by === caller.user.id
  if (action === 'confirm') {
    if (!isOwner && !isAdminCaller(caller)) {
      return forbidden('Hanya Petugas Kalibrasi pembuat draft atau admin yang dapat mengonfirmasi booking')
    }
    const { data, error } = await supabase.rpc('confirm_calibration_order', {
      p_order_id: orderId,
      p_actor: caller.user.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data })
  }

  if (!isAdminCaller(caller) && !isOwner && action !== 'cancel') {
    // cancel tetap dibatasi ke admin/pembuat juga
    return forbidden()
  }
  if (!isAdminCaller(caller) && !isOwner) return forbidden()

  const nowIso = new Date().toISOString()
  let patch: Record<string, any> = {}
  let history: Record<string, any> | null = null

  switch (action) {
    case 'postpone': {
      if (!['booked', 'postponed'].includes(order.status)) {
        return NextResponse.json({ error: `Order berstatus ${order.status} tidak dapat ditunda` }, { status: 409 })
      }
      const newDate = body?.planned_date
      const newEndDate = body?.planned_end_date
      if (!newDate || !newEndDate) {
        return NextResponse.json({ error: 'Tanggal mulai dan selesai wajib untuk penundaan' }, { status: 400 })
      }
      if (newEndDate < newDate) {
        return NextResponse.json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' }, { status: 400 })
      }
      history = {
        order_id: orderId,
        old_planned_date: order.planned_date,
        new_planned_date: newDate,
        old_planned_end_date: order.planned_end_date,
        new_planned_end_date: newEndDate,
        reason: body?.reason ?? null,
        changed_by: caller.user.id,
      }
      patch = {
        status: 'postponed',
        planned_date: newDate,
        planned_end_date: newEndDate,
        postponed_at: nowIso,
      }
      break
    }
    case 'resume': {
      if (order.status !== 'postponed') {
        return NextResponse.json({ error: 'Hanya order postponed yang dapat dilanjutkan' }, { status: 409 })
      }
      patch = { status: 'booked' }
      break
    }
    case 'start': {
      if (!['booked', 'postponed'].includes(order.status)) {
        return NextResponse.json({ error: `Order berstatus ${order.status} tidak dapat dimulai` }, { status: 409 })
      }
      patch = { status: 'in_progress', started_at: nowIso }
      break
    }
    case 'cancel': {
      if (order.status === 'cancelled') {
        return NextResponse.json({ error: 'Order sudah dibatalkan' }, { status: 409 })
      }
      if (order.status === 'completed') {
        return NextResponse.json({ error: 'Order yang sudah selesai tidak dapat dibatalkan' }, { status: 409 })
      }
      patch = {
        status: 'cancelled',
        cancelled_at: nowIso,
        cancellation_reason: body?.reason ?? null,
      }
      break
    }
    case 'complete': {
      if (order.status !== 'in_progress') {
        return NextResponse.json({ error: 'Hanya order in_progress yang dapat diselesaikan' }, { status: 409 })
      }

      const { data: itemRows, error: itemError } = await supabase
        .from('calibration_order_items')
        .select('id, no_identification, status, certificate(status)')
        .eq('order_id', orderId)
        .order('identification_sequence', { ascending: true })

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 })
      }
      if (!itemRows || itemRows.length === 0) {
        return NextResponse.json(
          { error: 'Order belum memiliki alat/identifikasi dan tidak dapat diselesaikan' },
          { status: 409 },
        )
      }

      const blockers: string[] = []
      for (const item of itemRows as any[]) {
        const certificate = Array.isArray(item.certificate)
          ? item.certificate[0] ?? null
          : item.certificate ?? null
        if (certificate?.status === 'completed' && item.status !== 'completed') {
          await supabase
            .from('calibration_order_items')
            .update({ status: 'completed' })
            .eq('id', item.id)
          continue
        }
        if (!['completed', 'void'].includes(item.status)) {
          blockers.push(`${item.no_identification} (${item.status})`)
        }
      }

      if (blockers.length > 0) {
        return NextResponse.json(
          {
            error:
              'Order belum dapat diselesaikan. Setiap identifikasi harus memiliki sertifikat completed atau berstatus void.',
            blockers,
          },
          { status: 409 },
        )
      }
      patch = { status: 'completed', completed_at: nowIso }
      break
    }
  }

  const { error } = await supabase.from('calibration_orders').update(patch).eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (history) {
    await supabase.from('calibration_order_schedule_history').insert(history)
  }

  const { data: updated } = await supabase
    .from('calibration_orders')
    .select('id, no_order, status, planned_date, planned_end_date')
    .eq('id', orderId)
    .maybeSingle()

  return NextResponse.json({ data: updated })
}
