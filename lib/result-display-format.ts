/**
 * Formatting helpers for calibration result table cells.
 *
 * Calculation results are stored at full precision so later edits/recalibration
 * never lose data. These helpers only shape how a cell is presented.
 */

export function isNumericString(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return false;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed);
}

export function roundDisplay(value: unknown, digits: number): string {
    if (!isNumericString(value)) return String(value ?? '-');
    const parsed = Number(String(value).replace(',', '.'));
    return parsed.toFixed(digits);
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
