export interface OrderedRawDataRow {
    id?: number | string | null;
    source_row_index?: number | null;
}

export function compareRawDataRows(a: OrderedRawDataRow, b: OrderedRawDataRow): number {
    const aSource = Number(a.source_row_index)
    const bSource = Number(b.source_row_index)
    if (Number.isFinite(aSource) && Number.isFinite(bSource) && aSource !== bSource) {
        return aSource - bSource
    }

    const aId = Number(a.id)
    const bId = Number(b.id)
    if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId
    return String(a.id ?? '').localeCompare(String(b.id ?? ''))
}
