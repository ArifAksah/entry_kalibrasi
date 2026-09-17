import {
  filterCmcProfiles,
  getPrimaryCmcValue,
  paginateCmcProfiles,
} from '../../lib/master-cmc-options'

const profiles = [
  {
    code: 'CMC-TEMP',
    name: 'Suhu',
    parameter_code: 'TEMP',
    calibration_method: 'Comparison',
    source_document: 'DOC-1',
    is_active: true,
    cmc_values: [{ sequence: 2, unit: 'C', cmc_value: 0.2 }, { sequence: 1, unit: 'C', cmc_value: 0.1 }],
  },
  {
    code: 'CMC-RH',
    name: 'Kelembaban',
    parameter_code: 'RH',
    calibration_method: null,
    source_document: null,
    is_active: false,
    cmc_values: [{ sequence: 1, unit: '%RH', cmc_value: 1 }],
  },
]

describe('Master CMC list options', () => {
  it('filters by search, parameter, and status', () => {
    expect(filterCmcProfiles(profiles, 'comparison', '', 'all')).toHaveLength(1)
    expect(filterCmcProfiles(profiles, '', 'RH', 'all')).toHaveLength(1)
    expect(filterCmcProfiles(profiles, '', '', 'active')).toHaveLength(1)
    expect(filterCmcProfiles(profiles, '', '', 'inactive')).toHaveLength(1)
  })

  it('selects the lowest sequence as the primary value', () => {
    expect(getPrimaryCmcValue(profiles[0].cmc_values)?.cmc_value).toBe(0.1)
  })

  it('paginates without changing source order', () => {
    const rows = Array.from({ length: 21 }, (_, index) => index + 1)
    expect(paginateCmcProfiles(rows, 1, 10)).toEqual(rows.slice(0, 10))
    expect(paginateCmcProfiles(rows, 3, 10)).toEqual([21])
  })
})
