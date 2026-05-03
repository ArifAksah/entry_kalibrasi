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
    .select('*')
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

export async function filterCertificatesForUser(userId: string, role: string | null, certificates: any[]) {
  if (role === 'admin' || role === 'calibrator') return certificates

  if (role === 'user_station') {
    const stationIds = await getUserStationIds(userId)
    const instrumentIds = Array.from(new Set(
      certificates
        .map((certificate) => certificate.instrument)
        .filter((id) => id !== null && id !== undefined)
    ))

    const instrumentStationMap = new Map<number, number | null>()
    if (instrumentIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('instrument')
        .select('id, station_id')
        .in('id', instrumentIds)

      ;(data || []).forEach((instrument: any) => {
        instrumentStationMap.set(Number(instrument.id), instrument.station_id != null ? Number(instrument.station_id) : null)
      })
    }

    return certificates.filter((certificate) => {
      if ([certificate.authorized_by, certificate.verifikator_1, certificate.verifikator_2, certificate.verifikator_3, certificate.sent_by, certificate.created_by, certificate.assignor]
        .filter(Boolean)
        .map(String)
        .includes(userId)) {
        return true
      }

      const certificateStationId = certificate.station != null ? Number(certificate.station) : null
      if (certificateStationId != null && stationIds.has(certificateStationId)) return true

      const instrumentStationId = certificate.instrument != null ? instrumentStationMap.get(Number(certificate.instrument)) : null
      return instrumentStationId != null && stationIds.has(instrumentStationId)
    })
  }

  return certificates.filter((certificate) =>
    [certificate.authorized_by, certificate.verifikator_1, certificate.verifikator_2, certificate.verifikator_3, certificate.sent_by, certificate.created_by, certificate.assignor]
      .filter(Boolean)
      .map(String)
      .includes(userId)
  )
}
