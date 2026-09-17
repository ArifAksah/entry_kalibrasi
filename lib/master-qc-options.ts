export type MasterQcInstrumentNameOption = {
  id: number
  instrument_code_id?: number | null
  instrument_code?: { id: number } | null
}

export function getInstrumentNameCodeId(
  instrumentName: MasterQcInstrumentNameOption | null | undefined,
): number | null {
  const value =
    instrumentName?.instrument_code_id ?? instrumentName?.instrument_code?.id
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function filterInstrumentNamesByCode<
  T extends MasterQcInstrumentNameOption,
>(instrumentNames: T[], instrumentCodeId: number | null): T[] {
  if (instrumentCodeId === null) return []
  return instrumentNames.filter(
    (instrumentName) =>
      getInstrumentNameCodeId(instrumentName) === instrumentCodeId,
  )
}

export type MasterQcListItem = {
  instrument_name?: MasterQcInstrumentNameOption | null
}

export function filterMasterQcItemsByCode<T extends MasterQcListItem>(
  items: T[],
  instrumentCodeId: number | null,
): T[] {
  if (instrumentCodeId === null) return items
  return items.filter(
    (item) =>
      getInstrumentNameCodeId(item.instrument_name) === instrumentCodeId,
  )
}

export function paginateMasterQcItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): T[] {
  const safePage = Math.max(1, Math.trunc(page) || 1)
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1)
  const start = (safePage - 1) * safePageSize
  return items.slice(start, start + safePageSize)
}
