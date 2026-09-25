import { normalizeStationId } from '../../lib/station-identity'

describe('station identity normalization', () => {
  it('trims and returns numeric WMO IDs', () => {
    expect(normalizeStationId('  96013 ')).toEqual({ ok: true, value: '96013' })
    expect(normalizeStationId(96013)).toEqual({ ok: true, value: '96013' })
  })

  it('treats empty and whitespace as null', () => {
    expect(normalizeStationId('')).toEqual({ ok: true, value: null })
    expect(normalizeStationId('   ')).toEqual({ ok: true, value: null })
    expect(normalizeStationId(null)).toEqual({ ok: true, value: null })
    expect(normalizeStationId(undefined)).toEqual({ ok: true, value: null })
  })

  it('rejects non-numeric identifiers', () => {
    expect(normalizeStationId('WIGOS-0-20000-0-96013')).toMatchObject({ ok: false })
    expect(normalizeStationId('96013A')).toMatchObject({ ok: false })
  })
})
