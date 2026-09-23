import {
  clearQCLimitCache,
  fetchQCLimitForSensor,
  getQCLimitCacheKey,
} from '../../lib/qc-utils'

describe('unit-aware Master QC lookup', () => {
  beforeEach(() => {
    clearQCLimitCache()
    global.fetch = jest.fn()
  })

  it('normalizes equivalent unit formatting in cache keys', () => {
    expect(getQCLimitCacheKey(10, '^\\circ C')).toBe(
      getQCLimitCacheKey(10, '°C'),
    )
  })

  it('sends the selected UUT unit to the Master QC endpoint', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 7,
          nilai_batas_koreksi: '0.3',
          instrument_names: { names: 'Suhu' },
          ref_unit: { unit: '^\\circ C' },
        },
      }),
    })

    await expect(fetchQCLimitForSensor(10, '°C')).resolves.toMatchObject({
      masterQcId: 7,
      instrumentName: 'Suhu',
      unit: '°C',
      limitValue: 0.3,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/master-qc?sensor_id=10&unit_uut=%C2%B0C',
    )
  })

  it('keeps limits for the same sensor separate by UUT unit', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 7,
            nilai_batas_koreksi: '0.3',
            instrument_names: { names: 'Suhu' },
            ref_unit: { unit: '°C' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 8,
            nilai_batas_koreksi: '0.5',
            instrument_names: { names: 'Suhu' },
            ref_unit: { unit: '°F' },
          },
        }),
      })

    const celsius = await fetchQCLimitForSensor(10, '°C')
    const fahrenheit = await fetchQCLimitForSensor(10, '°F')
    const cachedCelsius = await fetchQCLimitForSensor(10, '^\\circ C')

    expect(celsius?.masterQcId).toBe(7)
    expect(fahrenheit?.masterQcId).toBe(8)
    expect(cachedCelsius?.masterQcId).toBe(7)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not query Master QC when the UUT unit is missing', async () => {
    await expect(fetchQCLimitForSensor(10, '')).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
