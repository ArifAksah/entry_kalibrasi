import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  canAccessDocumentAssignment,
  getDocumentAssignment,
} from '@/lib/document-assignment-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  if (caller.role !== 'admin' && caller.role !== 'calibrator') {
    return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
  }

  const itemId = Number((await params).id)
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  const access = await canAccessDocumentAssignment(caller.user.id, caller.role, itemId)
  if (!access.allowed) return NextResponse.json({ error: 'Order ini bukan milik tim Anda' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const source = ['certificate_submission', 'letter_finalization'].includes(body.source)
    ? body.source
    : 'certificate_submission'
  const { error } = await supabaseAdmin.rpc('lock_order_item_document_assignment', {
    p_item_id: itemId,
    p_actor: caller.user.id,
    p_source: source,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: await getDocumentAssignment(itemId) })
}
