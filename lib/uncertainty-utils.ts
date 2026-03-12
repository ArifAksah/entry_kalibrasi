/**
 * lib/uncertainty-utils.ts
 *
 * Utilities for calculating Uncertainty Budget (U95) based on 5 components:
 * 1. Repeatability (s from raw readings)
 * 2. Standard Certificate U95 (interpolated)
 * 3. Drift Standard (from standard cert DB)
 * 4. Resolusi Standard (from standard cert DB)
 * 5. Resolusi UUT (from UUT sensor DB)
 */

import { CertCorrectionPoint } from './qc-utils';

export interface UncertaintyComponent {
    name: string;
    unit: string;
    distribution: 'Normal' | 'Rect' | 'Triangular';
    symbol: string;
    u_a: number; // U atau a
    cov_factor: number; // Pembagi
    deg_freedom: number; // vi
    std_uncertainty: number; // ui
    sens_coeff: number; // ci
    ci_ui: number;
    ci_ui_sq: number;
    ci_ui_quad_vi: number; // (ci.ui)^4 / vi
}

export interface UncertaintyResult {
    components: UncertaintyComponent[];
    sums: {
        ci_ui_sq: number;
        ci_ui_quad_vi: number;
    };
    comb_uncert_uc: number;
    eff_deg_freedom_veff: number;
    cov_factor_95: number;
    expanded_uncert_u95: number;
    unit: string;
}

/**
 * 1. Calculate Standard Deviation (Repeatability)
 * Formula: s = sqrt( sum((x - mean)^2) / (n - 1) )
 */
export function calculateStandardDeviation(data: number[]): number {
    if (data.length <= 1) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - 1);
    return Math.sqrt(variance);
}

/**
 * 2. Interpolate standard certificate U95
 */
export function interpolateU95FromPoints(
    points: CertCorrectionPoint[],
    standardReading: number
): number {
    if (points.length === 0) return 0;
    if (points.length === 1) return points[0].u95 || 0;

    // Sort ascending by setpoint
    const sorted = [...points].sort((a, b) => a.setpoint - b.setpoint);

    if (standardReading <= sorted[0].setpoint) return sorted[0].u95 || 0;
    if (standardReading >= sorted[sorted.length - 1].setpoint) return sorted[sorted.length - 1].u95 || 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        const lo = sorted[i];
        const hi = sorted[i + 1];
        if (standardReading >= lo.setpoint && standardReading <= hi.setpoint) {
            const t = (standardReading - lo.setpoint) / (hi.setpoint - lo.setpoint);
            const loU = lo.u95 || 0;
            const hiU = hi.u95 || 0;
            return loU + t * (hiU - loU);
        }
    }
    return 0;
}

/**
 * Get Coverage Factor (k) for 95% Confidence Level based on Effective Degrees of Freedom (veff)
 * Using Student's t-distribution table approximation for 95% CL.
 */
export function getCoverageFactorFor95(veff: number): number {
    // Round to nearest integer for table lookup
    const v = Math.round(veff);

    if (v <= 0) return 2.0; // Fallback

    // T-distribution table for 95% CL (two-tailed p=0.05)
    // Degrees of freedom 1 to 30, then typical larger values
    const tTable: Record<number, number> = {
        1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
        6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
        16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
        21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
        26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
        40: 2.021, 50: 2.009, 60: 2.000, 80: 1.990, 100: 1.984,
        120: 1.980, 1000: 1.962
    };

    if (tTable[v]) return tTable[v];

    // Interpolate or find closest for values not explicitly in table
    const keys = Object.keys(tTable).map(Number).sort((a, b) => a - b);
    if (v > keys[keys.length - 1]) return 1.96; // Approaches normal distribution

    // Find bounds
    let lower = 1, upper = 2;
    for (let i = 0; i < keys.length - 1; i++) {
        if (v > keys[i] && v < keys[i + 1]) {
            lower = keys[i];
            upper = keys[i + 1];
            break;
        }
    }

    // Linear interpolation between the two bounds
    const fraction = (v - lower) / (upper - lower);
    return tTable[lower] - fraction * (tTable[lower] - tTable[upper]);
}

/**
 * Main calculation builder for Uncertainty Budget
 */
export function calculateUncertaintyBudget(params: {
    unit: string;
    uutReadings: number[];
    interpolatedCertU95: number;
    driftStd: number;
    resolusiStd: number;
    resolusiUut: number;
    isAnalog?: boolean; // true = Analog (√6, Triangular), false/undefined = Digital (√3, Rectangular)
}): UncertaintyResult {
    const { unit, uutReadings, interpolatedCertU95, driftStd, resolusiStd, resolusiUut, isAnalog } = params;

    // Distribusi:
    //   Digital → Rectangular → pembagi √3 ≈ 1.732
    //   Analog  → Triangular  → pembagi √6 ≈ 2.449
    const resDist: 'Normal' | 'Rect' | 'Triangular' = isAnalog ? 'Triangular' : 'Rect';
    const resDivisor = isAnalog ? Math.sqrt(6) : Math.sqrt(3);

    const n = uutReadings.length;

    // 1. Repeatability
    const stdDev = calculateStandardDeviation(uutReadings);
    const u_repeat = stdDev; // u_repeat is just the std dev according to the user's excel image
    const v_repeat = n > 1 ? n - 1 : 1;
    // user's screenshot has divisor = sqrt(n).
    // Wait, the screenshot shows U atau a = 1.1154, Cov Factor/Pembagi = 28.618 (Wait, sqrt(818) is approx 28.6)
    // If pembagi is sqrt(n), then std_uncert = a / sqrt(n)
    const pembagi_repeat = Math.sqrt(n);

    // Components Array
    const components: UncertaintyComponent[] = [];

    const addComponent = (
        name: string,
        distribution: 'Normal' | 'Rect' | 'Triangular',
        symbol: string,
        u_or_a: number,
        cov_factor: number,
        deg_freedom: number,
        sens_coeff: number = 1
    ) => {
        const std_uncertainty = u_or_a / cov_factor;
        const ci_ui = sens_coeff * std_uncertainty;
        const ci_ui_sq = Math.pow(ci_ui, 2);

        // Handle infinity degrees of freedom (like 50 in the image, or larger)
        // Image shows: deg freedom is 50 for Cert, Drift, ResStd, ResUut. Let's use 50 by default if not specified as n-1.
        // Actually the image shows vi = 818 for repeat (if n=819 maybe?), and 50 for others.
        const vi = deg_freedom === Infinity ? 1e9 : deg_freedom;
        const ci_ui_quad_vi = Math.pow(ci_ui, 4) / vi;

        components.push({
            name,
            unit,
            distribution,
            symbol,
            u_a: u_or_a,
            cov_factor,
            deg_freedom,
            std_uncertainty,
            sens_coeff,
            ci_ui,
            ci_ui_sq,
            ci_ui_quad_vi
        });
    };

    // Add components based on the Excel screenshot rules:
    // 1. Repeat: U=s, div=sqrt(n), vi=n-1
    addComponent('Repeat', 'Normal', 'u_rep', u_repeat, pembagi_repeat > 0 ? pembagi_repeat : 1, Math.max(v_repeat, 1));

    // 2. Sertifikat Std: U=U95, div=2.000, vi=50
    addComponent('Sertifikat Std', 'Normal', 'u_sertf', interpolatedCertU95, 2.0, 50);

    // 3. Drift Std: a=drift, div=√3 (digital) or √6 (analog), vi=50
    addComponent('Drift Std', resDist, 'u_drift', driftStd, resDivisor, 50);

    // 4. Resolusi Std: a=resolusi/2, div=√3 (digital) or √6 (analog), vi=50
    const a_res_std = resolusiStd / 2;
    addComponent('Resolusi Std', resDist, 'u_resolusi_std', a_res_std, resDivisor, 50);

    // 5. Resolusi Uut: a=resolusi/2, div=√3 (digital) or √6 (analog), vi=50
    const a_res_uut = resolusiUut / 2;
    addComponent('Resolusi Uut', resDist, 'u_resolusi_uut', a_res_uut, resDivisor, 50);

    // Sums
    const sum_ci_ui_sq = components.reduce((acc, c) => acc + c.ci_ui_sq, 0);
    const sum_ci_ui_quad_vi = components.reduce((acc, c) => acc + c.ci_ui_quad_vi, 0);

    const comb_uncert_uc = Math.sqrt(sum_ci_ui_sq);

    // Effective Degrees of Freedom (veff) = uc^4 / sum_ci_ui_quad_vi
    const eff_deg_freedom_veff = sum_ci_ui_quad_vi > 0 ? Math.pow(comb_uncert_uc, 4) / sum_ci_ui_quad_vi : Infinity;

    // Coverage Factor 95%
    const cov_factor_95 = getCoverageFactorFor95(Math.floor(eff_deg_freedom_veff));

    // Expanded uncertainty
    const expanded_uncert_u95 = cov_factor_95 * comb_uncert_uc;

    return {
        components,
        sums: {
            ci_ui_sq: sum_ci_ui_sq,
            ci_ui_quad_vi: sum_ci_ui_quad_vi
        },
        comb_uncert_uc,
        eff_deg_freedom_veff,
        cov_factor_95,
        expanded_uncert_u95,
        unit
    };
}
