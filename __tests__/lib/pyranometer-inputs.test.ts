import {
    calculateNewSensitivity,
    isAnalogPyranometer,
    resolveCertU95Percent,
} from '../../lib/pyranometer-inputs'

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
