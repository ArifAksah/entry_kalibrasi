import { supabaseAdmin } from './supabase'
import { isUserInCalibrationOrderTeam, getUserOrderTeamOrderIds } from './certificate-access'

export type LetterInspectionRow = {
  inspection_item_id?: number | null
  sensor_id?: number | null
  parameter?: string
  hasil?: string | null
  sort_order?: number
}

export type LetterContext = {
  noLetter?: string | null
  noOrder?: string | null
  noIdentification?: string | null
  instrument?: number | null
  owner?: number | null
  authorizedBy?: string | null
  v1?: string | null
  v2?: string | null
  v3?: string | null
  orderId?: number | null
  itemId?: number | null
}

export type OrderItemLetterContext = {
  itemId: number
  orderId: number
  noOrder: string
  noIdentification: string
  instrument: number
  owner: number
  instrumentCode: string
  orderStatus: string
  itemStatus: string
  certificateId: number | null
  letterId: number | null
}

export async function resolveOrderItemLetterContext(
  itemId: number,
): Promise<OrderItemLetterContext | null> {
  if (!Number.isInteger(itemId) || itemId <= 0) return null

  const { data: item, error } = await supabaseAdmin
    .from('calibration_order_items')
    .select(
      'id, order_id, no_identification, instrument_id, instrument_code, status, calibration_orders!inner(id, no_order, station_id, status), certificate(id), letter(id)',
    )
    .eq('id', itemId)
    .maybeSingle()

  if (error || !item) return null
  const row = item as any
  const order = Array.isArray(row.calibration_orders)
    ? row.calibration_orders[0]
    : row.calibration_orders
  const certificate = Array.isArray(row.certificate) ? row.certificate[0] : row.certificate
  const letter = Array.isArray(row.letter) ? row.letter[0] : row.letter

  if (!order) return null
  return {
    itemId: Number(row.id),
    orderId: Number(row.order_id),
    noOrder: String(order.no_order || ''),
    noIdentification: String(row.no_identification || ''),
    instrument: Number(row.instrument_id),
    owner: Number(order.station_id),
    instrumentCode: String(row.instrument_code || ''),
    orderStatus: String(order.status || ''),
    itemStatus: String(row.status || ''),
    certificateId: certificate?.id != null ? Number(certificate.id) : null,
    letterId: letter?.id != null ? Number(letter.id) : null,
  }
}

export function validateOrderItemForLetter(ctx: OrderItemLetterContext): string | null {
  if (!['booked', 'postponed', 'in_progress'].includes(ctx.orderStatus)) {
    return `Order berstatus ${ctx.orderStatus} belum dapat dibuatkan Surat Keterangan`
  }
  if (ctx.itemStatus === 'void') return 'Alat UUT sudah ditandai tidak dipakai'
  if (!ctx.noOrder || !ctx.noIdentification) return 'Nomor order dan identifikasi belum tersedia'
  if (!Number.isFinite(ctx.instrument) || ctx.instrument <= 0 || !ctx.instrumentCode) {
    return 'Instrumen dan kode alat belum lengkap'
  }
  return null
}

/** Simpan/ganti daftar hasil pemeriksaan milik sebuah surat. */
export async function saveLetterResults(
  letterId: number,
  results: LetterInspectionRow[] | undefined,
): Promise<void> {
  if (!Array.isArray(results)) return
  await supabaseAdmin.from('letter_inspection_results').delete().eq('letter_id', letterId)
  const rows = results
    .map((r, i) => ({
      letter_id: letterId,
      inspection_item_id:
        r.inspection_item_id != null && Number.isFinite(Number(r.inspection_item_id))
          ? Number(r.inspection_item_id)
          : null,
      sensor_id:
        r.sensor_id != null && Number.isFinite(Number(r.sensor_id)) ? Number(r.sensor_id) : null,
      parameter: String(r.parameter ?? '').trim(),
      hasil: r.hasil ?? null,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : i,
    }))
    .filter((r) => r.parameter)
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('letter_inspection_results').insert(rows)
    if (error) throw error
  }
}

export async function fetchLetterResults(letterId: number) {
  const { data } = await supabaseAdmin
    .from('letter_inspection_results')
    .select('*')
    .eq('letter_id', letterId)
    .order('sort_order', { ascending: true })
  return data ?? []
}

/**
 * Isi default surat dari sertifikat/order item yang di-link (collect data),
 * sehingga order/identifikasi/instrumen/pemilik/verifikator tidak diduplikasi.
 */
export async function resolveLetterContext(body: any): Promise<LetterContext> {
  const ctx: LetterContext = {}

  let itemId: number | null = body?.calibration_order_item_id
    ? Number(body.calibration_order_item_id)
    : null

  if (body?.certificate_id) {
    const { data: cert } = await supabaseAdmin
      .from('certificate')
      .select(
        'no_certificate, no_order, no_identification, instrument, station, authorized_by, verifikator_1, verifikator_2, verifikator_3, calibration_order_id, calibration_order_item_id',
      )
      .eq('id', Number(body.certificate_id))
      .maybeSingle()
    if (cert) {
      const c = cert as any
      ctx.noLetter = c.no_certificate
      ctx.noOrder = c.no_order
      ctx.noIdentification = c.no_identification
      ctx.instrument = c.instrument
      ctx.owner = c.station
      ctx.authorizedBy = c.authorized_by
      ctx.v1 = c.verifikator_1
      ctx.v2 = c.verifikator_2
      ctx.v3 = c.verifikator_3
      ctx.orderId = c.calibration_order_id
      if (!itemId) itemId = c.calibration_order_item_id
    }
  }

  if (itemId) {
    const { data: item } = await supabaseAdmin
      .from('calibration_order_items')
      .select('id, order_id, no_identification, instrument_id')
      .eq('id', itemId)
      .maybeSingle()
    if (item) {
      const it = item as any
      ctx.itemId = it.id
      ctx.orderId = ctx.orderId ?? it.order_id
      ctx.noIdentification = ctx.noIdentification ?? it.no_identification
      ctx.instrument = ctx.instrument ?? it.instrument_id
      const { data: order } = await supabaseAdmin
        .from('calibration_orders')
        .select('id, no_order, station_id')
        .eq('id', it.order_id)
        .maybeSingle()
      if (order) {
        ctx.noOrder = ctx.noOrder ?? (order as any).no_order
        ctx.owner = ctx.owner ?? (order as any).station_id
      }
    }
  }

  return ctx
}

/** Order id yang boleh diakses user (tim order). */
export async function accessibleOrderIds(userId: string): Promise<number[]> {
  const ids = await getUserOrderTeamOrderIds(userId)
  return Array.from(ids as Iterable<number>)
}

/** Boleh akses surat? admin, pembuat, atau anggota tim order terkait. */
export async function canAccessLetter(
  userId: string,
  role: string | null,
  letter: any,
): Promise<boolean> {
  if (role === 'admin') return true
  if (!letter) return false
  if (letter.created_by && letter.created_by === userId) return true
  // Pihak-pihak pada Surat: penandatangan, verifikator, dan pengirim konsep
  // harus bisa membuka/mengunduh dokumennya walau bukan pembuat/anggota tim.
  const parties = [
    letter.authorized_by,
    letter.verifikator_1,
    letter.verifikator_2,
    letter.verifikator_3,
    letter.sent_by,
  ]
  if (parties.some((party) => party != null && String(party) === userId)) return true
  if (letter.calibration_order_id) {
    return isUserInCalibrationOrderTeam(userId, Number(letter.calibration_order_id))
  }
  return false
}

/**
 * Boleh memakai sertifikat ini sebagai sumber Surat Keterangan?
 * admin, pihak terkait sertifikat (pembuat/verifikator/penandatangan), atau
 * anggota tim order dari sertifikat tsb. Mencegah lintas-tim.
 */
export async function canReferenceCertificate(
  userId: string,
  role: string | null,
  certificate: any,
): Promise<boolean> {
  if (role === 'admin') return true
  if (!certificate) return false
  const parties = [
    certificate.created_by,
    certificate.verifikator_1,
    certificate.verifikator_2,
    certificate.verifikator_3,
    certificate.authorized_by,
    certificate.sent_by,
    certificate.assignor,
  ]
  if (parties.some((p) => p && p === userId)) return true
  if (certificate.calibration_order_id) {
    return isUserInCalibrationOrderTeam(userId, Number(certificate.calibration_order_id))
  }
  return false
}
