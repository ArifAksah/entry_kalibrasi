/**
 * Formatting helpers for calibration result table cells.
 *
 * Calculation results are stored at full precision so later edits/recalibration
 * never lose data. These helpers only shape how a cell is presented.
 */

export function isNumericString(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim();
    if (normalized === '') return false;
    const parsed = Number(normalized.replace(',', '.'));
    return Number.isFinite(parsed);
}

export function roundDisplay(value: unknown, digits: number): string {
    if (!isNumericString(value)) return String(value ?? '-');
    const parsed = Number(String(value).replace(',', '.'));
    return parsed.toFixed(digits);
}

function expandScientificNotation(value: string): string {
    if (!/[eE]/.test(value)) return value;

    const [mantissa, exponentText] = value.toLowerCase().split('e');
    const exponent = Number(exponentText);
    const negative = mantissa.startsWith('-');
    const unsignedMantissa = negative ? mantissa.slice(1) : mantissa;
    const decimalIndex = unsignedMantissa.indexOf('.') === -1
        ? unsignedMantissa.length
        : unsignedMantissa.indexOf('.');
    const digits = unsignedMantissa.replace('.', '');
    const targetIndex = decimalIndex + exponent;
    const sign = negative ? '-' : '';

    if (targetIndex <= 0) {
        return `${sign}0.${'0'.repeat(-targetIndex)}${digits}`;
    }
    if (targetIndex >= digits.length) {
        return `${sign}${digits}${'0'.repeat(targetIndex - digits.length)}`;
    }
    return `${sign}${digits.slice(0, targetIndex)}.${digits.slice(targetIndex)}`;
}

/**
 * Formats a result cell to a fixed count of significant figures without
 * changing the stored value. Scientific notation is expanded for certificates.
 */
export function formatCalibrationResultValue(
    value: unknown,
    significantFigures = 2,
): string {
    if (value === null || value === undefined || String(value).trim() === '') return '-';
    if (!isNumericString(value)) return String(value ?? '-');

    const parsed = Number(String(value).trim().replace(',', '.'));
    const figures = Math.max(1, Math.trunc(significantFigures));
    if (Object.is(parsed, -0) || parsed === 0) {
        return figures === 1 ? '0' : `0.${'0'.repeat(figures - 1)}`;
    }

    return expandScientificNotation(parsed.toPrecision(figures));
}

export function formatCalibrationReading(value: unknown, isPyranometer = false, digits = 2): string {
    return roundDisplay(value, isPyranometer ? digits : digits);
}

export function formatCalibrationCorrection(value: unknown, isPyranometer = false, digits = 4): string {
    return roundDisplay(value, isPyranometer ? Math.max(digits, 2) : digits);
}

export function formatCalibrationUncertainty(value: unknown, isPyranometer = false, digits = 4): string {
    return roundDisplay(value, isPyranometer ? Math.max(digits, 2) : digits);
}
