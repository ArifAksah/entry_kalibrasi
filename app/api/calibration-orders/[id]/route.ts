import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireCaller, isAdminCaller, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const ORDER_SELECT =
  'id, numbering_year, order_number, no_order, station_id, station_address_snapshot, ' +
  'planned_date, planned_end_date, calibration_place, status, notes, created_by, confirmed_at, started_at, ' +
  'completed_at, postponed_at, cancelled_at, cancellation_reason, created_at, updated_at'

async function loadOrder(id: number) {
  const { data } = await supabase.from('calibration_orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
  return data as any
}

function canManage(callerRole: string | null, callerId: string, order: any): boolean {
  if (callerRole === 'admin') return true
  if (callerRole === 'calibrator' && order.created_by === callerId) return true
  return false
}

async function canAccessOrder(callerRole: string | null, callerId: string, order: any) {
  if (callerRole === 'admin' || order.created_by === callerId) return true
  const { data } = await supabase
    .from('calibration_order_personnel')
    .select('id')
    .eq('order_id', order.id)
    .eq('personel_id', callerId)
    .maybeSingle()
  return Boolean(data)
}

/** GET /api/calibration-orders/[id] — detail + personnel + items */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  const order = await loadOrder(orderId)
  if (!order) return notFound('Order tidak ditemukan')
  if (!(await canAccessOrder(caller.role, caller.user.id, order))) return forbidden()

  const [personnel, items, history] = await Promise.all([
    supabase
      .from('calibration_order_personnel')
      .select('id, order_id, personel_id, assigned_by, created_at, personel(name, nip)')
      .eq('order_id', orderId),
    supabase
      .from('calibration_order_items')
      .select('id, order_id, identification_sequence, no_identification, instrument_id, instrument_code, status, created_at, voided_at, void_reason, certificate(id, no_certificate, status), letter(id, no_letter, status, issue_date)')
      .eq('order_id', orderId)
      .order('identification_sequence', { ascending: true }),
    supabase
      .from('calibration_order_schedule_history')
      .select('id, old_planned_date, new_planned_date, old_planned_end_date, new_planned_end_date, reason, changed_by, changed_at')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false }),
  ])

  return NextResponse.json({
    data: {
      ...order,
      personnel: personnel.data || [],
      items: (items.data || []).map((item: any) => ({
        ...item,
        certificate: Array.isArray(item.certificate)
          ? item.certificate[0] ?? null
          : item.certificate ?? null,
        letter: Array.isArray(item.letter)
          ? item.letter[0] ?? null
          : item.letter ?? null,
        can_create_letter:
          (caller.role === 'admin' || caller.role === 'calibrator') &&
          ['booked', 'postponed', 'in_progress'].includes(order.status),
      })),
      schedule_history: history.data || [],
    },
  })
}

/** PUT /api/calibration-orders/[id] — update metadata (notes, personnel) */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  const order = await loadOrder(orderId)
  if (!order) return notFound('Order tidak ditemukan')
  if (!canManage(caller.role, caller.user.id, order)) return forbidden()

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 })
  }

  const patch: Record<string, any> = {}
  if (typeof body?.notes === 'string' || body?.notes === null) patch.notes = body.notes

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('calibration_orders').update(patch).eq('id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (Array.isArray(body?.personnel_ids)) {
    await supabase.from('calibration_order_personnel').delete().eq('order_id', orderId)
    const rows = body.personnel_ids
      .map((v: any) => String(v))
      .filter(Boolean)
      .map((pid: string) => ({ order_id: orderId, personel_id: pid, assigned_by: caller.user.id }))
    if (rows.length) {
      await supabase.from('calibration_order_personnel').insert(rows)
    }
  }

  return NextResponse.json({ data: await loadOrder(orderId) })
}

/** DELETE hanya untuk draft (admin atau pembuat). Order resmi tidak boleh dihapus. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  const order = await loadOrder(orderId)
  if (!order) return notFound('Order tidak ditemukan')
  if (!canManage(caller.role, caller.user.id, order)) return forbidden()

  if (order.status !== 'draft') {
    return NextResponse.json(
      { error: 'Hanya order berstatus draft yang dapat dihapus. Gunakan pembatalan untuk order resmi.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('calibration_orders').delete().eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
