import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  canAccessDocumentAssignment,
  getDocumentAssignment,
} from '@/lib/document-assignment-service'
import { isUserInCalibrationOrderTeam } from '@/lib/certificate-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  const itemId = Number((await params).id)
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

  const access = await canAccessDocumentAssignment(caller.user.id, caller.role, itemId)
  if (!access.allowed) return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })

  const assignment = await getDocumentAssignment(itemId)
  return NextResponse.json({
    data: assignment,
    can_edit:
      !assignment?.locked_at &&
      (caller.role === 'admin' ||
        (caller.role === 'calibrator' && access.orderId != null &&
          await isUserInCalibrationOrderTeam(caller.user.id, access.orderId))),
    can_lock: caller.role === 'admin' || caller.role === 'calibrator',
    can_revise: caller.role === 'admin' && Boolean(assignment?.locked_at),
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  const itemId = Number((await params).id)
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  if (caller.role !== 'admin' && caller.role !== 'calibrator') {
    return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
  }

  const access = await canAccessDocumentAssignment(caller.user.id, caller.role, itemId)
  if (!access.allowed) return NextResponse.json({ error: 'Order ini bukan milik tim Anda' }, { status: 403 })
  const body = await request.json()

  const { error } = await supabaseAdmin.rpc('save_order_item_document_assignment', {
    p_data: {
      calibration_order_item_id: itemId,
      actor_id: caller.user.id,
      checked_by_ids: Array.isArray(body.checked_by_ids) ? body.checked_by_ids : [],
      verifikator_1: body.verifikator_1,
      verifikator_2: body.verifikator_2,
      verifikator_3: body.verifikator_3,
      authorized_by: body.authorized_by,
    },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: await getDocumentAssignment(itemId) })
}
