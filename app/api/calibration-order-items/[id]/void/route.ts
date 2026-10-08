import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireCaller, isAdminCaller, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/calibration-order-items/[id]/void
 * Body: { reason? }
 * Menandai item tidak dipakai. Nomor tidak dipakai ulang.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const itemId = Number(id)
  if (!Number.isFinite(itemId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  const { data: item } = await supabase
    .from('calibration_order_items')
    .select('id, order_id, status, certificate(id), letter(id)')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) return notFound('Item tidak ditemukan')
  if (item.status === 'void') return NextResponse.json({ error: 'Item sudah void' }, { status: 409 })

  const linkedCert = Array.isArray((item as any).certificate) ? (item as any).certificate.length > 0 : !!(item as any).certificate
  if (linkedCert) {
    return NextResponse.json({ error: 'Item sudah memiliki sertifikat, tidak dapat di-void' }, { status: 409 })
  }
  const linkedLetter = Array.isArray((item as any).letter)
    ? (item as any).letter.length > 0
    : Boolean((item as any).letter)
  if (linkedLetter) {
    return NextResponse.json({ error: 'Item sudah memiliki Surat Keterangan, tidak dapat di-void' }, { status: 409 })
  }

  const { data: order } = await supabase
    .from('calibration_orders')
    .select('created_by')
    .eq('id', item.order_id)
    .maybeSingle()
  const isOwner = caller.role === 'calibrator' && order?.created_by === caller.user.id
  if (!isAdminCaller(caller) && !isOwner) return forbidden()

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* optional body */
  }

  const { error } = await supabase
    .from('calibration_order_items')
    .update({ status: 'void', voided_at: new Date().toISOString(), void_reason: body?.reason ?? null })
    .eq('id', itemId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
