import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/calibration-order-counter
 * Query: year?, place?
 * Melihat counter nomor order + preview nomor berikutnya + nomor terpakai.
 */
export async function GET(request: NextRequest) {
  const caller = await requireAdmin(request)
  if (caller instanceof NextResponse) return caller

  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const place = searchParams.get('place')

  let q = supabase.from('calibration_order_counters').select('*').order('numbering_year', { ascending: false })
  if (year) q = q.eq('numbering_year', Number(year))
  if (place) q = q.eq('calibration_place', place.toUpperCase())

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nomor terpakai tertinggi (untuk guard UI hard reset)
  const { data: maxOrders } = await supabase
    .from('calibration_orders')
    .select('numbering_year, calibration_place, order_number')

  const mustMax = new Map<string, number>()
  for (const row of maxOrders || []) {
    const key = `${row.numbering_year}:${row.calibration_place}`
    mustMax.set(key, Math.max(mustMax.get(key) || 0, Number(row.order_number) || 0))
  }

  const counters = (data || []).map((c: any) => ({
    ...c,
    next_order_number: String((c.last_value || 0) + 1).padStart(3, '0'),
    max_used: mustMax.get(`${c.numbering_year}:${c.calibration_place}`) || 0,
  }))

  return NextResponse.json({ data: counters })
}
