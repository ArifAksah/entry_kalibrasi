import {
    buildMissingDriftMessage,
    buildPyranometerInputs,
    calculateNewSensitivity,
    hasMissingDrift,
    isAnalogPyranometer,
    resolveCertU95Percent,
    resolveStdSensor,
} from '../../lib/pyranometer-inputs'
import { calculatePyranometerUncertainty } from '../../lib/uncertainty-utils'

/**
 * Sensitivitas baru pyranometer analog: Sbaru = Slama x CF final
 * (workbook pyranometer — sheet Brief, bagian "3.0 Perhitungan sensitivitas baru").
 */
describe('sensitivitas baru pyranometer', () => {
    it('mengalikan sensitivitas lama dengan CF final', () => {
        expect(calculateNewSensitivity(7.22, 1)).toBeCloseTo(7.22, 6)
        expect(calculateNewSensitivity(7.01, 1.05)).toBeCloseTo(7.3605, 6)
        expect(calculateNewSensitivity(12.5, 1.02)).toBeCloseTo(12.75, 6)
    })

    it('menerima nilai berbentuk string', () => {
        expect(calculateNewSensitivity('7.22', '1.05')).toBeCloseTo(7.581, 6)
    })

    it('null bila nilai tidak valid (kosong / nol / negatif)', () => {
        expect(calculateNewSensitivity(null, 1)).toBeNull()
        expect(calculateNewSensitivity(undefined, 1)).toBeNull()
        expect(calculateNewSensitivity('', 1)).toBeNull()
        expect(calculateNewSensitivity(7.22, 0)).toBeNull()
        expect(calculateNewSensitivity(7.22, null)).toBeNull()
        expect(calculateNewSensitivity(-1, 1.02)).toBeNull()
        expect(calculateNewSensitivity('bukan angka', 1.02)).toBeNull()
    })

    it('mendeteksi pyranometer analog dari instrument_type_id', () => {
        expect(isAnalogPyranometer({ instrument_type_id: 2 })).toBe(true)
        expect(isAnalogPyranometer({ instrument_type_id: 1 })).toBe(false)
        expect(isAnalogPyranometer({ instrument_type_id: null })).toBe(false)
        expect(isAnalogPyranometer(null)).toBe(false)
    })
})

describe('resolveCertU95Percent — U95 standar untuk pyranometer', () => {
    it('pakai u95_general bila tabel titik kosong (cara workbook: flat 2.1 %)', () => {
        expect(
            resolveCertU95Percent({ standardCertRecord: { u95_general: 2.1 }, rows: [] }),
        ).toBe(2.1)
    })

    it('0 bila tidak ada titik maupun u95_general', () => {
        expect(resolveCertU95Percent({ standardCertRecord: null, rows: [] })).toBe(0)
        expect(
            resolveCertU95Percent({ standardCertRecord: { u95_general: null }, rows: [] }),
        ).toBe(0)
    })
})

/**
 * Sensor standar sering tidak termuat di daftar sensor aplikasi (daftar yang
 * dikirim ke QC Check hanya berisi sensor instrumen UUT). Sebelum ada fallback
 * ini, tipe alat standar tak terbaca → drift ISO 9060 = 0 → U95 sertifikat salah
 * (2,109 % alih-alih 4,029 %).
 */
describe('resolveStdSensor — sensor standar dari daftar atau API', () => {
    const okFetcher = (payload: any) =>
        jest.fn(async () => ({
            ok: true,
            json: async () => payload,
        })) as unknown as typeof fetch

    it('dipakai dari daftar bila ada (tanpa memanggil API)', async () => {
        const fetcher = okFetcher({})
        const sensors = [{ id: 167, type: 'CMP3', name: 'ASRS' }]
        await expect(resolveStdSensor(167, sensors, fetcher)).resolves.toMatchObject({
            type: 'CMP3',
        })
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('diambil dari API bila tidak ada di daftar', async () => {
        const fetcher = okFetcher({ data: { id: 167, type: 'CMP3' } })
        await expect(resolveStdSensor(167, [{ id: 165 }], fetcher)).resolves.toMatchObject({
            type: 'CMP3',
        })
        expect(fetcher).toHaveBeenCalledWith('/api/sensors/167')
    })

    it('menerima payload tanpa pembungkus `data`', async () => {
        const fetcher = okFetcher({ id: 167, type: 'CMP3' })
        await expect(resolveStdSensor('167', [], fetcher)).resolves.toMatchObject({
            type: 'CMP3',
        })
    })

    it('null bila API gagal / status bukan ok', async () => {
        const failing = jest.fn(async () => {
            throw new Error('offline')
        }) as unknown as typeof fetch
        await expect(resolveStdSensor(167, [], failing)).resolves.toBeNull()

        const notOk = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch
        await expect(resolveStdSensor(167, [], notOk)).resolves.toBeNull()
    })

    it('null tanpa memanggil API bila id kosong', async () => {
        const fetcher = okFetcher({})
        await expect(resolveStdSensor(null, [], fetcher)).resolves.toBeNull()
        await expect(resolveStdSensor(undefined, [], fetcher)).resolves.toBeNull()
        expect(fetcher).not.toHaveBeenCalled()
    })
})

/**
 * Jaminan "tidak gagal senyap": sumber nilai drift harus terlihat di audit,
 * sehingga U95 yang dihitung tanpa drift tidak diterima sebagai nilai sah.
 */
describe('buildPyranometerInputs — sumber drift tercatat', () => {
    const rows = [
        { standard_data: 1000, uut_data: 1010 },
        { standard_data: 1001, uut_data: 1011 },
        { standard_data: 999, uut_data: 1009 },
    ]

    const build = (extra: Record<string, any>) =>
        buildPyranometerInputs({
            rows,
            standardCertRecord: { u95_general: 2.1, resolution: 0.01 },
            uutSensor: { type: 'MS-802', resolution: 0.01, range_capacity: '2000' },
            ...extra,
        })!

    it("drift dari tipe alat standar → drift_source 'type' dan drift 3 %", () => {
        const inputs = build({ stdSensor: { id: 167, type: 'CMP3' } })
        const result = calculatePyranometerUncertainty(inputs.params)
        expect(result.audit.drift_source).toBe('type')
        expect(result.audit.drift_value_percent).toBe(3)
        expect(result.audit.drift_class).toBe('C')
    })

    it("tipe standar tak terbaca → pakai drift sertifikat, drift_source 'certificate'", () => {
        const inputs = build({
            stdSensor: null,
            standardCertRecord: { u95_general: 2.1, resolution: 0.01, drift: 3 },
        })
        const result = calculatePyranometerUncertainty(inputs.params)
        expect(result.audit.drift_source).toBe('certificate')
        expect(result.audit.drift_value_percent).toBe(3)
    })

    it("tipe standar tak terbaca dan sertifikat tanpa drift → ditandai 'missing'", () => {
        const inputs = build({ stdSensor: { id: 167, type: 'EKO MS-802' } })
        const result = calculatePyranometerUncertainty(inputs.params)
        expect(result.audit.drift_source).toBe('missing')
        expect(result.audit.drift_value_percent).toBe(0)
    })
})

/**
 * Drift adalah komponen WAJIB. Perhitungan harus berhenti (bukan menulis U95)
 * ketika nilainya belum ada, dan pengguna diberi tahu cara melengkapinya.
 */
describe('gerbang drift wajib — buildMissingDriftMessage / hasMissingDrift', () => {
    it('hasMissingDrift hanya true untuk sumber `missing`', () => {
        expect(hasMissingDrift({ drift_source: 'missing' })).toBe(true)
        expect(hasMissingDrift({ drift_source: 'type' })).toBe(false)
        expect(hasMissingDrift({ drift_source: 'certificate' })).toBe(false)
        expect(hasMissingDrift({})).toBe(false)
        expect(hasMissingDrift(null)).toBe(false)
        expect(hasMissingDrift(undefined)).toBe(false)
    })

    it('pesan menyebut alat standar, sertifikat standar, dan cara perbaikan', () => {
        const message = buildMissingDriftMessage({
            stdSensor: { name: 'CMP3-ASRS', serial_number: '164097' },
            standardCertRecord: { no_certificate: '001/STD/2025' },
        })
        expect(message).toContain('CMP3-ASRS')
        expect(message).toContain('164097')
        expect(message).toContain('001/STD/2025')
        expect(message).toContain('Drift')
        expect(message).toContain('CMP3')
    })

    it('tetap dapat ditindaklanjuti tanpa detail sensor/sertifikat', () => {
        const message = buildMissingDriftMessage({})
        expect(message).toContain('alat standar')
        expect(message).toContain('Drift')
        expect(message).toContain('sertifikat standar')
    })
})
