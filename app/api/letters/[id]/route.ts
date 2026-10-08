import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientSafeMessage } from '../../../../lib/api-error'
import { requireCaller, isRenderAuthorizedFor } from '../../../../lib/api-auth'
import { fetchLetterResults, canAccessLetter, saveLetterResults } from '../../../../lib/letter-service'
import { getDocumentAssignment } from '@/lib/document-assignment-service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** Data tampilan (alat, pemilik, penandatangan, sensor) untuk view/print. */
async function loadLetterDisplayData(letter: any) {
  const [instrumentRes, ownerRes, authorizedRes, sensorsRes] = await Promise.all([
    letter?.instrument
      ? supabaseAdmin
          .from('instrument')
          .select('id, name_alias, manufacturer, type, serial_number, others')
          .eq('id', letter.instrument)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    letter?.owner
      ? supabaseAdmin
          .from('station')
          .select('id, name, address')
          .eq('id', letter.owner)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    letter?.authorized_by
      ? supabaseAdmin
          .from('personel')
          .select('id, name, signer_title')
          .eq('id', letter.authorized_by)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    letter?.instrument
      ? supabaseAdmin
          .from('sensor')
          .select('id, name, manufacturer, type, serial_number')
          .eq('instrument_id', letter.instrument)
          .order('id')
      : Promise.resolve({ data: [] } as any),
  ])

  return {
    instrument_data: instrumentRes?.data ?? null,
    owner_data: ownerRes?.data ?? null,
    authorized_data: authorizedRes?.data ?? null,
    sensor_data_list: Array.isArray(sensorsRes?.data) ? sensorsRes.data : [],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const letterId = Number(id)

  // Renderer PDF (Playwright) tidak punya sesi login; permintaannya membawa
  // token render. Tanpa cabang ini, halaman print Surat gagal 401 saat PDF
  // dibuat sehingga konten print tidak pernah siap.
  if (await isRenderAuthorizedFor(request, { type: 'letter', id: String(letterId) })) {
    const { data, error } = await supabaseAdmin
      .from('letter')
      .select('*')
      .eq('id', letterId)
      .maybeSingle()
    if (error) {
      console.error('[letters/:id] render query failed:', error)
      return NextResponse.json({ error: 'Failed to fetch letter' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

    const [results, display, documentAssignment] = await Promise.all([
      fetchLetterResults(letterId),
      loadLetterDisplayData(data),
      data.calibration_order_item_id
        ? getDocumentAssignment(Number(data.calibration_order_item_id))
        : Promise.resolve(null),
    ])
    return NextResponse.json({ ...data, results, document_assignment: documentAssignment, ...display })
  }

  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { data, error } = await supabaseAdmin
      .from('letter')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    if (!(await canAccessLetter(caller.user.id, caller.role, data))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const [results, documentAssignment, display] = await Promise.all([
      fetchLetterResults(Number(id)),
      data.calibration_order_item_id
        ? getDocumentAssignment(Number(data.calibration_order_item_id))
        : Promise.resolve(null),
      loadLetterDisplayData(data),
    ])
    return NextResponse.json({ ...data, results, document_assignment: documentAssignment, ...display })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch letter' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { id } = await params
    const { data: existingLetter } = await supabaseAdmin
      .from('letter')
      .select('created_by, calibration_order_id, calibration_order_item_id, status')
      .eq('id', Number(id))
      .maybeSingle()
    if (!(await canAccessLetter(caller.user.id, caller.role, existingLetter))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const body = await request.json()
    const nextStatus = body.status || existingLetter?.status || 'draft'
    if (
      nextStatus === 'final' &&
      existingLetter?.status !== 'final' &&
      existingLetter?.calibration_order_item_id
    ) {
      const { error: lockError } = await supabaseAdmin.rpc(
        'lock_order_item_document_assignment',
        {
          p_item_id: Number(existingLetter.calibration_order_item_id),
          p_actor: caller.user.id,
          p_source: 'letter_finalization',
        },
      )
      if (lockError) {
        return NextResponse.json(
          { error: `Penugasan Dokumen belum siap: ${lockError.message}` },
          { status: 400 },
        )
      }
    }

    const update = {
      issue_date: body.issue_date || null,
      ...(body.inspection_date !== undefined ? { inspection_date: body.inspection_date || null } : {}),
      ...(body.inspection_place !== undefined ? { inspection_place: body.inspection_place || null } : {}),
      ...(body.reference_document !== undefined ? { reference_document: body.reference_document || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.status !== undefined ? { status: nextStatus } : {}),
    }

    const { data, error } = await supabaseAdmin
      .from('letter')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })

    await saveLetterResults(Number(id), body.results)
    return NextResponse.json({ ...data, results: await fetchLetterResults(Number(id)) })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update letter' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller
  try {
    const { id } = await params
    const { data: existingLetter } = await supabaseAdmin
      .from('letter')
      .select('created_by, calibration_order_id, calibration_order_item_id, status')
      .eq('id', Number(id))
      .maybeSingle()
    if (!(await canAccessLetter(caller.user.id, caller.role, existingLetter))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('letter')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete letter' }, { status: 500 })
  }
}











