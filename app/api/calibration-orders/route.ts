import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCaller, requireRoles, isAdminCaller, forbidden } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const ORDER_SELECT =
  'id, numbering_year, order_number, no_order, station_id, station_address_snapshot, ' +
  'planned_date, planned_end_date, calibration_place, status, notes, created_by, confirmed_at, started_at, ' +
  'completed_at, postponed_at, cancelled_at, cancellation_reason, created_at, updated_at, ' +
  'calibration_order_items(id, no_identification, instrument_id, instrument_code, status)'

/**
 * GET /api/calibration-orders
 * Query: station_id, status (comma list), year, place, q, page, pageSize
 * - admin melihat semua
 * - calibrator melihat semua (agar bisa memilih order saat input sertifikat)
 * - role lain hanya order pada station yang ditugaskan (user_stations)
 */
export async function GET(request: NextRequest) {
  const caller = await requireRoles(request, ['admin', 'calibrator', 'verifikator', 'assignor', 'user_station'])
  if (caller instanceof NextResponse) return caller

  const { searchParams } = new URL(request.url)
  const stationId = searchParams.get('station_id')
  const status = searchParams.get('status')
  const year = searchParams.get('year')
  const place = searchParams.get('place')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabaseAdmin
    .from('calibration_orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (stationId) query = query.eq('station_id', Number(stationId))
  if (year) {
    const yearNumber = Number(year)
    if (Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 9999) {
      // Draft belum memiliki numbering_year sampai dikonfirmasi. Agar draft
      // tetap muncul pada filter tahun, gunakan planned_date sebagai scope-nya.
      query = query.or(
        `numbering_year.eq.${yearNumber},and(numbering_year.is.null,planned_date.gte.${yearNumber}-01-01,planned_date.lt.${yearNumber + 1}-01-01)`,
      )
    }
  }
  if (place) query = query.eq('calibration_place', place.toUpperCase())
  if (status) {
    const list = status.split(',').map((s) => s.trim()).filter(Boolean)
    if (list.length) query = query.in('status', list)
  }

  // Batasi daftar order: non-admin hanya melihat order yang dia BUAT
  // (created_by) atau yang dia ASSIGN (calibration_order_personnel).
  // Admin melihat semua. Detail order tetap bisa dibuka oleh kalibrator.
  if (!isAdminCaller(caller)) {
    const [{ data: assignedRows }, { data: createdRows }] = await Promise.all([
      supabaseAdmin
        .from('calibration_order_personnel')
        .select('order_id')
        .eq('personel_id', caller.user.id),
      supabaseAdmin
        .from('calibration_orders')
        .select('id')
        .eq('created_by', caller.user.id),
    ])

    const allowedOrderIds = new Set<number>()
    ;(assignedRows || []).forEach((row: any) => {
      const n = Number(row.order_id)
      if (Number.isFinite(n)) allowedOrderIds.add(n)
    })
    ;(createdRows || []).forEach((row: any) => {
      const n = Number(row.id)
      if (Number.isFinite(n)) allowedOrderIds.add(n)
    })

    if (allowedOrderIds.size === 0) {
      return NextResponse.json({ data: [], page, pageSize, total: 0, totalPages: 0 })
    }
    query = query.in('id', Array.from(allowedOrderIds))
  }

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = count ?? 0
  return NextResponse.json({
    data: data || [],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

/**
 * POST /api/calibration-orders
 * Body: { station_id, planned_date, planned_end_date, calibration_place, notes?, personnel_ids? }
 * Membuat draft tanpa mengalokasikan no_order.
 * Hanya role calibrator (Petugas Kalibrasi).
 */
export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  if (caller.role !== 'calibrator') {
    return forbidden('Hanya Petugas Kalibrasi yang dapat membuat order')
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 })
  }

  const stationId = Number(body?.station_id)
  const plannedDate = body?.planned_date
  const plannedEndDate = body?.planned_end_date
  const place = String(body?.calibration_place || '').toUpperCase()

  if (!stationId) return NextResponse.json({ error: 'station_id wajib diisi' }, { status: 400 })
  if (!plannedDate) return NextResponse.json({ error: 'planned_date wajib diisi' }, { status: 400 })
  if (!plannedEndDate) return NextResponse.json({ error: 'planned_end_date wajib diisi' }, { status: 400 })
  if (plannedEndDate < plannedDate) {
    return NextResponse.json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' }, { status: 400 })
  }
  if (!['FC', 'IFC', 'LC'].includes(place)) {
    return NextResponse.json({ error: 'calibration_place harus FC, IFC, atau LC' }, { status: 400 })
  }

  const personnelIds: string[] = Array.isArray(body?.personnel_ids)
    ? body.personnel_ids.map((v: any) => String(v)).filter(Boolean)
    : []

  const { data, error } = await supabaseAdmin.rpc('create_calibration_order_draft', {
    p_data: {
      station_id: stationId,
      planned_date: plannedDate,
      planned_end_date: plannedEndDate,
      calibration_place: place,
      notes: body?.notes ?? null,
      created_by: caller.user.id,
      personnel_ids: personnelIds,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const order: any = Array.isArray(data) ? data[0] : data
  if (!order) {
    return NextResponse.json({ error: 'Gagal membuat order' }, { status: 500 })
  }

  // Catat pembuat sebagai petugas bila personnel_ids kosong.
  if (personnelIds.length === 0) {
    await supabaseAdmin
      .from('calibration_order_personnel')
      .insert({ order_id: order.id, personel_id: caller.user.id, assigned_by: caller.user.id })
  }

  return NextResponse.json({ data: order }, { status: 201 })
}
