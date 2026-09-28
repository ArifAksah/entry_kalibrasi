import {
  isMissingColumnError,
  pickNameText,
  normalizeInstrumentNameRow,
  resolveInstrumentNameTextColumn,
  __resetInstrumentNameTextColumnCache,
} from '../../lib/instrument-names-schema'

describe('instrument_names dual-schema helper', () => {
  beforeEach(() => __resetInstrumentNameTextColumnCache())

  it('mengenali error kolom tidak ada (42703 & PGRST204)', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column x does not exist' }, 'name')).toBe(true)
    expect(
      isMissingColumnError(
        { code: 'PGRST204', message: "Could not find the 'name' column of 'instrument_names' in the schema cache" },
        'name',
      ),
    ).toBe(true)
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' }, 'name')).toBe(false)
  })

  it('mengambil teks dari name atau names', () => {
    expect(pickNameText({ name: 'Suhu' })).toBe('Suhu')
    expect(pickNameText({ names: 'Tekanan' })).toBe('Tekanan')
    expect(pickNameText({ name: 'A', names: 'B' })).toBe('A')
    expect(pickNameText(null)).toBe('')
  })

  it('normalisasi row menjadi {id,name,code_alat}', () => {
    expect(normalizeInstrumentNameRow({ id: 5, names: 'Barometer', code_alat: 'PP' })).toEqual({
      id: 5,
      name: 'Barometer',
      code_alat: 'PP',
      created_at: null,
    })
  })

  it('resolver memilih kolom name saat tersedia', async () => {
    const client = {
      from: () => ({
        select: (cols: string) => ({
          limit: async () => {
            if (cols.includes('name') && !cols.includes('names')) return { data: [{ id: 1 }], error: null }
            return { data: null, error: { code: '42703', message: 'column names does not exist' } }
          },
        }),
      }),
    }
    expect(await resolveInstrumentNameTextColumn(client)).toBe('name')
  })

  it('resolver fallback ke names saat name tidak ada', async () => {
    const client = {
      from: () => ({
        select: (cols: string) => ({
          limit: async () => {
            if (cols.includes('name') && !cols.includes('names')) {
              return { data: null, error: { code: '42703', message: 'column instrument_names.name does not exist' } }
            }
            return { data: [{ id: 1 }], error: null }
          },
        }),
      }),
    }
    expect(await resolveInstrumentNameTextColumn(client)).toBe('names')
  })
})
