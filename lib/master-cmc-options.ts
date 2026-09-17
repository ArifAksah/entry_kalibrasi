export type CmcValueOption = {
  id?: number
  sequence?: number
}

export type CmcProfileOption = {
  code: string
  name: string
  parameter_code: string
  calibration_method?: string | null
  source_document?: string | null
  is_active: boolean
  cmc_values?: Array<CmcValueOption & { unit?: string; cmc_value?: number }>
}

export function getPrimaryCmcValue<T extends CmcValueOption>(
  values: T[] | null | undefined,
): T | undefined {
  return [...(values || [])].sort(
    (a, b) => Number(a.sequence ?? 1) - Number(b.sequence ?? 1),
  )[0]
}

export function filterCmcProfiles<T extends CmcProfileOption>(
  items: T[],
  search: string,
  parameter: string,
  status: 'all' | 'active' | 'inactive',
): T[] {
  const query = search.trim().toLowerCase()
  return items.filter((item) => {
    if (parameter && item.parameter_code !== parameter) return false
    if (status === 'active' && !item.is_active) return false
    if (status === 'inactive' && item.is_active) return false
    if (!query) return true

    const values = item.cmc_values || []
    return [
      item.code,
      item.name,
      item.parameter_code,
      item.calibration_method,
      item.source_document,
      ...values.flatMap((value) => [value.unit, value.cmc_value]),
    ]
      .map((value) => String(value ?? '').toLowerCase())
      .some((value) => value.includes(query))
  })
}

export function paginateCmcProfiles<T>(
  items: T[],
  page: number,
  pageSize: number,
): T[] {
  const safePage = Math.max(1, Math.trunc(page) || 1)
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1)
  const start = (safePage - 1) * safePageSize
  return items.slice(start, start + safePageSize)
}
