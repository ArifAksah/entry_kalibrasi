import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireCaller, isAdminCaller } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stations/[id]/calibration-orders?status=active
 * Mengembalikan order untuk station tertentu + item yang belum ter-link sertifikat.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const stationId = Number(id)
  if (!Number.isFinite(stationId)) {
    return NextResponse.json({ error: 'id stasiun tidak valid' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') || 'active'

  let query = supabase
    .from('calibration_orders')
    .select(
      'id, numbering_year, order_number, no_order, station_id, planned_date, planned_end_date, calibration_place, status, created_at',
    )
    .eq('station_id', stationId)
    .order('created_at', { ascending: false })

  if (statusFilter === 'active') {
    query = query.in('status', ['booked', 'in_progress'])
  } else if (statusFilter !== 'all') {
    query = query.in('status', statusFilter.split(',').map((s) => s.trim()))
  }

  // Non-admin: hanya order yang dia buat atau dia assign. Order lain tidak
  // boleh dipakai untuk membuat/mengerjakan sertifikat.
  if (!isAdminCaller(caller)) {
    const [{ data: assigned }, { data: created }] = await Promise.all([
      supabase
        .from('calibration_order_personnel')
        .select('order_id')
        .eq('personel_id', caller.user.id),
      supabase
        .from('calibration_orders')
        .select('id')
        .eq('created_by', caller.user.id),
    ])
    const allowed = new Set<number>()
    ;(assigned || []).forEach((r: any) => {
      const n = Number(r.order_id)
      if (Number.isFinite(n)) allowed.add(n)
    })
    ;(created || []).forEach((r: any) => {
      const n = Number(r.id)
      if (Number.isFinite(n)) allowed.add(n)
    })
    if (allowed.size === 0) return NextResponse.json({ data: [] })
    query = query.in('id', Array.from(allowed))
  }

  const { data: orders, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orderIds = (orders || []).map((o: any) => o.id)
  let items: any[] = []
  if (orderIds.length) {
    const { data: itemRows } = await supabase
      .from('calibration_order_items')
      .select('id, order_id, no_identification, instrument_id, instrument_code, status, certificate(id)')
      .in('order_id', orderIds)
      .order('identification_sequence', { ascending: true })
    items = itemRows || []
  }

  // Kelompokkan item per order dan tandai yang sudah ter-link sertifikat.
  const itemsByOrder = new Map<number, any[]>()
  for (const it of items) {
    const linked = Array.isArray((it as any).certificate)
      ? (it as any).certificate.length > 0
      : !!(it as any).certificate
    const list = itemsByOrder.get(it.order_id) || []
    list.push({
      id: it.id,
      no_identification: it.no_identification,
      instrument_id: it.instrument_id,
      instrument_code: it.instrument_code,
      status: it.status,
      has_certificate: linked,
    })
    itemsByOrder.set(it.order_id, list)
  }

  const data = (orders || []).map((o: any) => ({
    ...o,
    items: itemsByOrder.get(o.id) || [],
  }))

  return NextResponse.json({ data })
}
