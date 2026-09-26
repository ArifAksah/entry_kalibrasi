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
import { canConvertUnit, convertDeltaUnit, convertUnit, normaliseUnit } from './unitConversion';
import { parseCertCorrectionPoints, interpolateCorrectionFromPoints } from './qc-utils';
import { isWindDirectionSensor, wrapWindDirectionCorrection } from './wind-direction';
import { filterPairedMeasurementRows, parseFiniteMeasurement } from './measurement-rows';

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

export function normalizeStdUncertaintyComponents(params: {
    interpolatedCertU95: number;
    driftStd: number;
    resolusiStd: number;
    unitStd: string;
    unitUut: string;
}) {
    const { interpolatedCertU95, driftStd, resolusiStd, unitStd, unitUut } = params;
    const needsUnitConversion = !!unitStd && !!unitUut && normaliseUnit(unitStd) !== normaliseUnit(unitUut);
    const converted = !needsUnitConversion || canConvertUnit(unitStd, unitUut);
    return {
        interpolatedCertU95: converted ? convertDeltaUnit(interpolatedCertU95, unitStd, unitUut) : interpolatedCertU95,
        driftStd: converted ? convertDeltaUnit(driftStd, unitStd, unitUut) : driftStd,
        // Workbook keeps the numeric STD resolution unchanged, then applies /2
        // in the uncertainty budget even when the output unit differs.
        resolusiStd,
        converted,
        needsUnitConversion,
    };
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
            if (hi.setpoint === lo.setpoint) return lo.u95 || 0;
            const t = (standardReading - lo.setpoint) / (hi.setpoint - lo.setpoint);
            const loU = lo.u95 || 0;
            const hiU = hi.u95 || 0;
            return loU + t * (hiU - loU);
        }
    }
    return 0;
}

/** Lanczos approximation of ln(Γ(x)) for x > 0. */
function logGamma(x: number): number {
    const coefficients = [
        76.18009172947146,
        -86.50532032941677,
        24.01409824083091,
        -1.231739572450155,
        0.1208650973866179e-2,
        -0.5395239384953e-5,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
        y += 1;
        ser += coefficients[j] / y;
    }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Continued fraction for the regularized incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const MAX_ITERATIONS = 300;
    const EPSILON = 3e-16;
    const TINY = 1e-300;

    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;

    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= MAX_ITERATIONS; m++) {
        const m2 = 2 * m;

        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < TINY) d = TINY;
        c = 1 + aa / c;
        if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d;
        h *= d * c;

        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < TINY) d = TINY;
        c = 1 + aa / c;
        if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d;
        const delta = d * c;
        h *= delta;

        if (Math.abs(delta - 1) < EPSILON) break;
    }

    return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    const betacfTerm =
        Math.exp(
            logGamma(a + b) -
                logGamma(a) -
                logGamma(b) +
                a * Math.log(x) +
                b * Math.log(1 - x),
        );

    if (x < (a + 1) / (a + b + 2)) {
        return (betacfTerm * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (betacfTerm * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Cumulative distribution function of Student's t with df degrees of freedom. */
export function studentTCDF(t: number, df: number): number {
    if (df <= 0) return Number.NaN;
    const x = df / (df + t * t);
    const tail = 0.5 * regularizedIncompleteBeta(df / 2, 0.5, x);
    return t > 0 ? 1 - tail : tail;
}

/** Inverse CDF (quantile) of Student's t via bisection. */
function studentTInverse(probability: number, df: number): number {
    if (df <= 0) return Number.NaN;
    if (probability <= 0) return Number.NEGATIVE_INFINITY;
    if (probability >= 1) return Number.POSITIVE_INFINITY;

    let low = 0;
    let high = 1000;
    for (let i = 0; i < 200; i++) {
        const mid = (low + high) / 2;
        if (studentTCDF(mid, df) < probability) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}

const coverageFactorCache = new Map<number, number>();

/**
 * Get Coverage Factor (k) for 95% Confidence Level based on Effective Degrees of Freedom (veff).
 *
 * - df <= 30: exact tabulated Student-t values (t_{0.975, df}).
 * - df > 30 : exact inverse Student-t via regularized incomplete beta, matching
 *   Excel TINV(0.05, df) to ~1e-13. Results are cached per df because the QC
 *   calculation calls this repeatedly for the same veff.
 */
export function getCoverageFactorFor95(veff: number): number {
    const v = Math.floor(veff);

    if (v <= 0) return 2.0; // Fallback

    // T-distribution table for 95% CL (two-tailed p=0.05)
    // Degrees of freedom 1 to 30.
    const tTable: Record<number, number> = {
        1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
        6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
        16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
        21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
        26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
    };

    if (v <= 30 && tTable[v]) return tTable[v];

    const cached = coverageFactorCache.get(v);
    if (cached !== undefined) return cached;

    const k = studentTInverse(0.975, v);
    coverageFactorCache.set(v, k);
    return k;
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

    // 3. Drift Std: workbook uses a=drift/2, div=√3 or √6, vi=50
    const a_drift_std = driftStd / 2;
    addComponent('Drift Std', resDist, 'u_drift', a_drift_std, resDivisor, 50);

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
    const cov_factor_95 = getCoverageFactorFor95(eff_deg_freedom_veff);

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

/**
 * calculateCalibrationResult
 * Wrapper untuk menghitung Rata-rata UUT, Rata-rata Koreksi, dan U95 Ketidakpastian
 * menggunakan data mentah (QC Data) yang sama seperti di UncertaintyModal.
 */
export function calculateCalibrationResult(params: {
    currentData: any[];
    uutSensor: any;
    standardCertRecord: any;
    isAnalog?: boolean;
    unitUut?: string;
    isWindDirection?: boolean;
    finalCorrections?: number[];
}) {
    const { uutSensor, standardCertRecord, isAnalog } = params;
    const currentData = filterPairedMeasurementRows(params.currentData || []);
    
    if (!currentData || currentData.length === 0) {
        return { uutAvg: 0, correction: 0, uncertainty: 0 };
    }

    const rawResolusiUut = uutSensor?.resolution != null
        ? uutSensor.resolution
        : parseFloat(uutSensor?.graduating ?? '0');
    const resolusiUut = isNaN(rawResolusiUut) ? 0 : rawResolusiUut;

    let unitUut = params.unitUut || currentData[0]?.unit_uut || uutSensor?.graduating_unit || uutSensor?.range_capacity_unit || 'Unit';
    const isWindDirection = params.isWindDirection ?? isWindDirectionSensor({
        name: uutSensor?.name,
        type: uutSensor?.type,
        sheet_name: currentData[0]?.sheet_name,
    });

    const driftStd = typeof standardCertRecord?.drift === 'number' 
        ? standardCertRecord.drift 
        : parseFloat(standardCertRecord?.drift) || 0;
    const resolusiStd = typeof standardCertRecord?.resolution === 'number' 
        ? standardCertRecord.resolution 
        : parseFloat(standardCertRecord?.resolution) || 0;

    const stdCorrectionPoints = standardCertRecord ? parseCertCorrectionPoints(standardCertRecord) : [];

    let totalStdCorrected = 0;
    let totalUut = 0;

    currentData.forEach((row) => {
        const stdData = parseFiniteMeasurement(row.standard_data)!;
        const correction = stdCorrectionPoints.length > 0
            ? interpolateCorrectionFromPoints(stdCorrectionPoints, stdData)
            : 0;
        totalStdCorrected += (stdData + correction);
        totalUut += parseFiniteMeasurement(row.uut_data)!;
    });

    const globalStdCorrected = totalStdCorrected / currentData.length;
    // Workbook uses AVERAGE for displayed STD/UUT headings, including Wind Direction.
    const globalUutAvg = totalUut / currentData.length;

    const unitStd = currentData[0]?.unit_std || '';
    const calculatedCorrections = currentData.map(row => {
        const stdData = parseFiniteMeasurement(row.standard_data)!;
        const unitStdRow = row.unit_std || unitStd || '';
        const unitUutRow = row.unit_uut || unitUut || '';
        
        const correction = stdCorrectionPoints.length > 0
            ? interpolateCorrectionFromPoints(stdCorrectionPoints, stdData)
            : 0;
        const stdCorrected = stdData + correction;
        
        const stdCorrectedInUutUnit = unitStdRow && unitUutRow && unitStdRow.toLowerCase() !== unitUutRow.toLowerCase()
            ? convertUnit(stdCorrected, unitStdRow, unitUutRow)
            : stdCorrected;
            
        const deltaRaw = stdCorrectedInUutUnit - parseFiniteMeasurement(row.uut_data)!;
        return isWindDirection ? wrapWindDirectionCorrection(deltaRaw) : deltaRaw;
    });
    const finalCorrections = params.finalCorrections?.length === currentData.length
        && params.finalCorrections.every(Number.isFinite)
        ? params.finalCorrections
        : calculatedCorrections;

    let interpolatedU95 = 0;
    if (stdCorrectionPoints.length > 0) {
        interpolatedU95 = interpolateU95FromPoints(stdCorrectionPoints, globalStdCorrected);
    } else if (standardCertRecord?.u95_general) {
        interpolatedU95 = typeof standardCertRecord.u95_general === 'number'
            ? standardCertRecord.u95_general
            : parseFloat(standardCertRecord.u95_general) || 0;
    }

    const normalizedStdComponents = normalizeStdUncertaintyComponents({
        interpolatedCertU95: interpolatedU95,
        driftStd,
        resolusiStd,
        unitStd,
        unitUut,
    });

    const result = calculateUncertaintyBudget({
        unit: unitUut,
        uutReadings: finalCorrections,
        interpolatedCertU95: normalizedStdComponents.interpolatedCertU95,
        driftStd: normalizedStdComponents.driftStd,
        resolusiStd: normalizedStdComponents.resolusiStd,
        resolusiUut,
        isAnalog: !!isAnalog
    });

    let uutUnitStdCorrected = globalStdCorrected;
    if (unitStd && unitUut && unitStd.toLowerCase() !== unitUut.toLowerCase()) {
        uutUnitStdCorrected = convertUnit(globalStdCorrected, unitStd, unitUut);
    }
    const correctionAvg = params.finalCorrections
        ? finalCorrections.reduce((sum, correction) => sum + correction, 0) / (finalCorrections.length || 1)
        : isWindDirection
            ? finalCorrections.reduce((sum, correction) => sum + correction, 0) / (finalCorrections.length || 1)
            : uutUnitStdCorrected - globalUutAvg;

    return {
        uutAvg: globalUutAvg,
        correction: correctionAvg,
        uncertainty: result.expanded_uncert_u95
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
// PYRANOMETER CALIBRATION - TERPISAH, TIDAK MEMPENGARUHI KODE EXISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Konfigurasi khusus pyranometer
 * Berdasarkan ISO 9060:2018 dan standar kalibrasi BMKG
 */
export const PYRANOMETER_CONFIG = {
    // Keywords untuk deteksi pyranometer
    KEYWORDS: [
        'pyranometer', 'pyrheliometer', 'radiation', 'solar',
        'global', 'diffuse', 'net radiometer', 'uv-a', 'uv-b',
        'sunshine duration', 'cmp22', 'cmp21', 'cmp11', 'cmp10',
        'cmp6', 'cmp3', 'splite2', 'qms102', 'qms101',
        'ms-802', 'ms-80', 'eko'
    ],
    
    // High confidence keywords (langsung return true)
    HIGH_CONFIDENCE_KEYWORDS: [
        'pyranometer', 'pyrheliometer', 'net radiometer',
        'cmp22', 'cmp21', 'cmp11', 'cmp10',
        'cmp6', 'cmp3', 'ms-802', 'ms-80'
    ],
    
    // instrument_code untuk solar radiation
    RADIATION_CODES: ['SR'],
    
    // ISO 9060:2018 Drift Classification (%)
    ISO_DRIFT: {
        'A': 0.8,   // CMP22, CMP21, CMP11, CMP10
        'B': 1.5,   // CMP6
        'C': 3.0,   // CMP3, SPLite2, QMS102, QMS101
    } as Record<string, number>,
    
    // Default range jika tidak ada (W/m²)
    DEFAULT_RANGE: 2000,
    
    // Minimal data untuk perhitungan
    MIN_READINGS: 3,
    
    // Default outlier threshold (standar deviasi)
    DEFAULT_OUTLIER_THRESHOLD: 2,
    
    // Default coverage factor (veff ≈ 50, 95% CL)
    DEFAULT_K_FACTOR: 2.01,
};

/**
 * Interface untuk data sensor pyranometer
 */
export interface PyranometerSensorData {
    name?: string;
    type?: string;
    instrument_code?: string;
    resolution?: number;
    range_capacity?: string;
    sensor_name_id?: number;
}

/**
 * Interface untuk hasil perhitungan Faktor Kalibrasi (CF)
 */
export interface CalibrationFactorResult {
    cf_i: number[];
    cf_final: number;
    n_total: number;
    n_filtered: number;
    outlier_indices: number[];
    std_dev: number;         // Stdev dari data filtered
    std_dev_all?: number;    // Stdev dari semua data (untuk Repeat)
    mean_all?: number;       // Mean dari semua data (untuk Repeat - konsisten dengan std_dev_all)
    n_all?: number;          // Jumlah semua data (untuk Repeat)
}

/**
 * Interface untuk komponen uncertainty pyranometer
 */
export interface PyranometerUncertaintyComponent {
    name: string;
    value_percent: number;
    u_percent: number;
    distribution: 'Normal' | 'Rectangular';
    divisor: number;
    deg_freedom: number; // Derajat kebebasan
}

/**
 * Interface untuk hasil uncertainty pyranometer
 */
export interface PyranometerUncertaintyResult {
    cf_result: CalibrationFactorResult;
    components: PyranometerUncertaintyComponent[];
    uc_percent: number;
    u95_percent: number;
    k_factor: number;
    certificate: {
        calibration_factor: number;
        correction_percent: number;
        uncertainty_percent: number;
    };
}

// ═══════════════════════════════════════════════════════════════
// FUNGSI DETEKSI PYRANOMETER
// ═══════════════════════════════════════════════════════════════

/**
 * Deteksi apakah sensor adalah pyranometer
 * Kombinasi: instrument_code = 'SR' + keyword matching
 * 
 * SAFEGUARD:
 * - Hanya return true jika KONFIDEN sensor adalah pyranometer
 * - Jika ragu, return false (fallback ke metode lama)
 */
export function isPyranometer(sensor: PyranometerSensorData | null | undefined): boolean {
    // SAFEGUARD 1: Sensor harus ada
    if (!sensor) return false;
    
    // SAFEGUARD 2: Cek instrument_code (paling konfiden)
    if (sensor.instrument_code) {
        const code = sensor.instrument_code.toUpperCase().trim();
        if (PYRANOMETER_CONFIG.RADIATION_CODES.includes(code)) {
            return true;
        }
    }
    
    // SAFEGUARD 3: Cek keyword spesifik (tinggi)
    const nameText = (sensor.name || '').toLowerCase();
    const typeText = (sensor.type || '').toLowerCase();
    const combinedText = `${nameText} ${typeText}`;
    
    const hasHighConfidence = PYRANOMETER_CONFIG.HIGH_CONFIDENCE_KEYWORDS.some(kw => 
        combinedText.includes(kw)
    );
    
    if (hasHighConfidence) return true;
    
    // SAFEGUARD 4: Keyword umum perlu kombinasi
    const mediumKeywords = ['radiation', 'solar', 'global', 'diffuse'];
    const hasMedium = mediumKeywords.some(kw => combinedText.includes(kw));
    
    if (hasMedium) {
        const contextKeywords = ['w/m', 'wm', 'irradiance', 'radiometer'];
        const hasContext = contextKeywords.some(kw => combinedText.includes(kw));
        if (hasContext) return true;
    }
    
    // SAFEGUARD 5: Default ke false (aman)
    return false;
}

/**
 * Mendapatkan ISO 9060:2018 Class dari tipe sensor
 * Return null jika tidak diketahui
 */
export function getISO9060Class(sensorType: string): 'A' | 'B' | 'C' | null {
    const type = (sensorType || '').toUpperCase();
    
    if (['CMP22', 'CMP21', 'CMP11', 'CMP10'].some(t => type.includes(t))) {
        return 'A';
    }
    if (type.includes('CMP6')) {
        return 'B';
    }
    if (['CMP3', 'SPLITE2', 'QMS102', 'QMS101'].some(t => type.includes(t))) {
        return 'C';
    }
    
    return null;
}

/**
 * Mendapatkan drift value berdasarkan ISO 9060:2018
 * Return 0 jika tidak diketahui
 */
export function getISO9060Drift(sensorType: string): number {
    const isoClass = getISO9060Class(sensorType);
    if (!isoClass) return 0;
    return PYRANOMETER_CONFIG.ISO_DRIFT[isoClass];
}

// ═══════════════════════════════════════════════════════════════
// FUNGSI PERHITUNGAN FAKTOR KALIBRASI (CF)
// ═══════════════════════════════════════════════════════════════

/**
 * Membuat empty CF result (untuk error handling)
 */
function createEmptyCFResult(): CalibrationFactorResult {
    return {
        cf_i: [],
        cf_final: 0,
        n_total: 0,
        n_filtered: 0,
        outlier_indices: [],
        std_dev: 0,
        std_dev_all: 0,
        mean_all: 0,
        n_all: 0
    };
}

/**
 * Hitung Faktor Kalibrasi (CF) untuk pyranometer
 * CF_i = Std_i / UUT_i
 * CF_final = avg(CF_i) setelah filter outlier
 * 
 * SAFEGUARD:
 * - Validasi input sebelum hitung
 * - Handle division by zero
 * - Filter outlier otomatis
 * - Return empty result jika data tidak valid
 */
export function calculateCalibrationFactor(
    stdReadings: number[],
    uutReadings: number[],
    options: {
        outlierThreshold?: number;
        minReadings?: number;
    } = {}
): CalibrationFactorResult {
    const { 
        outlierThreshold = PYRANOMETER_CONFIG.DEFAULT_OUTLIER_THRESHOLD, 
        minReadings = PYRANOMETER_CONFIG.MIN_READINGS 
    } = options;
    
    // SAFEGUARD 1: Validasi input
    if (!stdReadings || !uutReadings) {
        return createEmptyCFResult();
    }
    
    if (stdReadings.length !== uutReadings.length) {
        return createEmptyCFResult();
    }
    
    if (stdReadings.length < minReadings) {
        return createEmptyCFResult();
    }
    
    // SAFEGUARD 2: Filter data valid
    const validPairs: { std: number; uut: number }[] = [];
    for (let i = 0; i < stdReadings.length; i++) {
        const std = stdReadings[i];
        const uut = uutReadings[i];
        
        // Skip data tidak valid
        if (std == null || uut == null) continue;
        if (!isFinite(std) || !isFinite(uut)) continue;
        if (std <= 0 || uut <= 0) continue;
        
        validPairs.push({ std, uut });
    }
    
    if (validPairs.length < minReadings) {
        return createEmptyCFResult();
    }
    
    // Hitung CF_i
    const cf_i = validPairs.map(p => p.std / p.uut);
    const n = cf_i.length;
    
    // Hitung statistik dari SEMUA data (untuk Repeat - konsisten dengan Excel)
    const mean_all = cf_i.reduce((a, b) => a + b, 0) / n;
    const variance_all = cf_i.reduce((a, b) => a + Math.pow(b - mean_all, 2), 0) / (n - 1);
    const sd_all = Math.sqrt(variance_all);
    
    // SAFEGUARD 3: Filter outlier (untuk cf_final yang lebih robust)
    const lowerBound = mean_all - outlierThreshold * sd_all;
    const upperBound = mean_all + outlierThreshold * sd_all;
    
    const outlierIndices: number[] = [];
    const filteredCF: number[] = [];
    
    cf_i.forEach((cf, idx) => {
        if (cf >= lowerBound && cf <= upperBound) {
            filteredCF.push(cf);
        } else {
            outlierIndices.push(idx);
        }
    });
    
    // SAFEGUARD 4: Pastikan cukup data setelah filter
    if (filteredCF.length < minReadings) {
        // Jika terlalu banyak outlier, gunakan semua data
        return {
            cf_i,
            cf_final: mean_all,
            n_total: n,
            n_filtered: n,
            outlier_indices: [],
            std_dev: sd_all,
            std_dev_all: sd_all,
            mean_all: mean_all,
            n_all: n
        };
    }
    
    // Hitung CF_final dari data bersih (untuk display/koreksi)
    const cfFinal = filteredCF.reduce((a, b) => a + b, 0) / filteredCF.length;
    const filteredVariance = filteredCF.reduce((a, b) => a + Math.pow(b - cfFinal, 2), 0) / (filteredCF.length - 1);
    const filteredSD = Math.sqrt(filteredVariance);
    
    return {
        cf_i,
        cf_final: cfFinal,         // Mean dari data filtered (untuk display)
        n_total: n,
        n_filtered: filteredCF.length,
        outlier_indices: outlierIndices,
        std_dev: filteredSD,       // Stdev dari data filtered
        std_dev_all: sd_all,       // Stdev dari SEMUA data (untuk Repeat)
        mean_all: mean_all,        // Mean dari SEMUA data (untuk Repeat)
        n_all: n                   // Jumlah semua data (untuk Repeat)
    };
}

// ═══════════════════════════════════════════════════════════════
// FUNGSI UNCERTAINTY PYRANOMETER
// ═══════════════════════════════════════════════════════════════

/**
 * Membuat empty pyranometer result (untuk error handling)
 */
function createEmptyPyranometerResult(): PyranometerUncertaintyResult {
    return {
        cf_result: createEmptyCFResult(),
        components: [],
        uc_percent: 0,
        u95_percent: 0,
        k_factor: PYRANOMETER_CONFIG.DEFAULT_K_FACTOR,
        certificate: {
            calibration_factor: 0,
            correction_percent: 0,
            uncertainty_percent: 0
        }
    };
}

/**
 * Hitung uncertainty budget untuk pyranometer (dalam %)
 * 
 * Komponen:
 * 1. Repeat (%) - dari std dev CF
 * 2. Sertifikat Std (%) - dari sertifikat kalibrasi standar
 * 3. Resolusi Std (%) - dari range alat
 * 4. Drift Std (%) - dari ISO 9060:2018
 * 5. Resolusi UUT (%) - dari range alat
 * 
 * SAFEGUARD:
 * - Fungsi TERPISAH dari calculateUncertaintyBudget()
 * - Tidak mengubah apapun di sistem existing
 */
export function calculatePyranometerUncertainty(params: {
    cf_result: CalibrationFactorResult;
    certU95_percent: number;
    resolutionStd: number;
    resolutionUut: number;
    range: number;
    sensorType: string;
    /** Rata-rata pembacaan standar (W/m²) — dipakai sebagai pembagi resolusi std */
    stdMean?: number;
    /** Rata-rata pembacaan UUT (W/m²) — dipakai sebagai pembagi resolusi UUT */
    uutMean?: number;
    /** Nilai minimum pembacaan standar (W/m²) — dipakai sebagai pembagi resolusi */
    stdMin?: number;
    /** Tipe alat standar (untuk lookup ISO 9060 Drift). Jika tidak diisi, fallback ke sensorType UUT. */
    stdSensorType?: string;
    /** Sensitivitas standar (µV/Wm⁻²) — untuk hitung resolusi dari sensitivitas */
    sensitivityStd?: number;
    /** Sensitivitas UUT (µV/Wm⁻²) — untuk hitung resolusi dari sensitivitas */
    sensitivityUut?: number;
}): PyranometerUncertaintyResult {
    const { cf_result, certU95_percent, resolutionStd, resolutionUut, range, sensorType, stdMean, uutMean, stdMin, stdSensorType, sensitivityStd, sensitivityUut } = params;
    
    // SAFEGUARD: Validasi CF result
    if (cf_result.n_filtered === 0 || cf_result.cf_final === 0) {
        return createEmptyPyranometerResult();
    }
    
    // Hitung rata-rata pembacaan untuk perhitungan resolusi
    const effectiveStdMean = stdMean && stdMean > 0 ? stdMean : range;
    const effectiveUutMean = uutMean && uutMean > 0 ? uutMean : range;
    
    // Hitung resolusi efektif
    // Gunakan resolusi dari sensor
    const effectiveResStd = resolutionStd;
    const effectiveResUut = resolutionUut;
    
    // 1. Repeat (dalam %)
    // Formula Excel: =stdev_CF / mean_CF * 100%
    // HARUS pakai mean dan stdev dari SEMUA data (konsisten, tanpa filter outlier)
    const repeatStdDev = cf_result.std_dev_all || cf_result.std_dev;
    const repeatMean = cf_result.mean_all || cf_result.cf_final; // mean SEMUA data, konsisten dengan std_dev_all
    const repeatN = cf_result.n_all || cf_result.n_total;
    const repeatDegFreedom = repeatN - 1;
    const repeatU = repeatStdDev / repeatMean;
    const u_repeat = repeatU / Math.sqrt(repeatN);
    
    console.log('[PYRANO REPEAT]', {
        std_dev_all: repeatStdDev,
        mean_all: repeatMean,
        cf_final: cf_result.cf_final,
        n: repeatN,
        repeatU: repeatU,
    });
    
    // 2. Sertifikat Std (dalam %)
    const certStdPercent = certU95_percent;
    const u_cert = certStdPercent / 2;
    
    // 3. Resolusi Std (dalam %)
    // Formula: U = 0.5 × resolusi_STD / mean_STD (TANPA × 100)
    const resStdPercent = effectiveStdMean > 0 ? (0.5 * effectiveResStd / effectiveStdMean) : 0;
    const u_res_std = resStdPercent / Math.sqrt(3);
    
    // 4. Drift Std (dalam %, dari ISO 9060:2018)
    const driftSensorType = stdSensorType || sensorType;
    const driftPercent = getISO9060Drift(driftSensorType);
    const u_drift = driftPercent / Math.sqrt(3);
    
    // 5. Resolusi UUT (dalam %)
    // Formula: U = 0.5 × resolusi_UUT / mean_UUT (TANPA × 100)
    const resUutPercent = effectiveUutMean > 0 ? (0.5 * effectiveResUut / effectiveUutMean) : 0;
    const u_res_uut = resUutPercent / Math.sqrt(3);
    
    // Components array dengan formula yang sesuai Excel
    const components: PyranometerUncertaintyComponent[] = [
        { name: 'Repeat', value_percent: repeatU, u_percent: u_repeat, distribution: 'Normal', divisor: Math.sqrt(repeatN), deg_freedom: repeatDegFreedom },
        { name: 'Sertifikat Std', value_percent: certStdPercent, u_percent: u_cert, distribution: 'Normal', divisor: 2, deg_freedom: 50 },
        { name: 'Resolusi Std', value_percent: resStdPercent, u_percent: u_res_std, distribution: 'Rectangular', divisor: Math.sqrt(3), deg_freedom: 50 },
        { name: 'Drift Std', value_percent: driftPercent, u_percent: u_drift, distribution: 'Rectangular', divisor: Math.sqrt(3), deg_freedom: 50 },
        { name: 'Resolusi UUT', value_percent: resUutPercent, u_percent: u_res_uut, distribution: 'Rectangular', divisor: Math.sqrt(3), deg_freedom: 50 },
    ];
    
    // Combined uncertainty
    const sumSq = components.reduce((a, c) => a + Math.pow(c.u_percent, 2), 0);
    const uc = Math.sqrt(sumSq);
    
    // Effective degrees of freedom (Welch-Satterthwaite)
    const sumCiUiQuadVi = components.reduce((a, c) => {
        const vi = c.deg_freedom === Infinity ? 1e9 : c.deg_freedom;
        return a + Math.pow(c.u_percent, 4) / vi;
    }, 0);
    const veff = sumCiUiQuadVi > 0 ? Math.pow(uc, 4) / sumCiUiQuadVi : Infinity;
    
    // Coverage factor (dihitung dari veff, bukan hardcoded)
    const k = getCoverageFactorFor95(Math.floor(veff));
    const u95 = k * uc;
    
    return {
        cf_result,
        components,
        uc_percent: uc,
        u95_percent: u95,
        k_factor: k,
        certificate: {
            calibration_factor: cf_result.cf_final,
            correction_percent: (1 - cf_result.cf_final) * 100,
            uncertainty_percent: u95
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// WRAPPER FUNCTION UNTUK SERTIFIKAT PYRANOMETER
// ═══════════════════════════════════════════════════════════════

/**
 * Hitung hasil kalibrasi pyranometer untuk sertifikat
 * 
 * SAFEGUARD:
 * - Fungsi TERPISAH, tidak mempengaruhi calculateCalibrationResult()
 * - Return null jika input tidak valid (caller bisa fallback ke metode lama)
 */
export function calculatePyranometerCertificate(params: {
    stdReadings: number[];
    uutReadings: number[];
    certU95_percent: number;
    resolutionStd: number;
    resolutionUut: number;
    range: number;
    sensorType: string;
    stdSensorType?: string;
    outlierThreshold?: number;
}): PyranometerUncertaintyResult | null {
    const { stdReadings, uutReadings, outlierThreshold, ...rest } = params;
    
    // SAFEGUARD: Validasi input
    if (!stdReadings?.length || !uutReadings?.length) {
        return null;
    }
    
    if (stdReadings.length !== uutReadings.length) {
        return null;
    }
    
    // Hitung CF
    const cf_result = calculateCalibrationFactor(stdReadings, uutReadings, {
        outlierThreshold,
        minReadings: PYRANOMETER_CONFIG.MIN_READINGS
    });
    
    if (cf_result.n_filtered === 0) {
        return null;
    }
    
    // Hitung rata-rata pembacaan untuk pembagi resolusi
    const validStd = stdReadings.filter(v => v > 0);
    const validUut = uutReadings.filter(v => v > 0);
    const stdMean = validStd.length > 0 ? validStd.reduce((a, b) => a + b, 0) / validStd.length : 0;
    const uutMean = validUut.length > 0 ? validUut.reduce((a, b) => a + b, 0) / validUut.length : 0;
    
    // Hitung uncertainty
    return calculatePyranometerUncertainty({
        cf_result,
        stdMean,
        uutMean,
        ...rest
    });
}
