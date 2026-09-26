import {
  filterPairedMeasurementRows,
  isPairedMeasurementRow,
  parseFiniteMeasurement,
} from '../../lib/measurement-rows'

describe('paired measurement rows', () => {
  it('keeps zero as a valid measurement', () => {
    expect(parseFiniteMeasurement(0)).toBe(0)
    expect(isPairedMeasurementRow({ standard_data: 0, uut_data: 0 })).toBe(true)
  })

  it('rejects blank, null, undefined, and non-numeric values', () => {
    for (const value of [null, undefined, '', '   ', 'abc', Number.NaN]) {
      expect(parseFiniteMeasurement(value)).toBeNull()
    }
  })

  it('keeps only rows where STD and UUT are both numeric', () => {
    const rows = [
      { id: 1, standard_data: 10, uut_data: 9.9 },
      { id: 2, standard_data: null, uut_data: 10 },
      { id: 3, standard_data: 10, uut_data: '' },
      { id: 4, standard_data: 0, uut_data: 0 },
    ]
    expect(filterPairedMeasurementRows(rows).map((row) => row.id)).toEqual([1, 4])
  })
})
