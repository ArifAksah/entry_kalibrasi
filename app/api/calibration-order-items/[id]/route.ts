import { NextRequest, NextResponse } from 'next/server'
import { requireCaller, isAdminCaller, forbidden, notFound } from '@/lib/api-auth'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/calibration-order-items/[id]
 * Menghapus identifikasi yang salah dibuat (mis. terklik dua kali).
 * Hanya boleh bila item belum dipakai turunannya (tanpa sertifikat & surat);
 * nomor identifikasi TIDAK dipakai ulang (lihat last_identification_sequence).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const itemId = Number((await params).id)
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })
  }

  const { data: item } = await supabase
    .from('calibration_order_items')
    .select('id, order_id, status, certificate(id), letter(id)')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) return notFound('Item tidak ditemukan')

  const { data: order } = await supabase
    .from('calibration_orders')
    .select('created_by')
    .eq('id', (item as any).order_id)
    .maybeSingle()

  const isOwner = caller.role === 'calibrator' && order?.created_by === caller.user.id
  if (!isAdminCaller(caller) && !isOwner) return forbidden()

  const hasCertificate = Array.isArray((item as any).certificate)
    ? (item as any).certificate.length > 0
    : Boolean((item as any).certificate)
  const hasLetter = Array.isArray((item as any).letter)
    ? (item as any).letter.length > 0
    : Boolean((item as any).letter)

  if (hasCertificate || hasLetter) {
    return NextResponse.json(
      {
        error:
          'Identifikasi ini sudah punya sertifikat/surat, jadi tidak bisa dihapus. Gunakan "Tidak Dipakai" bila memang tidak digunakan.',
      },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('calibration_order_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
