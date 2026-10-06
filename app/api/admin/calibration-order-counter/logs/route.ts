import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/calibration-order-counter/logs — riwayat reset/repair counter */
export async function GET(request: NextRequest) {
  const caller = await requireAdmin(request)
  if (caller instanceof NextResponse) return caller

  const { searchParams } = new URL(request.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  const { data, error } = await supabase
    .from('calibration_order_counter_logs')
    .select('*')
    .order('performed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
