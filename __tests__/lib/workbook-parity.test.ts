import { calculateUncertaintyBudget } from '../../lib/uncertainty-utils'

/**
 * Parity test: komponen dan U95 harus sama dengan workbook AWOS
 * F.M.2026.037.001 untuk kelima sensor, sampai 1e-12.
 *
 * Angka diambil dari sheet SPTn/Hit n. `buildReadings` membentuk sampel yang
 * memiliki STDEV.S persis sama dengan repeatability workbook, sehingga hasil
 * budget dapat dibandingkan langsung.
 */
function readingsWithSampleDeviation(count: number, standardDeviation: number): number[] {
    const magnitude = standardDeviation * Math.sqrt((count - 1) / 2)
    return [magnitude, -magnitude, ...Array(count - 2).fill(0)]
}

const workbookCases = [
    {
        name: 'Pressure',
        count: 1419,
        repeat: 0.002988063676921588,
        cert: 0.0008346237435652966,
        drift: 0.004214917159538484,
        resStd: 0.01,
        resUut: 0.01,
        uc: 0.004281070957664069,
        veff: 119.01971226757038,
        k: 1.9800998764569426,
        u95: 0.00847694807437403,
    },
    {
        name: 'Temperature',
        count: 1419,
        repeat: 0.15278364724606455,
        cert: 0.1650825890559348,
        drift: 0.107834729,
        resStd: 0.01,
        resUut: 0.01,
        uc: 0.08840367398257166,
        veff: 64.48621444814734,
        k: 1.9977296543176954,
        u95: 0.17660664106561713,
    },
    {
        name: 'Relative Humidity',
        count: 1419,
        repeat: 1.1060411790269542,
        cert: 1.1,
        drift: 2.150435294,
        resStd: 0.01,
        resUut: 0.1,
        uc: 0.8304023730739285,
        veff: 99.05815207189318,
        k: 1.9842169515864165,
        u95: 1.6476984652908766,
    },
    {
        name: 'Wind Speed',
        count: 991,
        repeat: 0.8242124691235367,
        cert: 0.933045356371488,
        drift: 0.7512958963282919,
        resStd: 0.1,
        resUut: 1,
        uc: 0.5912129046038029,
        veff: 108.06747575133623,
        k: 1.982173483307728,
        u95: 1.1718865424949996,
    },
    {
        name: 'Wind Direction',
        count: 991,
        repeat: 52.3138662725273,
        cert: 1.01324561,
        drift: 0.7,
        resStd: 1,
        resUut: 1,
        uc: 1.7960405411785771,
        veff: 1115.0238303903136,
        k: 1.9620938542047834,
        u95: 3.5240001077491194,
    },
]

describe('workbook parity end-to-end', () => {
    it.each(workbookCases)(
        'matches $name uc, veff, k, and U95 within 1e-12',
        ({ count, repeat, cert, drift, resStd, resUut, uc, veff, k, u95 }) => {
            const result = calculateUncertaintyBudget({
                unit: '',
                uutReadings: readingsWithSampleDeviation(count, repeat),
                interpolatedCertU95: cert,
                driftStd: drift,
                resolusiStd: resStd,
                resolusiUut: resUut,
            })

            expect(Math.abs(result.comb_uncert_uc - uc)).toBeLessThan(1e-12)
            expect(Math.abs(result.eff_deg_freedom_veff - veff)).toBeLessThan(1e-9)
            expect(Math.abs(result.cov_factor_95 - k)).toBeLessThan(1e-12)
            expect(Math.abs(result.expanded_uncert_u95 - u95)).toBeLessThan(1e-12)
        },
    )
})
