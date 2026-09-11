import { resultsToLegacyView } from '../validators/certificate-results-render-adapter'

export type UutTrendPoint = {
  certificate_id: number
  certificate_no: string
  date: string
  correction: number | null
  uncertainty: number | null
  raw_uncertainty: number | null
  cmc: number | null
  unit: string
}

export type UutTrendSeries = {
  instrument_id: number
  instrument_name: string
  instrument_code: string
  sensor_id: number | null
  sensor_name: string
  points: UutTrendPoint[]
}

export type UutTrendCertificate = {
  id: number
  no_certificate?: string | null
  instrument?: number | null
  issue_date?: string | null
  pdf_generated_at?: string | null
  created_at?: string | null
  results?: unknown
}

export type UutTrendInstrument = {
  id: number
  name: string
  code: string
  sensor_ids?: number[]
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function dateFor(certificate: UutTrendCertificate): string | null {
  const candidate = certificate.issue_date || certificate.pdf_generated_at || certificate.created_at
  if (!candidate || !Number.isFinite(new Date(candidate).getTime())) return null
  return new Date(candidate).toISOString()
}

export function buildUutTrendSeries(
  certificates: UutTrendCertificate[],
  instruments: UutTrendInstrument[],
): UutTrendSeries[] {
  const instrumentById = new Map(instruments.map(instrument => [Number(instrument.id), instrument]))
  const output = new Map<string, UutTrendSeries>()

  for (const certificate of certificates) {
    const instrumentId = Number(certificate.instrument)
    const instrument = instrumentById.get(instrumentId)
    const date = dateFor(certificate)
    if (!instrument || !date) continue

    for (const result of resultsToLegacyView(certificate.results)) {
      const rows = (result.table || []).flatMap(section => section.rows || []) as any[]
      const correction = average(rows.map(row => numeric(row.unit)))
      const uncertainty = average(rows.map(row => numeric(row.uncertaintyMeta?.reported_u95 ?? row.value)))
      const rawUncertainty = average(rows.map(row => numeric(row.uncertaintyMeta?.raw_u95 ?? row.value)))
      const cmc = average(rows.map(row => numeric(row.uncertaintyMeta?.cmc_value_output)))
      if (correction === null && uncertainty === null) continue

      const sensorId = result.sensorId == null ? null : Number(result.sensorId)
      const sensorName = result.sensorDetails?.name || (sensorId ? `Sensor #${sensorId}` : instrument.name)
      const key = `${instrumentId}:${sensorId ?? 'unknown'}`
      const series = output.get(key) || {
        instrument_id: instrumentId,
        instrument_name: instrument.name,
        instrument_code: instrument.code,
        sensor_id: sensorId,
        sensor_name: sensorName,
        points: [],
      }
      series.points.push({
        certificate_id: certificate.id,
        certificate_no: certificate.no_certificate || `Sertifikat #${certificate.id}`,
        date,
        correction,
        uncertainty,
        raw_uncertainty: rawUncertainty,
        cmc,
        unit: result.unitUut || '',
      })
      output.set(key, series)
    }
  }

  return Array.from(output.values())
    .map(series => ({ ...series, points: series.points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) }))
    .filter(series => series.points.length > 0)
    .sort((a, b) => a.instrument_name.localeCompare(b.instrument_name) || a.sensor_name.localeCompare(b.sensor_name))
}

export function filterTrendPoints(points: UutTrendPoint[], months: number | null, now = new Date()): UutTrendPoint[] {
  if (months === null) return points
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  return points.filter(point => new Date(point.date).getTime() >= cutoff.getTime())
}
