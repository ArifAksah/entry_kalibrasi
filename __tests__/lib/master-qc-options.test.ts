import {
  filterMasterQcItemsByCode,
  filterInstrumentNamesByCode,
  getInstrumentNameCodeId,
  paginateMasterQcItems,
} from '../../lib/master-qc-options'

const names = [
  { id: 1, name: 'AWOS Utama', instrument_code_id: 10 },
  { id: 2, name: 'AWOS Portable', instrument_code: { id: 10 } },
  { id: 3, name: 'AWS', instrument_code_id: 20 },
  { id: 4, name: 'Tanpa kode', instrument_code_id: null },
]

describe('Master QC instrument options', () => {
  it('shows only names belonging to the selected instrument code', () => {
    expect(filterInstrumentNamesByCode(names, 10).map((item) => item.id)).toEqual([
      1,
      2,
    ])
    expect(filterInstrumentNamesByCode(names, 20).map((item) => item.id)).toEqual([
      3,
    ])
  })

  it('shows no names before a code is selected', () => {
    expect(filterInstrumentNamesByCode(names, null)).toEqual([])
  })

  it('resolves code IDs from direct and nested API response shapes', () => {
    expect(getInstrumentNameCodeId(names[0])).toBe(10)
    expect(getInstrumentNameCodeId(names[1])).toBe(10)
    expect(getInstrumentNameCodeId(names[3])).toBeNull()
  })

  it('filters Master QC rows by their instrument code', () => {
    const rows = names.map((instrumentName) => ({ instrument_name: instrumentName }))
    expect(filterMasterQcItemsByCode(rows, 10)).toHaveLength(2)
    expect(filterMasterQcItemsByCode(rows, 20)).toHaveLength(1)
    expect(filterMasterQcItemsByCode(rows, null)).toHaveLength(4)
  })

  it('paginates filtered Master QC rows without changing their order', () => {
    const rows = Array.from({ length: 23 }, (_, index) => index + 1)
    expect(paginateMasterQcItems(rows, 1, 10)).toEqual(rows.slice(0, 10))
    expect(paginateMasterQcItems(rows, 3, 10)).toEqual([21, 22, 23])
  })
})
