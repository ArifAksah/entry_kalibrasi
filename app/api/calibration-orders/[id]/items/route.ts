import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireCaller, isAdminCaller, forbidden, notFound } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** GET /api/calibration-orders/[id]/items — daftar item/identifikasi order */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  const { data, error } = await supabase
    .from('calibration_order_items')
    .select('id, order_id, identification_sequence, no_identification, instrument_id, instrument_code, status, created_at, voided_at, void_reason, certificate(id, no_certificate, status)')
    .eq('order_id', orderId)
    .order('identification_sequence', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

/**
 * POST /api/calibration-orders/[id]/items
 * Body: { instrument_id?, instrument_code? }
 * Mengalokasikan no_identification berikutnya secara atomik.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const { id } = await params
  const orderId = Number(id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  const { data: order } = await supabase
    .from('calibration_orders')
    .select('id, status, created_by, station_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return notFound('Order tidak ditemukan')

  const isOwner = caller.role === 'calibrator' && order.created_by === caller.user.id
  if (!isAdminCaller(caller) && !isOwner) return forbidden()

  let body: any
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const instrumentId = body?.instrument_id != null ? Number(body.instrument_id) : null
  if (!instrumentId) {
    return NextResponse.json({ error: 'instrument_id wajib diisi' }, { status: 400 })
  }

  const { data: instrument } = await supabase
    .from('instrument')
    .select('id, station_id, instrument_code_id')
    .eq('id', instrumentId)
    .maybeSingle()
  if (!instrument) return notFound('Instrumen tidak ditemukan')
  if (Number(instrument.station_id) !== Number(order.station_id)) {
    return NextResponse.json(
      { error: 'Instrumen tidak berasal dari station pada order ini' },
      { status: 409 },
    )
  }

  let instrumentCode = body?.instrument_code ? String(body.instrument_code) : null
  if (instrument.instrument_code_id) {
    const { data: codeRow } = await supabase
      .from('instrument_code')
      .select('code_alat')
      .eq('id', instrument.instrument_code_id)
      .maybeSingle()
    instrumentCode = codeRow?.code_alat || instrumentCode
  }

  const { data, error } = await supabase.rpc('reserve_order_identification', {
    p_data: {
      order_id: orderId,
      instrument_id: instrumentId,
      instrument_code: instrumentCode,
      created_by: caller.user.id,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const item: any = Array.isArray(data) ? data[0] : data

  // Warisi penugasan dokumen yang dipilih saat memesan order (bila diisi).
  // Kegagalan di sini tidak menggagalkan pembuatan identifikasi — petugas
  // masih bisa mengatur penugasan manual di panel detail order.
  try {
    const { data: defaults } = await supabase
      .from('calibration_orders')
      .select('created_by, default_verifikator_1, default_verifikator_2, default_verifikator_3, default_authorized_by')
      .eq('id', orderId)
      .maybeSingle()

    const complete =
      defaults?.default_verifikator_1 &&
      defaults?.default_verifikator_2 &&
      defaults?.default_verifikator_3 &&
      defaults?.default_authorized_by

    if (complete && item?.id) {
      const { data: teamRows } = await supabase
        .from('calibration_order_personnel')
        .select('personel_id')
        .eq('order_id', orderId)
      const checkerIds = Array.from(
        new Set(
          [defaults!.created_by, ...(teamRows || []).map((row: any) => row.personel_id)].filter(Boolean),
        ),
      )
      const { error: assignError } = await supabase.rpc('save_order_item_document_assignment', {
        p_data: {
          calibration_order_item_id: item.id,
          actor_id: caller.user.id,
          checked_by_ids: checkerIds,
          verifikator_1: defaults!.default_verifikator_1,
          verifikator_2: defaults!.default_verifikator_2,
          verifikator_3: defaults!.default_verifikator_3,
          authorized_by: defaults!.default_authorized_by,
        },
      })
      if (assignError) {
        console.error('[order items] gagal mewarisi penugasan dokumen:', assignError.message)
      }
    }
  } catch (inheritError) {
    console.error('[order items] error mewarisi penugasan dokumen:', inheritError)
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
