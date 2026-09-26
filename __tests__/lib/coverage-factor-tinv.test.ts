import {
    getCoverageFactorFor95,
    studentTCDF,
} from '../../lib/uncertainty-utils'

// Nilai referensi = Excel TINV(0.05, df), yaitu kuantil ke-97.5% Student-t.
const excelTInv = [
    { df: 64, value: 1.9977296543176954 },
    { df: 99, value: 1.9842169515864165 },
    { df: 108, value: 1.982173483307728 },
    { df: 119, value: 1.9800998764569426 },
    { df: 1115, value: 1.9620938542047834 },
    { df: 10000, value: 1.960201239891639 },
]

const exactTable = [
    { df: 1, value: 12.706 },
    { df: 2, value: 4.303 },
    { df: 5, value: 2.571 },
    { df: 10, value: 2.228 },
    { df: 30, value: 2.042 },
]

describe('coverage factor Student-t', () => {
    it.each(excelTInv)(
        'matches Excel TINV(0.05, $df) within 1e-12',
        ({ df, value }) => {
            expect(Math.abs(getCoverageFactorFor95(df) - value)).toBeLessThan(1e-12)
        },
    )

    it.each(exactTable)(
        'keeps the exact tabulated value for df = $df',
        ({ df, value }) => {
            expect(getCoverageFactorFor95(df)).toBe(value)
        },
    )

    it('floors fractional veff before looking up k', () => {
        expect(getCoverageFactorFor95(119.01971226757043)).toBe(
            getCoverageFactorFor95(119),
        )
    })

    it('falls back to 2.0 for non-positive degrees of freedom', () => {
        expect(getCoverageFactorFor95(0)).toBe(2.0)
        expect(getCoverageFactorFor95(-5)).toBe(2.0)
    })

    it('approaches the normal quantile as df grows', () => {
        const z = 1.959963984540054
        const deviation100 = Math.abs(getCoverageFactorFor95(100) - z)
        const deviationMillion = Math.abs(getCoverageFactorFor95(1000000) - z)
        expect(deviationMillion).toBeLessThan(deviation100)
        expect(deviationMillion).toBeLessThan(1e-5)
    })

    it('returns a CDF consistent with the numeric quantile', () => {
        for (const { df } of excelTInv) {
            const k = getCoverageFactorFor95(df)
            expect(Math.abs(studentTCDF(k, df) - 0.975)).toBeLessThan(1e-12)
        }
    })
})
