import { convertUnit } from './unitConversion';
import { wrapWindDirectionCorrection } from './wind-direction';

export interface CalculationAuditInput {
    standardReading: number;
    uutReading: number;
    standardCorrection: number;
    storedStandardCorrection?: number | null;
    unitStd?: string | null;
    unitUut?: string | null;
    isWindDirection?: boolean;
}

export interface CalculationAuditRow {
    standardCorrected: number;
    systemConvertedStandard: number;
    legacyConvertedStandard: number;
    systemCorrection: number;
    legacyCorrection: number;
    correctionDifference: number;
    storedCorrectionDifference: number | null;
}

export interface CalculationAuditStats {
    count: number;
    mean: number;
    standardDeviation: number;
}

export function convertUnitExcelLegacy(value: number, fromUnit?: string | null, toUnit?: string | null): number {
    // The official system conversion table now follows the workbook constants.
    return convertUnit(value, fromUnit || '', toUnit || '');
}

function wrapExcelLegacy(delta: number): number {
    return ((delta + 180) % 360 + 360) % 360 - 180;
}

export function calculateAuditRow(input: CalculationAuditInput): CalculationAuditRow {
    const standardCorrected = input.standardReading + input.standardCorrection;
    const systemConvertedStandard = convertUnit(standardCorrected, input.unitStd || '', input.unitUut || '');
    const legacyConvertedStandard = convertUnitExcelLegacy(standardCorrected, input.unitStd, input.unitUut);
    const systemDelta = systemConvertedStandard - input.uutReading;
    const legacyDelta = legacyConvertedStandard - input.uutReading;
    const systemCorrection = input.isWindDirection
        ? wrapWindDirectionCorrection(systemDelta)
        : systemDelta;
    const legacyCorrection = input.isWindDirection
        ? wrapExcelLegacy(legacyDelta)
        : legacyDelta;

    return {
        standardCorrected,
        systemConvertedStandard,
        legacyConvertedStandard,
        systemCorrection,
        legacyCorrection,
        correctionDifference: systemCorrection - legacyCorrection,
        storedCorrectionDifference: input.storedStandardCorrection == null
            ? null
            : input.standardCorrection - input.storedStandardCorrection,
    };
}

export function calculateAuditStats(values: number[]): CalculationAuditStats {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0) return { count: 0, mean: 0, standardDeviation: 0 };

    const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
    const variance = finiteValues.length > 1
        ? finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finiteValues.length - 1)
        : 0;
    return { count: finiteValues.length, mean, standardDeviation: Math.sqrt(variance) };
}
