import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type DashboardTone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

type DashboardCard = {
  label: string
  value: number
  hint: string
  tone: DashboardTone
}

type QueueItem = {
  label: string
  value: number
}

type ActionItem = {
  id: number
  no_certificate: string
  subtitle: string
  status: string
  href: string
  priority?: 'high' | 'medium' | 'low'
}

type RejectItem = {
  id: number
  no_certificate: string
  category: string
  level: string
  reason: string
  timestamp: string | null
}

type CertificateRow = {
  id: number
  no_certificate: string | null
  no_order: string | null
  no_identification: string | null
  created_at: string
  issue_date: string | null
  status: string | null
  station?: number | null
  instrument?: number | null
  version?: number | null
  verifikator_1?: string | null
  verifikator_2?: string | null
  verifikator_3?: string | null
  authorized_by?: string | null
  sent_by?: string | null
  assignor?: string | null
  created_by?: string | null
  rejection_history?: any[] | null
  results?: any[] | null
}

type InstrumentRow = {
  id: number
  station_id?: number | null
}

type StationRow = {
  id: number
  name: string | null
  station_wmo_id: string | number | null
  address: string | null
  region: string | null
  province: string | null
  regency: string | null
}

type StationSummary = {
  id: number
  name: string
  station_wmo_id: string | null
  address: string | null
  region: string | null
  province: string | null
  regency: string | null
  instrument_count: number
  certificate_count: number
  draft_count: number
  completed_count: number
}

type StationDashboardInstrument = {
  id: number
  name: string
  code: string
  station_id: number | null
  sensor_ids: number[]
}

type ExpiringInstrumentItem = {
  id: number
  instrument_name: string
  instrument_code: string
  expires_at: string | null
  certificate_no: string
  status: 'expired' | 'warning' | 'valid' | 'missing'
  days_remaining: number | null
  certificate_id?: number | null
}

type TrendPoint = {
  year: number
  correction: number | null
  uncertainty: number | null
}

type TrendSeries = {
  instrument_id: number
  instrument_name: string
  instrument_code: string
  points: TrendPoint[]
}

type UserStationDashboard = {
  stationName: string
  stationCount: number
  totalInstruments: number
  validCertificates: number
  pendingCalibration: number
  activeInstruments: number
  expiringInstruments: ExpiringInstrumentItem[]
  trendSeries: TrendSeries[]
}

type VerificationRow = {
  certificate_id: number
  verification_level: number
  status: string
  certificate_version?: number | null
  updated_at?: string | null
}

type CertificateStandardRow = {
  id: number
  no_certificate: string | null
  calibration_date: string | null
  sensor_id: number | null
  correction_std: any
  u95_std: any
  setpoint: any
  u95_general: number | null
}

const levelLabel = (level: number) => {
  switch (level) {
    case 1:
      return 'Verifikator 1'
    case 2:
      return 'Verifikator 2'
    case 3:
      return 'Verifikator 3'
    case 4:
      return 'Penandatangan'
    default:
      return 'Verifier'
  }
}

const latestRejection = (certificate: CertificateRow) => {
  const history = Array.isArray(certificate.rejection_history) ? [...certificate.rejection_history] : []
  return history.sort((a, b) => {
    const aTime = new Date(a?.rejection_timestamp || 0).getTime()
    const bTime = new Date(b?.rejection_timestamp || 0).getTime()
    return bTime - aTime
  })[0] || null
}

const getVerificationForLevel = (
  verifications: VerificationRow[],
  certificateId: number,
  verificationLevel: number,
  certificateVersion: number
) => verifications.find(
  (verification) =>
    verification.certificate_id === certificateId &&
    verification.verification_level === verificationLevel &&
    (verification.certificate_version ?? 1) === certificateVersion
)

const canUserAct = (
  certificate: CertificateRow,
  verifications: VerificationRow[],
  userId: string
) => {
  if (certificate.status !== 'sent') return false

  const version = certificate.version ?? 1
  const verif1 = getVerificationForLevel(verifications, certificate.id, 1, version)
  const verif2 = getVerificationForLevel(verifications, certificate.id, 2, version)
  const verif3 = getVerificationForLevel(verifications, certificate.id, 3, version)

  if (certificate.verifikator_1 === userId) return true
  if (certificate.verifikator_2 === userId) return verif1?.status === 'approved'
  if (certificate.verifikator_3 === userId) return verif2?.status === 'approved'
  if (certificate.authorized_by === userId) return verif3?.status === 'approved'
  return false
}

const formatCertificateCode = (certificate: CertificateRow) => {
  const parts = [certificate.no_order, certificate.no_identification].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : 'Tanpa nomor order'
}

const buildRejectItems = (certificates: CertificateRow[]): RejectItem[] => {
  return certificates
    .map((certificate) => {
      const rejection = latestRejection(certificate)
      if (!rejection) return null

      return {
        id: certificate.id,
        no_certificate: certificate.no_certificate || `Sertifikat #${certificate.id}`,
        category: rejection.rejection_category_label || rejection.rejection_category || 'Reject',
        level: levelLabel(Number(rejection.verification_level || 0)),
        reason: rejection.rejection_reason || 'Tidak ada catatan penolakan.',
        timestamp: rejection.rejection_timestamp || null
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 6) as RejectItem[]
}

async function getCertificates() {
  const { data, error } = await supabaseAdmin
    .from('certificate')
    .select('id, no_certificate, no_order, no_identification, created_at, issue_date, status, station, instrument, version, verifikator_1, verifikator_2, verifikator_3, authorized_by, sent_by, assignor, created_by, rejection_history, results')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as CertificateRow[]
}

async function getInstruments() {
  const { data, error } = await supabaseAdmin
    .from('instrument')
    .select('id, station_id')

  if (error) throw new Error(error.message)
  return (data || []) as InstrumentRow[]
}

async function getStationDashboardInstruments(stationIds: number[]) {
  if (stationIds.length === 0) return [] as StationDashboardInstrument[]

  const { data: instrumentData, error: instrumentError } = await supabaseAdmin
    .from('instrument')
    .select('id, name, station_id, instrument_names_id')
    .in('station_id', stationIds)
    .order('name', { ascending: true })

  if (instrumentError) throw new Error(instrumentError.message)

  const instruments = instrumentData || []
  const instrumentIds = instruments.map((instrument: any) => Number(instrument.id)).filter((id: number) => Number.isFinite(id))
  const instrumentNameIds = Array.from(new Set(
    instruments
      .map((instrument: any) => Number(instrument.instrument_names_id))
      .filter((id: number) => Number.isFinite(id))
  ))

  const { data: sensorData, error: sensorError } = instrumentIds.length > 0
    ? await supabaseAdmin
      .from('sensor')
      .select('id, instrument_id')
      .in('instrument_id', instrumentIds)
    : { data: [], error: null }

  if (sensorError) throw new Error(sensorError.message)

  const { data: nameData, error: nameError } = instrumentNameIds.length > 0
    ? await supabaseAdmin
      .from('instrument_names')
      .select('id, name, code_alat')
      .in('id', instrumentNameIds)
    : { data: [], error: null }

  if (nameError) throw new Error(nameError.message)

  const sensorsByInstrument = new Map<number, number[]>()
  ;(sensorData || []).forEach((sensor: any) => {
    const instrumentId = Number(sensor.instrument_id)
    const sensorId = Number(sensor.id)
    if (!Number.isFinite(instrumentId) || !Number.isFinite(sensorId)) return
    const list = sensorsByInstrument.get(instrumentId) || []
    list.push(sensorId)
    sensorsByInstrument.set(instrumentId, list)
  })

  const namesById = new Map<number, any>()
  ;(nameData || []).forEach((name: any) => {
    const id = Number(name.id)
    if (Number.isFinite(id)) namesById.set(id, name)
  })

  return instruments.map((instrument: any) => {
    const instrumentName = namesById.get(Number(instrument.instrument_names_id))
    return {
      id: Number(instrument.id),
      name: instrument.name || instrumentName?.name || `Instrumen #${instrument.id}`,
      code: instrumentName?.code_alat || '-',
      station_id: instrument.station_id == null ? null : Number(instrument.station_id),
      sensor_ids: sensorsByInstrument.get(Number(instrument.id)) || []
    }
  }) as StationDashboardInstrument[]
}

async function getCertificateStandardsBySensorIds(sensorIds: number[]) {
  if (sensorIds.length === 0) return [] as CertificateStandardRow[]

  const { data, error } = await supabaseAdmin
    .from('certificate_standard')
    .select('id, no_certificate, calibration_date, sensor_id, correction_std, u95_std, setpoint, u95_general')
    .in('sensor_id', sensorIds)
    .order('calibration_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as CertificateStandardRow[]
}

async function getUserStationIds(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_stations')
    .select('station_id')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return new Set((data || []).map((item: any) => Number(item.station_id)))
}

async function getStationsByIds(stationIds: number[]) {
  if (stationIds.length === 0) return [] as StationRow[]
  const { data, error } = await supabaseAdmin
    .from('station')
    .select('id, name, station_wmo_id, address, region, province, regency')
    .in('id', stationIds)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as StationRow[]
}

const buildStationSummaries = (
  stations: StationRow[],
  instruments: InstrumentRow[],
  certificates: CertificateRow[]
): StationSummary[] => {
  return stations.map((station) => {
    const instrumentIdsForStation = new Set(
      instruments
        .filter((instrument) => Number(instrument.station_id) === Number(station.id))
        .map((instrument) => instrument.id)
    )

    const certsForStation = certificates.filter((certificate) => {
      const stationMatch = certificate.station !== undefined && certificate.station !== null && Number(certificate.station) === Number(station.id)
      const instrumentMatch = certificate.instrument !== undefined && certificate.instrument !== null && instrumentIdsForStation.has(Number(certificate.instrument))
      return stationMatch || instrumentMatch
    })

    return {
      id: Number(station.id),
      name: station.name || `Stasiun #${station.id}`,
      station_wmo_id: station.station_wmo_id !== null && station.station_wmo_id !== undefined ? String(station.station_wmo_id) : null,
      address: station.address,
      region: station.region,
      province: station.province,
      regency: station.regency,
      instrument_count: instrumentIdsForStation.size,
      certificate_count: certsForStation.length,
      draft_count: certsForStation.filter((certificate) => certificate.status === 'draft').length,
      completed_count: certsForStation.filter((certificate) => certificate.status === 'completed' || certificate.status === 'verified').length
    }
  })
}

const parseNumericArray = (value: any): number[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'number') return item
      if (typeof item === 'string' && item.trim() !== '' && !Number.isNaN(Number(item))) return Number(item)
      if (item && typeof item === 'object') {
        const candidate = item.correction ?? item.koreksi ?? item.u95 ?? item.u95_std ?? item.value
        if (typeof candidate === 'number') return candidate
        if (typeof candidate === 'string' && candidate.trim() !== '' && !Number.isNaN(Number(candidate))) return Number(candidate)
      }
      return null
    })
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
}

const average = (values: number[]) => {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const addOneYear = (dateString: string) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

const buildUserStationDashboard = (
  assignedStations: StationRow[],
  instruments: StationDashboardInstrument[],
  standards: CertificateStandardRow[]
): UserStationDashboard => {
  const now = new Date()
  const warningDays = 30
  const standardsBySensor = new Map<number, CertificateStandardRow[]>()

  standards.forEach((standard) => {
    const sensorId = Number(standard.sensor_id)
    if (!Number.isFinite(sensorId)) return
    const list = standardsBySensor.get(sensorId) || []
    list.push(standard)
    standardsBySensor.set(sensorId, list)
  })

  const latestForInstrument = instruments.map((instrument) => {
    const relatedStandards = instrument.sensor_ids.flatMap((sensorId) => standardsBySensor.get(sensorId) || [])
    const sorted = relatedStandards
      .filter((standard) => standard.calibration_date)
      .sort((a, b) => new Date(b.calibration_date || 0).getTime() - new Date(a.calibration_date || 0).getTime())
    const latest = sorted[0] || null
    const expiresAt = latest?.calibration_date ? addOneYear(latest.calibration_date) : null
    const daysRemaining = expiresAt
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null
    const status: ExpiringInstrumentItem['status'] = daysRemaining == null
      ? 'missing'
      : daysRemaining < 0
        ? 'expired'
        : daysRemaining <= warningDays
          ? 'warning'
          : 'valid'

    return { instrument, latest, expiresAt, daysRemaining, status, relatedStandards }
  })

  const expiringInstruments = latestForInstrument
    .filter((item) => item.status === 'missing' || item.status === 'expired' || item.status === 'warning')
    .sort((a, b) => (a.daysRemaining ?? -99999) - (b.daysRemaining ?? -99999))
    .slice(0, 5)
    .map((item) => ({
      id: item.instrument.id,
      instrument_name: item.instrument.name,
      instrument_code: item.instrument.code,
      expires_at: item.expiresAt ? item.expiresAt.toISOString() : null,
      certificate_no: item.latest?.no_certificate || '-',
      certificate_id: item.latest?.id ?? null,
      status: item.status,
      days_remaining: item.daysRemaining
    }))

  const trendSeries = latestForInstrument
    .filter((item) => item.relatedStandards.length > 0)
    .slice(0, 8)
    .map((item) => {
      const byYear = new Map<number, CertificateStandardRow[]>()
      item.relatedStandards.forEach((standard) => {
        if (!standard.calibration_date) return
        const year = new Date(standard.calibration_date).getFullYear()
        if (!Number.isFinite(year)) return
        const list = byYear.get(year) || []
        list.push(standard)
        byYear.set(year, list)
      })

      const points = Array.from(byYear.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, rows]) => {
          const corrections = rows.flatMap((row) => parseNumericArray(row.correction_std))
          const uncertainties = rows.flatMap((row) => {
            const parsed = parseNumericArray(row.u95_std)
            if (parsed.length > 0) return parsed
            return typeof row.u95_general === 'number' ? [row.u95_general] : []
          })
          return {
            year,
            correction: average(corrections),
            uncertainty: average(uncertainties)
          }
        })

      return {
        instrument_id: item.instrument.id,
        instrument_name: item.instrument.name,
        instrument_code: item.instrument.code,
        points
      }
    })
    .filter((series) => series.points.length > 0)

  return {
    stationName: assignedStations.length === 1
      ? (assignedStations[0]?.name || 'Stasiun')
      : assignedStations.length > 1
        ? `${assignedStations.length} Stasiun`
        : 'Belum Ada Stasiun',
    stationCount: assignedStations.length,
    totalInstruments: instruments.length,
    validCertificates: latestForInstrument.filter((item) => item.status === 'valid').length,
    pendingCalibration: latestForInstrument.filter((item) => item.status === 'missing' || item.status === 'expired' || item.status === 'warning').length,
    activeInstruments: instruments.length,
    expiringInstruments,
    trendSeries
  }
}

const getDirectlyRelatedCertificates = (certificates: CertificateRow[], userId: string) => {
  return certificates.filter((certificate) => {
    const directFields = [
      certificate.authorized_by,
      certificate.verifikator_1,
      certificate.verifikator_2,
      certificate.verifikator_3,
      certificate.sent_by,
      certificate.assignor,
      certificate.created_by,
      (certificate as any).creator_id,
      (certificate as any).owner,
      (certificate as any).owner_id,
    ]

    return directFields.some((field) => field !== undefined && field !== null && String(field) === userId)
  })
}

const getUserStationRelatedCertificates = (
  certificates: CertificateRow[],
  userId: string,
  userStationIds: Set<number>,
  instruments: InstrumentRow[]
) => {
  const userInstrumentIds = new Set(
    instruments
      .filter((instrument) => instrument.station_id !== undefined && instrument.station_id !== null && userStationIds.has(Number(instrument.station_id)))
      .map((instrument) => instrument.id)
  )

  return certificates.filter((certificate) => {
    const stationMatch = certificate.station !== undefined && certificate.station !== null && userStationIds.has(Number(certificate.station))
    const instrumentMatch = certificate.instrument !== undefined && certificate.instrument !== null && userInstrumentIds.has(Number(certificate.instrument))

    const directFields = [
      certificate.authorized_by,
      certificate.verifikator_1,
      certificate.verifikator_2,
      certificate.verifikator_3,
      certificate.sent_by,
      certificate.assignor,
      certificate.created_by,
      (certificate as any).creator_id,
      (certificate as any).owner,
      (certificate as any).owner_id,
    ]
    const directMatch = directFields.some((field) => field !== undefined && field !== null && String(field) === userId)

    return stationMatch || instrumentMatch || directMatch
  })
}

async function getVerifications(certificateIds: number[]) {
  if (certificateIds.length === 0) return []
  const { data, error } = await supabaseAdmin
    .from('certificate_verification')
    .select('certificate_id, verification_level, status, certificate_version, updated_at')
    .in('certificate_id', certificateIds)

  if (error) throw new Error(error.message)
  return (data || []) as VerificationRow[]
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'User role not found' }, { status: 404 })
    }

    const role = roleData.role
    const certificates = await getCertificates()
    const verifications = await getVerifications(certificates.map((certificate) => certificate.id))
    const instruments = role === 'user_station' ? await getInstruments() : []

    if (role === 'verifikator') {
      const assignedCertificates = certificates.filter((certificate) =>
        [certificate.verifikator_1, certificate.verifikator_2, certificate.verifikator_3, certificate.authorized_by].includes(user.id)
      )

      const actionItems: ActionItem[] = assignedCertificates
        .filter((certificate) => canUserAct(certificate, verifications, user.id))
        .map((certificate) => {
          const version = certificate.version ?? 1
          let level = 0
          let userStatus = 'pending'

          if (certificate.verifikator_1 === user.id) {
            level = 1
            userStatus = getVerificationForLevel(verifications, certificate.id, 1, version)?.status || 'pending'
          } else if (certificate.verifikator_2 === user.id) {
            level = 2
            userStatus = getVerificationForLevel(verifications, certificate.id, 2, version)?.status || 'pending'
          } else if (certificate.verifikator_3 === user.id) {
            level = 3
            userStatus = getVerificationForLevel(verifications, certificate.id, 3, version)?.status || 'pending'
          } else if (certificate.authorized_by === user.id) {
            level = 4
            userStatus = getVerificationForLevel(verifications, certificate.id, 4, version)?.status || 'pending'
          }

          return {
            id: certificate.id,
            no_certificate: certificate.no_certificate || `Sertifikat #${certificate.id}`,
            subtitle: `${levelLabel(level)} • ${formatCertificateCode(certificate)}`,
            status: userStatus === 'pending' ? 'Butuh review' : userStatus,
            href: '/certificate-verification',
            priority: certificate.status === 'sent' ? 'high' as const : 'medium' as const
          }
        })
        .slice(0, 8)

      const approvedByUser = assignedCertificates.filter((certificate) => {
        const version = certificate.version ?? 1
        if (certificate.verifikator_1 === user.id) return getVerificationForLevel(verifications, certificate.id, 1, version)?.status === 'approved'
        if (certificate.verifikator_2 === user.id) return getVerificationForLevel(verifications, certificate.id, 2, version)?.status === 'approved'
        if (certificate.verifikator_3 === user.id) return getVerificationForLevel(verifications, certificate.id, 3, version)?.status === 'approved'
        if (certificate.authorized_by === user.id) return getVerificationForLevel(verifications, certificate.id, 4, version)?.status === 'approved'
        return false
      }).length

      const returnedForRevision = assignedCertificates.filter((certificate) => certificate.status === 'draft' && latestRejection(certificate)).length

      const waitingOthers = assignedCertificates.filter((certificate) => certificate.status === 'sent' && !canUserAct(certificate, verifications, user.id)).length

      const queue: QueueItem[] = [
        { label: 'Verifikator 1', value: assignedCertificates.filter((certificate) => certificate.verifikator_1 === user.id).length },
        { label: 'Verifikator 2', value: assignedCertificates.filter((certificate) => certificate.verifikator_2 === user.id).length },
        { label: 'Verifikator 3', value: assignedCertificates.filter((certificate) => certificate.verifikator_3 === user.id).length },
        { label: 'Penandatangan', value: assignedCertificates.filter((certificate) => certificate.authorized_by === user.id).length }
      ]

      return NextResponse.json({
        role,
        title: 'Dashboard Verifikasi',
        subtitle: 'Ringkasan pekerjaan verifikasi yang membutuhkan perhatian Anda.',
        cards: [
          { label: 'Butuh Aksi Saya', value: actionItems.length, hint: 'Sertifikat siap Anda review saat ini', tone: 'amber' },
          { label: 'Sudah Saya Setujui', value: approvedByUser, hint: 'Approval pada versi aktif sertifikat', tone: 'green' },
          { label: 'Menunggu Tahap Lain', value: waitingOthers, hint: 'Masih tertahan di level lain', tone: 'blue' },
          { label: 'Kembali untuk Revisi', value: returnedForRevision, hint: 'Draft hasil reject yang masih dipantau', tone: 'red' }
        ] as DashboardCard[],
        queue,
        actionItems,
        recentRejects: buildRejectItems(assignedCertificates)
      })
    }

    if (role === 'assignor') {
      const ownedCertificates = certificates.filter((certificate) => certificate.authorized_by === user.id)
      const readyForSignature = ownedCertificates.filter((certificate) => canUserAct(certificate, verifications, user.id))
      const signedCount = ownedCertificates.filter((certificate) => certificate.status === 'completed').length
      const returnedCount = ownedCertificates.filter((certificate) => certificate.status === 'draft' && latestRejection(certificate)).length
      const waitingFinal = ownedCertificates.filter((certificate) => certificate.status === 'sent' && !canUserAct(certificate, verifications, user.id)).length

      return NextResponse.json({
        role,
        title: 'Dashboard Penandatangan',
        subtitle: 'Pantau dokumen yang siap ditandatangani dan yang masih menunggu tahapan sebelumnya.',
        cards: [
          { label: 'Siap Ditandatangani', value: readyForSignature.length, hint: 'Level verifikasi sebelumnya sudah lengkap', tone: 'green' },
          { label: 'Selesai Ditandatangani', value: signedCount, hint: 'Dokumen completed pada sistem', tone: 'blue' },
          { label: 'Menunggu Tahap Sebelumnya', value: waitingFinal, hint: 'Belum bisa ditandatangani saat ini', tone: 'amber' },
          { label: 'Kembali untuk Revisi', value: returnedCount, hint: 'Menunggu revisi dari petugas kalibrasi', tone: 'red' }
        ] as DashboardCard[],
        queue: [
          { label: 'Siap Sign', value: readyForSignature.length },
          { label: 'Menunggu V3', value: waitingFinal },
          { label: 'Selesai', value: signedCount }
        ],
        actionItems: readyForSignature.slice(0, 8).map((certificate) => ({
          id: certificate.id,
          no_certificate: certificate.no_certificate || `Sertifikat #${certificate.id}`,
          subtitle: `Penandatangan • ${formatCertificateCode(certificate)}`,
          status: 'Siap tanda tangan',
          href: '/certificate-verification',
          priority: 'high'
        })),
        recentRejects: buildRejectItems(ownedCertificates)
      })
    }

    if (role === 'calibrator' || role === 'user_station') {
      const userStationIds = role === 'user_station' ? await getUserStationIds(user.id) : new Set<number>()
      const assignedStations = role === 'user_station' ? await getStationsByIds(Array.from(userStationIds)) : []
      const stationDashboardInstruments = role === 'user_station'
        ? await getStationDashboardInstruments(Array.from(userStationIds))
        : []
      const stationDashboardStandards = role === 'user_station'
        ? await getCertificateStandardsBySensorIds(Array.from(new Set(stationDashboardInstruments.flatMap((instrument) => instrument.sensor_ids))))
        : []

      const relevantCertificates = role === 'user_station'
        ? getUserStationRelatedCertificates(certificates, user.id, userStationIds, instruments)
        : getDirectlyRelatedCertificates(certificates, user.id)

      const totalCertificates = relevantCertificates.length
      const draftCertificates = relevantCertificates.filter((certificate) => certificate.status === 'draft')
      const returnedCertificates = relevantCertificates.filter((certificate) => certificate.status === 'draft' && latestRejection(certificate))
      const completedCertificates = relevantCertificates.filter((certificate) => certificate.status === 'completed' || certificate.status === 'verified')
      const readyToSend = draftCertificates.filter((certificate) =>
        certificate.verifikator_1 &&
        certificate.verifikator_2 &&
        certificate.verifikator_3 &&
        certificate.authorized_by
      )
      const { count: instrumentCount } = await supabaseAdmin
        .from('instrument')
        .select('*', { count: 'exact', head: true })

      const stationSummaries = role === 'user_station'
        ? buildStationSummaries(assignedStations, instruments, relevantCertificates)
        : []
      const userStationDashboard = role === 'user_station'
        ? buildUserStationDashboard(assignedStations, stationDashboardInstruments, stationDashboardStandards)
        : null
      const assignedInstrumentCount = userStationDashboard?.totalInstruments || 0

      const prioritizedDrafts = [...returnedCertificates, ...draftCertificates.filter((certificate) => !latestRejection(certificate))]
        .slice(0, 8)
        .map((certificate) => {
          const rejection = latestRejection(certificate)
          return {
            id: certificate.id,
            no_certificate: certificate.no_certificate || `Sertifikat #${certificate.id}`,
            subtitle: rejection
              ? `${rejection.rejection_category_label || rejection.rejection_category || 'Revisi'} • ${formatCertificateCode(certificate)}`
              : `Draft • ${formatCertificateCode(certificate)}`,
            status: rejection ? 'Perlu revisi' : 'Draft aktif',
            href: '/certificates',
            priority: rejection ? 'high' as const : 'medium' as const
          }
        })

      const userStationCards: DashboardCard[] = [
        { label: 'Stasiun Saya', value: assignedStations.length, hint: 'Stasiun yang ditugaskan kepada Anda', tone: 'blue' },
        { label: 'Instrumen di Stasiun', value: assignedInstrumentCount, hint: 'Instrumen pada stasiun tugas Anda', tone: 'purple' },
        { label: 'Total Sertifikat', value: totalCertificates, hint: 'Dokumen pada stasiun tugas Anda', tone: 'slate' },
        { label: 'Kembali untuk Revisi', value: returnedCertificates.length, hint: 'Prioritas utama untuk diperbaiki', tone: 'red' }
      ]

      const calibratorCards: DashboardCard[] = [
        { label: 'Draft Aktif', value: draftCertificates.length, hint: 'Dokumen yang masih dalam pengerjaan', tone: 'slate' },
        { label: 'Kembali untuk Revisi', value: returnedCertificates.length, hint: 'Prioritas utama untuk diperbaiki', tone: 'red' },
        { label: 'Siap Dikirim', value: readyToSend.length, hint: 'Draft dengan penugasan reviewer lengkap', tone: 'amber' },
        { label: 'Instrumen Aktif', value: instrumentCount || 0, hint: 'Instrumen terdaftar di sistem', tone: 'blue' }
      ]

      const userStationSubtitle = assignedStations.length === 0
        ? 'Belum ada stasiun yang ditugaskan pada akun Anda. Hubungi admin untuk penugasan.'
        : `Pantau ${assignedStations.length} stasiun tugas Anda beserta instrumen dan progres sertifikatnya.`

      return NextResponse.json({
        role,
        title: role === 'calibrator' ? 'Dashboard Petugas Kalibrasi' : 'Dashboard Stasiun',
        subtitle: role === 'calibrator'
          ? 'Pantau draft, revisi, dan sertifikat yang siap dikirim ke verifikator.'
          : userStationSubtitle,
        cards: role === 'user_station' ? userStationCards : calibratorCards,
        queue: [
          { label: 'Draft', value: draftCertificates.length },
          { label: 'Revisi', value: returnedCertificates.length },
          { label: 'Siap Kirim', value: readyToSend.length },
          { label: 'Selesai', value: completedCertificates.length }
        ],
        actionItems: prioritizedDrafts,
        recentRejects: buildRejectItems(relevantCertificates),
        stations: stationSummaries,
        stationDashboard: userStationDashboard
      })
    }

    if (role === 'admin') {
      const pendingLevel1 = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationForLevel(verifications, certificate.id, 1, version)?.status === 'pending'
      }).length
      const pendingLevel2 = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationForLevel(verifications, certificate.id, 2, version)?.status === 'pending'
      }).length
      const pendingLevel3 = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationForLevel(verifications, certificate.id, 3, version)?.status === 'pending'
      }).length
      const pendingSignature = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationForLevel(verifications, certificate.id, 4, version)?.status === 'pending'
      }).length

      const draftCount = certificates.filter((certificate) => certificate.status === 'draft').length
      const sentCount = certificates.filter((certificate) => certificate.status === 'sent').length
      const completedCount = certificates.filter((certificate) => certificate.status === 'completed').length

      return NextResponse.json({
        role,
        title: 'Dashboard Manajemen',
        subtitle: 'Pantau antrean lintas role, bottleneck proses, dan reject terbaru.',
        cards: [
          { label: 'Total Sertifikat', value: certificates.length, hint: 'Semua dokumen pada sistem', tone: 'blue' },
          { label: 'Dalam Proses', value: sentCount, hint: 'Sedang berada di alur verifikasi', tone: 'amber' },
          { label: 'Selesai', value: completedCount, hint: 'Dokumen completed', tone: 'green' },
          { label: 'Draft / Revisi', value: draftCount, hint: 'Butuh perhatian petugas kalibrasi', tone: 'red' }
        ] as DashboardCard[],
        queue: [
          { label: 'Antrian V1', value: pendingLevel1 },
          { label: 'Antrian V2', value: pendingLevel2 },
          { label: 'Antrian V3', value: pendingLevel3 },
          { label: 'Antrian Sign', value: pendingSignature }
        ],
        actionItems: certificates
          .filter((certificate) => certificate.status === 'sent')
          .slice(0, 8)
          .map((certificate) => ({
            id: certificate.id,
            no_certificate: certificate.no_certificate || `Sertifikat #${certificate.id}`,
            subtitle: `${certificate.status || 'sent'} • ${formatCertificateCode(certificate)}`,
            status: 'Sedang diproses',
            href: '/certificates',
            priority: 'medium'
          })),
        recentRejects: buildRejectItems(certificates)
      })
    }

    return NextResponse.json({
      role,
      title: 'Dashboard',
      subtitle: 'Ringkasan aktivitas terbaru pada sistem sertifikat.',
      cards: [
        { label: 'Total Sertifikat', value: certificates.length, hint: 'Dokumen pada sistem', tone: 'blue' }
      ] as DashboardCard[],
      queue: [],
      actionItems: [],
      recentRejects: buildRejectItems(certificates)
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
