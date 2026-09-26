export type MeasurementRow = {
  standard_data?: unknown
  uut_data?: unknown
}

export function parseFiniteMeasurement(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = typeof value === 'string'
    ? Number(value.trim().replace(',', '.'))
    : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isPairedMeasurementRow<T extends MeasurementRow>(
  row: T,
): boolean {
  return (
    parseFiniteMeasurement(row.standard_data) !== null &&
    parseFiniteMeasurement(row.uut_data) !== null
  )
}

export function filterPairedMeasurementRows<T extends MeasurementRow>(
  rows: T[],
): T[] {
  return rows.filter(isPairedMeasurementRow)
}
