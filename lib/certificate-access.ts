import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase'

type AccessResult =
  | { allowed: true; user: any; role: string | null; certificate: any }
  | { allowed: false; status: number; error: string; user?: any; role?: string | null; certificate?: any }

export async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Authorization header required' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Invalid token' }
  }

  return { user, error: null }
}

export async function getUserRole(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  return data?.role || null
}

export async function getUserStationIds(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_stations')
    .select('station_id')
    .eq('user_id', userId)

  if (error) {
    console.error('[certificate-access] Failed to fetch user stations:', error)
    return new Set<number>()
  }

  return new Set((data || []).map((item: any) => Number(item.station_id)).filter(Number.isFinite))
}

async function getInstrumentStationId(instrumentId?: number | string | null) {
  if (!instrumentId) return null

  const { data, error } = await supabaseAdmin
    .from('instrument')
    .select('station_id')
    .eq('id', instrumentId)
    .maybeSingle()

  if (error) {
    console.error('[certificate-access] Failed to fetch instrument station:', error)
    return null
  }

  return data?.station_id != null ? Number(data.station_id) : null
}

/**
 * Apakah user termasuk "tim" sebuah Order Kalibrasi — yaitu pembuat order
 * (calibration_orders.created_by) atau petugas yang di-assign di
 * calibration_order_personnel. Dipakai untuk memberi akses bersama (view/edit)
 * pada sertifikat yang terhubung ke order itu, sekaligus MENOLAK yang bukan
 * anggota tim. Tidak mengubah jalur verifikasi/TTE (tetap per-sertifikat).
 */
export async function isUserInCalibrationOrderTeam(
  userId: string,
  orderId: number | string | null | undefined,
): Promise<boolean> {
  if (!userId || orderId == null) return false
  const numericOrderId = Number(orderId)
  if (!Number.isFinite(numericOrderId)) return false

  const { data: order, error: orderError } = await supabaseAdmin
    .from('calibration_orders')
    .select('created_by')
    .eq('id', numericOrderId)
    .maybeSingle()
  if (orderError) return false
  if (order?.created_by && String(order.created_by) === userId) return true

  const { data: membership, error: memberError } = await supabaseAdmin
    .from('calibration_order_personnel')
    .select('id')
    .eq('order_id', numericOrderId)
    .eq('personel_id', userId)
    .maybeSingle()
  if (memberError) return false
  return Boolean(membership)
}

export async function canUserAccessCertificate(userId: string, role: string | null, certificate: any) {
  if (!certificate) return false
  if (role === 'admin') return true

  const directlyRelatedIds = [
    certificate.authorized_by,
    certificate.verifikator_1,
    certificate.verifikator_2,
    certificate.verifikator_3,
    certificate.sent_by,
    certificate.created_by,
    certificate.assignor,
    certificate.creator_id,
    certificate.owner_id
  ].filter(Boolean).map(String)

  if (directlyRelatedIds.includes(userId)) return true

  // Akses tim Order Kalibrasi: sertifikat milik sebuah order dapat diakses
  // oleh pembuat order atau petugas yang di-assign ke order itu.
  if (
    certificate.calibration_order_id != null &&
    (await isUserInCalibrationOrderTeam(userId, certificate.calibration_order_id))
  ) {
    return true
  }

  if (role === 'user_station') {
    const stationIds = await getUserStationIds(userId)
    const certificateStationId = certificate.station != null ? Number(certificate.station) : null
    if (certificateStationId != null && stationIds.has(certificateStationId)) return true

    const instrumentStationId = await getInstrumentStationId(certificate.instrument)
    if (instrumentStationId != null && stationIds.has(instrumentStationId)) return true

    return false
  }

  return role === 'calibrator'
}

export async function authorizeCertificateAccess(request: NextRequest, certificateId: number | string): Promise<AccessResult> {
  const { user, error } = await authenticateRequest(request)
  if (error || !user) {
    return { allowed: false, status: 401, error: error || 'Unauthorized' }
  }

  const role = await getUserRole(user.id)
  const { data: certificate, error: certificateError } = await supabaseAdmin
    .from('certificate')
    .select(`
      *,
      instrument_data:instrument(
        id,
        name_alias,
        manufacturer,
        type,
        serial_number,
        others,
        memiliki_lebih_satu,
        names
      )
    `)
    .eq('id', certificateId)
    .maybeSingle()

  if (certificateError) {
    console.error('[certificate-access] Certificate query failed:', certificateError)
    return { allowed: false, status: 500, error: 'Failed to fetch certificate', user, role }
  }

  if (!certificate) {
    return { allowed: false, status: 404, error: 'Certificate not found', user, role }
  }

  const allowed = await canUserAccessCertificate(user.id, role, certificate)
  if (!allowed) {
    return { allowed: false, status: 403, error: 'Forbidden', user, role, certificate }
  }

  return { allowed: true, user, role, certificate }
}

const CERT_PARTY_KEYS = [
  'authorized_by',
  'verifikator_1',
  'verifikator_2',
  'verifikator_3',
  'sent_by',
  'created_by',
  'assignor',
] as const

function isCertificateParty(userId: string, certificate: any): boolean {
  return CERT_PARTY_KEYS.some(
    (key) => certificate?.[key] != null && String(certificate[key]) === userId,
  )
}

/**
 * Kumpulan order_id di mana user adalah bagian tim — pembuat order atau
 * petugas yang di-assign. Dipakai untuk scope daftar & hak edit sertifikat.
 */
export async function getUserOrderTeamOrderIds(
  userId: string,
): Promise<Set<number>> {
  const ids = new Set<number>()
  if (!userId) return ids
  const [createdRes, memberRes] = await Promise.all([
    supabaseAdmin.from('calibration_orders').select('id').eq('created_by', userId),
    supabaseAdmin
      .from('calibration_order_personnel')
      .select('order_id')
      .eq('personel_id', userId),
  ])
  ;(createdRes.data || []).forEach((row: any) => {
    const n = Number(row.id)
    if (Number.isFinite(n)) ids.add(n)
  })
  ;(memberRes.data || []).forEach((row: any) => {
    const n = Number(row.order_id)
    if (Number.isFinite(n)) ids.add(n)
  })
  return ids
}

/**
 * Boleh mengubah sertifikat hanya jika: admin, ATAU (pihak sertifikat ATAU
 * anggota tim order-nya) DAN status masih 'draft'. Konsisten dengan gate API.
 */
export function canEditCertificate(
  userId: string,
  role: string | null,
  certificate: any,
  teamOrderIds: Set<number>,
): boolean {
  if (role === 'admin') return true
  if (!certificate || certificate.status !== 'draft') return false
  if (isCertificateParty(userId, certificate)) return true
  if (
    certificate.calibration_order_id != null &&
    teamOrderIds.has(Number(certificate.calibration_order_id))
  ) {
    return true
  }
  return false
}

export async function filterCertificatesForUser(userId: string, role: string | null, certificates: any[]) {
  if (role === 'admin') return certificates

  const teamOrderIds = await getUserOrderTeamOrderIds(userId)

  // user_station memiliki akses tambahan lewat station yang di-assign.
  let stationIds = new Set<number>()
  const instrumentStationMap = new Map<number, number | null>()
  if (role === 'user_station') {
    stationIds = await getUserStationIds(userId)
    const instrumentIds = Array.from(new Set(
      certificates
        .map((certificate) => certificate.instrument)
        .filter((id) => id !== null && id !== undefined)
    ))
    if (instrumentIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('instrument')
        .select('id, station_id')
        .in('id', instrumentIds)
      ;(data || []).forEach((instrument: any) => {
        instrumentStationMap.set(Number(instrument.id), instrument.station_id != null ? Number(instrument.station_id) : null)
      })
    }
  }

  return certificates.filter((certificate) => {
    // Pihak sertifikat (pembuat, verifikator, penandatangan, dll).
    if (isCertificateParty(userId, certificate)) return true

    // Tim Order Kalibrasi: sertifikat milik order yang dikerjakan.
    if (
      certificate.calibration_order_id != null &&
      teamOrderIds.has(Number(certificate.calibration_order_id))
    ) {
      return true
    }

    if (role === 'user_station') {
      const certificateStationId = certificate.station != null ? Number(certificate.station) : null
      if (certificateStationId != null && stationIds.has(certificateStationId)) return true
      const instrumentStationId = certificate.instrument != null ? instrumentStationMap.get(Number(certificate.instrument)) : null
      return instrumentStationId != null && stationIds.has(instrumentStationId)
    }

    return false
  })
}
