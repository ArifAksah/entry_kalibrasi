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
  pdf_generated_at?: string | null
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
  valid_from: string | null
  expires_at: string | null
  certificate_no: string
  certificate_order: string | null
  no_identification: string | null
  issue_date: string | null
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
  signed_at?: string | null
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

/** Build a Map for O(1) verification lookups instead of O(n) .find() per call */
function buildVerificationMap(verifications: VerificationRow[]) {
  const map = new Map<string, VerificationRow>()
  for (const v of verifications) {
    const key = `${v.certificate_id}-${v.verification_level}-${v.certificate_version ?? 1}`
    map.set(key, v)
  }
  return map
}

function getVerificationFast(map: Map<string, VerificationRow>, certificateId: number, level: number, version: number) {
  return map.get(`${certificateId}-${level}-${version}`)
}

const canUserAct = (
  certificate: CertificateRow,
  verifMap: Map<string, VerificationRow>,
  userId: string
) => {
  if (certificate.status !== 'sent') return false

  const version = certificate.version ?? 1
  const verif1 = getVerificationFast(verifMap, certificate.id, 1, version)
  const verif2 = getVerificationFast(verifMap, certificate.id, 2, version)
  const verif3 = getVerificationFast(verifMap, certificate.id, 3, version)

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
  // Exclude 'results' — it's a large JSON field not needed for dashboard summaries
  const { data, error } = await supabaseAdmin
    .from('certificate')
    .select('id, no_certificate, no_order, no_identification, created_at, issue_date, status, station, instrument, version, verifikator_1, verifikator_2, verifikator_3, authorized_by, sent_by, assignor, created_by, rejection_history, pdf_generated_at')
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

  // Try with instrument_names_id first, fallback without it if column doesn't exist
  let instrumentData: any[] = []
  let hasInstrumentNamesId = true
  
  const { data: dataWithNamesId, error: errorWithNamesId } = await supabaseAdmin
    .from('instrument')
    .select('id, manufacturer, type, serial_number, station_id, instrument_names_id')
    .in('station_id', stationIds)
    .order('manufacturer', { ascending: true })

  if (!errorWithNamesId) {
    instrumentData = dataWithNamesId || []
  } else {
    // If instrument_names_id doesn't exist, try without it
    console.warn('instrument_names_id column not found, trying without it:', errorWithNamesId.message)
    hasInstrumentNamesId = false
    const { data: dataWithoutNamesId, error: errorWithoutNamesId } = await supabaseAdmin
      .from('instrument')
      .select('id, manufacturer, type, serial_number, station_id')
      .in('station_id', stationIds)
      .order('manufacturer', { ascending: true })
    
    if (errorWithoutNamesId) {
      throw new Error(errorWithoutNamesId.message)
    }
    instrumentData = dataWithoutNamesId || []
  }

  const instruments = instrumentData || []
  const instrumentIds = instruments.map((instrument: any) => Number(instrument.id)).filter((id: number) => Number.isFinite(id))
  const instrumentNameIds = Array.from(new Set(
    instruments
      .filter((instrument: any) => hasInstrumentNamesId && instrument.instrument_names_id != null)
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

  // Only fetch instrument names if we have valid IDs
  let nameData: any[] = []
  if (instrumentNameIds.length > 0) {
    const { data: fetchedNameData, error: nameError } = await supabaseAdmin
      .from('instrument_names')
      .select('id, name, code_alat')
      .in('id', instrumentNameIds)
    if (nameError) {
      console.warn('Could not fetch instrument_names:', nameError.message)
    } else {
      nameData = fetchedNameData || []
    }
  }

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
  nameData.forEach((name: any) => {
    const id = Number(name.id)
    if (Number.isFinite(id)) namesById.set(id, name)
  })

    return instruments.map((instrument: any) => {
    const instrumentName = hasInstrumentNamesId && instrument.instrument_names_id ? namesById.get(Number(instrument.instrument_names_id)) : null
    // Create a meaningful name from available fields
    const instrumentNameFromFields = [
      instrument.manufacturer,
      instrument.type,
      instrument.serial_number
    ].filter(Boolean).join(' - ') || null
    
    return {
      id: Number(instrument.id),
      name: instrumentName?.name || instrumentNameFromFields || `Instrumen #${instrument.id}`,
      code: instrumentName?.code_alat || instrument.serial_number || '-',
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
  // Use select('*') to avoid column name issues
  const { data, error } = await supabaseAdmin
    .from('station')
    .select('*')
    .in('id', stationIds)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  // Dynamically map - try station_wmo_id first, then wmo_id
  return ((data || []) as any[]).map((row: any) => ({
    id: row.id,
    name: row.name,
    station_wmo_id: row.station_wmo_id ?? row.wmo_id ?? null,
    address: row.address,
    region: row.region,
    province: row.province,
    regency: row.regency
  })) as StationRow[]
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

const coerceNumber = (item: any): number | null => {
  if (typeof item === 'number') return Number.isFinite(item) ? item : null
  if (typeof item === 'string' && item.trim() !== '' && !Number.isNaN(Number(item))) return Number(item)
  return null
}

// Extract numeric values from the many formats correction_std / u95_std can be stored in:
// - primitive array: [0.01, 0.02]
// - array of objects: [{ correction|koreksi|u95|u95_std|value: ... }]
// - plain object: { koreksi: [...], u95: [...], setpoint: [...] }
// - JSON string of any of the above, or a comma-separated / single numeric string
// `metric` decides which keys to read when the data is keyed by field.
const parseNumericArray = (value: any, metric: 'correction' | 'uncertainty' = 'correction'): number[] => {
  if (value === null || value === undefined) return []

  const keys = metric === 'uncertainty'
    ? ['u95', 'u95_std', 'uncertainty', 'value']
    : ['correction', 'koreksi', 'value']

  // Strings: try single number, then JSON, then comma-separated values
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return []
    const single = coerceNumber(trimmed)
    if (single !== null) return [single]
    try {
      return parseNumericArray(JSON.parse(trimmed), metric)
    } catch {
      return trimmed
        .split(',')
        .map((part) => coerceNumber(part))
        .filter((n): n is number => n !== null)
    }
  }

  // Single number
  const single = coerceNumber(value)
  if (single !== null) return [single]

  // Array (primitives or objects)
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const n = coerceNumber(item)
      if (n !== null) return [n]
      if (item && typeof item === 'object') {
        for (const key of keys) {
          const c = coerceNumber(item[key])
          if (c !== null) return [c]
        }
      }
      return []
    })
  }

  // Plain object keyed by field: { koreksi: [...], u95: [...] }
  if (typeof value === 'object') {
    for (const key of keys) {
      if (Array.isArray(value[key])) return parseNumericArray(value[key], metric)
      const c = coerceNumber(value[key])
      if (c !== null) return [c]
    }
  }

  return []
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

const normalizeCertificateNo = (value: string | null | undefined) => {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const getSignedAtForCertificate = (
  certificate: CertificateRow,
  verifications: VerificationRow[]
) => {
  const version = certificate.version ?? 1
  const approvedSignatures = verifications
    .filter((verification) =>
      verification.certificate_id === certificate.id &&
      verification.status === 'approved' &&
      (verification.verification_level === 4 || verification.verification_level === 3)
    )
    .sort((a, b) => {
      const levelDiff = b.verification_level - a.verification_level
      if (levelDiff !== 0) return levelDiff

      const aCurrentVersion = (a.certificate_version ?? 1) === version ? 1 : 0
      const bCurrentVersion = (b.certificate_version ?? 1) === version ? 1 : 0
      if (aCurrentVersion !== bCurrentVersion) return bCurrentVersion - aCurrentVersion

      return new Date(b.signed_at || b.updated_at || 0).getTime() - new Date(a.signed_at || a.updated_at || 0).getTime()
    })

  const signature = approvedSignatures[0]

  return signature?.signed_at || signature?.updated_at || certificate.pdf_generated_at || null
}

const buildUserStationDashboard = (
  assignedStations: StationRow[],
  instruments: StationDashboardInstrument[],
  standards: CertificateStandardRow[],
  certificates: CertificateRow[],
  verifications: VerificationRow[]
): UserStationDashboard => {
  const now = new Date()
  const warningDays = 30
  const standardsBySensor = new Map<number, CertificateStandardRow[]>()
  const signedCertificatesByInstrument = new Map<number, Array<CertificateRow & { signed_at_effective: string }>>()
  const signedCertificatesByNumber = new Map<string, CertificateRow & { signed_at_effective: string }>()

  standards.forEach((standard) => {
    const sensorId = Number(standard.sensor_id)
    if (!Number.isFinite(sensorId)) return
    const list = standardsBySensor.get(sensorId) || []
    list.push(standard)
    standardsBySensor.set(sensorId, list)
  })

  certificates
    .filter((certificate) => certificate.status === 'completed' || certificate.status === 'verified')
    .forEach((certificate) => {
      const signedAt = getSignedAtForCertificate(certificate, verifications)
      if (!signedAt || Number.isNaN(new Date(signedAt).getTime())) return

      const normalizedNo = normalizeCertificateNo(certificate.no_certificate)
      if (normalizedNo) {
        const existing = signedCertificatesByNumber.get(normalizedNo)
        if (!existing || new Date(signedAt).getTime() > new Date(existing.signed_at_effective).getTime()) {
          signedCertificatesByNumber.set(normalizedNo, { ...certificate, signed_at_effective: signedAt })
        }
      }

      const instrumentId = Number(certificate.instrument)
      if (!Number.isFinite(instrumentId)) return

      const list = signedCertificatesByInstrument.get(instrumentId) || []
      list.push({ ...certificate, signed_at_effective: signedAt })
      signedCertificatesByInstrument.set(instrumentId, list)
    })

  const latestForInstrument = instruments.map((instrument) => {
    const relatedStandards = instrument.sensor_ids.flatMap((sensorId) => standardsBySensor.get(sensorId) || [])
    const certificatesFromStandards = relatedStandards
      .map((standard) => signedCertificatesByNumber.get(normalizeCertificateNo(standard.no_certificate)))
      .filter((certificate): certificate is CertificateRow & { signed_at_effective: string } => !!certificate)
    const certificateCandidates = [
      ...(signedCertificatesByInstrument.get(instrument.id) || []),
      ...certificatesFromStandards
    ]
    const latestCertificate = certificateCandidates
      .sort((a, b) => new Date(b.signed_at_effective).getTime() - new Date(a.signed_at_effective).getTime())[0] || null
    const sorted = relatedStandards
      .filter((standard) => standard.calibration_date)
      .sort((a, b) => new Date(b.calibration_date || 0).getTime() - new Date(a.calibration_date || 0).getTime())
    const latest = sorted[0] || null
    const validFrom = latestCertificate?.signed_at_effective || null
    const expiresAt = validFrom ? addOneYear(validFrom) : null
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

    return { instrument, latest, latestCertificate, validFrom, expiresAt, daysRemaining, status, relatedStandards }
  })

  const expiringInstruments = latestForInstrument
    .sort((a, b) => {
      const statusPriority: Record<ExpiringInstrumentItem['status'], number> = {
        expired: 0,
        warning: 1,
        valid: 2,
        missing: 3
      }
      const statusDiff = statusPriority[a.status] - statusPriority[b.status]
      if (statusDiff !== 0) return statusDiff
      return (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) - (b.daysRemaining ?? Number.MAX_SAFE_INTEGER)
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.instrument.id,
      instrument_name: item.instrument.name,
            instrument_code: item.instrument.code,
            valid_from: item.validFrom,
            expires_at: item.expiresAt ? item.expiresAt.toISOString() : null,
            certificate_no: item.latestCertificate?.no_certificate || '-',
            certificate_order: item.latestCertificate?.no_order || null,
            no_identification: item.latestCertificate?.no_identification || null,
            issue_date: item.latestCertificate?.issue_date || null,
            certificate_id: item.latestCertificate?.id ?? null,
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
                const corrections = rows.flatMap((row) => {
                  const parsed = parseNumericArray(row.correction_std, 'correction')
                  if (parsed.length > 0) return parsed
                  // correction values may live inside setpoint-keyed objects
                  return parseNumericArray(row.setpoint, 'correction')
                })
                const uncertainties = rows.flatMap((row) => {
                  const parsed = parseNumericArray(row.u95_std, 'uncertainty')
                  if (parsed.length > 0) return parsed
                  // uncertainty may be nested inside the correction_std object format
                  const fromCorrection = parseNumericArray(row.correction_std, 'uncertainty')
                  if (fromCorrection.length > 0) return fromCorrection
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
    .select('certificate_id, verification_level, status, certificate_version, signed_at, updated_at')
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
      // User has no role assigned — return a minimal dashboard instead of error
      return NextResponse.json({
        role: null,
        title: 'Dashboard',
        subtitle: 'Akun Anda belum memiliki role. Hubungi admin untuk penugasan role.',
        cards: [] as DashboardCard[],
        queue: [],
        actionItems: [],
        recentRejects: []
      })
    }

    const role = roleData.role

    // Parallelize independent queries based on role
    // All roles need certificates; user_station also needs instruments
    const [certificates, instruments] = await Promise.all([
      getCertificates(),
      role === 'user_station' ? getInstruments() : Promise.resolve([])
    ])
    const verifications = await getVerifications(certificates.map((certificate) => certificate.id))
    const verifMap = buildVerificationMap(verifications)

    if (role === 'verifikator') {
      const assignedCertificates = certificates.filter((certificate) =>
        [certificate.verifikator_1, certificate.verifikator_2, certificate.verifikator_3, certificate.authorized_by].includes(user.id)
      )

      const actionItems: ActionItem[] = assignedCertificates
        .filter((certificate) => canUserAct(certificate, verifMap, user.id))
        .map((certificate) => {
          const version = certificate.version ?? 1
          let level = 0
          let userStatus = 'pending'

          if (certificate.verifikator_1 === user.id) {
            level = 1
            userStatus = getVerificationFast(verifMap, certificate.id, 1, version)?.status || 'pending'
          } else if (certificate.verifikator_2 === user.id) {
            level = 2
            userStatus = getVerificationFast(verifMap, certificate.id, 2, version)?.status || 'pending'
          } else if (certificate.verifikator_3 === user.id) {
            level = 3
            userStatus = getVerificationFast(verifMap, certificate.id, 3, version)?.status || 'pending'
          } else if (certificate.authorized_by === user.id) {
            level = 4
            userStatus = getVerificationFast(verifMap, certificate.id, 4, version)?.status || 'pending'
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
        if (certificate.verifikator_1 === user.id) return getVerificationFast(verifMap, certificate.id, 1, version)?.status === 'approved'
        if (certificate.verifikator_2 === user.id) return getVerificationFast(verifMap, certificate.id, 2, version)?.status === 'approved'
        if (certificate.verifikator_3 === user.id) return getVerificationFast(verifMap, certificate.id, 3, version)?.status === 'approved'
        if (certificate.authorized_by === user.id) return getVerificationFast(verifMap, certificate.id, 4, version)?.status === 'approved'
        return false
      }).length

      const returnedForRevision = assignedCertificates.filter((certificate) => certificate.status === 'draft' && latestRejection(certificate)).length

      const waitingOthers = assignedCertificates.filter((certificate) => certificate.status === 'sent' && !canUserAct(certificate, verifMap, user.id)).length

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
      const readyForSignature = ownedCertificates.filter((certificate) => canUserAct(certificate, verifMap, user.id))
      const signedCount = ownedCertificates.filter((certificate) => certificate.status === 'completed').length
      const returnedCount = ownedCertificates.filter((certificate) => certificate.status === 'draft' && latestRejection(certificate)).length
      const waitingFinal = ownedCertificates.filter((certificate) => certificate.status === 'sent' && !canUserAct(certificate, verifMap, user.id)).length

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
      // Parallelize station-related queries for user_station role
      let userStationIds = new Set<number>()
      let assignedStations: StationRow[] = []
      let stationDashboardInstruments: StationDashboardInstrument[] = []
      let stationDashboardStandards: CertificateStandardRow[] = []

      if (role === 'user_station') {
        userStationIds = await getUserStationIds(user.id)
        const stationIdArray = Array.from(userStationIds)
        // Parallelize station data and instrument data fetches
        const [stations, dashInstruments] = await Promise.all([
          getStationsByIds(stationIdArray),
          getStationDashboardInstruments(stationIdArray)
        ])
        assignedStations = stations
        stationDashboardInstruments = dashInstruments
        // Standards depend on instruments, so fetch after
        const sensorIds = Array.from(new Set(stationDashboardInstruments.flatMap((instrument) => instrument.sensor_ids)))
        stationDashboardStandards = await getCertificateStandardsBySensorIds(sensorIds)
      }

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
      // Use COUNT query instead of fetching all instruments
      const { count: instrumentCount } = await supabaseAdmin
        .from('instrument')
        .select('id', { count: 'exact', head: true })

      const stationSummaries = role === 'user_station'
        ? buildStationSummaries(assignedStations, instruments, relevantCertificates)
        : []
      const userStationDashboard = role === 'user_station'
        ? buildUserStationDashboard(assignedStations, stationDashboardInstruments, stationDashboardStandards, certificates, verifications)
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
        return getVerificationFast(verifMap, certificate.id, 1, version)?.status === 'pending'
      }).length
      const pendingLevel2 = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationFast(verifMap, certificate.id, 2, version)?.status === 'pending'
      }).length
      const pendingLevel3 = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationFast(verifMap, certificate.id, 3, version)?.status === 'pending'
      }).length
      const pendingSignature = certificates.filter((certificate) => {
        const version = certificate.version ?? 1
        return getVerificationFast(verifMap, certificate.id, 4, version)?.status === 'pending'
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
