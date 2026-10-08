import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '../../../lib/api-auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { accessibleOrderIds } from '../../../lib/letter-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  if (caller.role !== 'admin' && caller.role !== 'calibrator') {
    return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('calibration_order_items')
    .select(
      'id, order_id, no_identification, instrument_id, instrument_code, status, calibration_orders!inner(id, no_order, status, calibration_place, station_id, station(name)), instrument(id, name_alias, type, manufacturer, serial_number, names), letter(id, no_letter, status)',
    )
    .neq('status', 'void')
    .in('calibration_orders.status', ['booked', 'postponed', 'in_progress'])
    .not('calibration_orders.no_order', 'is', null)
    .order('created_at', { ascending: false })

  if (caller.role !== 'admin') {
    const orderIds = await accessibleOrderIds(caller.user.id)
    if (orderIds.length === 0) return NextResponse.json({ data: [] })
    query = query.in('order_id', orderIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []).map((item: any) => {
    const order = Array.isArray(item.calibration_orders)
      ? item.calibration_orders[0]
      : item.calibration_orders
    const instrument = Array.isArray(item.instrument) ? item.instrument[0] : item.instrument
    const letter = Array.isArray(item.letter) ? item.letter[0] ?? null : item.letter ?? null
    const station = Array.isArray(order?.station) ? order.station[0] : order?.station
    return {
      id: item.id,
      order_id: item.order_id,
      no_order: order?.no_order ?? null,
      no_identification: item.no_identification,
      calibration_place: order?.calibration_place ?? null,
      instrument_id: item.instrument_id,
      instrument_code: item.instrument_code,
      instrument_name_id: instrument?.names ?? null,
      instrument_name: instrument?.name_alias || instrument?.type || `Instrumen #${item.instrument_id}`,
      manufacturer: instrument?.manufacturer ?? null,
      serial_number: instrument?.serial_number ?? null,
      station_name: station?.name ?? null,
      letter,
    }
  })

  return NextResponse.json({ data: rows })
}
