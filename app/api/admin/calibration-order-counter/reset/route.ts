import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/calibration-order-counter/reset
 * Body: { numbering_year, calibration_place, mode, value?, reason? }
 * mode: 'reset_unused_scope' | 'set_next_value' | 'skip_range'
 * Hard reset aman: tidak boleh mendaur ulang nomor yang sudah dipakai.
 */
export async function POST(request: NextRequest) {
  const caller = await requireAdmin(request)
  if (caller instanceof NextResponse) return caller

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 })
  }

  const year = Number(body?.numbering_year)
  const place = String(body?.calibration_place || '').toUpperCase()
  const mode = String(body?.mode || '')

  if (!Number.isFinite(year)) return NextResponse.json({ error: 'numbering_year wajib' }, { status: 400 })
  if (!['FC', 'LC'].includes(place)) return NextResponse.json({ error: 'calibration_place harus FC/LC' }, { status: 400 })
  if (!['reset_unused_scope', 'set_next_value', 'skip_range'].includes(mode)) {
    return NextResponse.json({ error: 'mode tidak valid' }, { status: 400 })
  }
  if (mode !== 'reset_unused_scope' && !body?.reason) {
    return NextResponse.json({ error: 'reason wajib untuk mode ini' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('admin_reset_order_counter', {
    p_year: year,
    p_place: place,
    p_mode: mode,
    p_value: body?.value != null ? Number(body.value) : null,
    p_reason: body?.reason ?? null,
    p_actor: caller.user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
