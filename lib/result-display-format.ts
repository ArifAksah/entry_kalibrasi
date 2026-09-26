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

export type CalibrationParameter =
    | 'pressure'
    | 'temperature'
    | 'humidity'
    | 'wind_speed'
    | 'wind_direction'
    | 'pyranometer'
    | 'generic';

export function classifyCalibrationParameter(input: {
    name?: string | null;
    type?: string | null;
    sheetName?: string | null;
    calibrationMethod?: string | null;
    isPyranometer?: boolean;
}): CalibrationParameter {
    if (input.isPyranometer) return 'pyranometer';
    const identity = [input.name, input.type, input.sheetName, input.calibrationMethod]
        .filter(Boolean).join(' ').toLowerCase();

    if (/arah angin|wind direction|wind vane|\bmk\s*0?5\b/.test(identity)) return 'wind_direction';
    if (/kecepatan angin|wind speed|anemometer|\bmk\s*0?4\b/.test(identity)) return 'wind_speed';
    if (/tekanan|pressure|barometer|\bmk\s*0?2\b/.test(identity)) return 'pressure';
    if (/suhu|temperature|termometer|thermometer|\btemp\b|\bmk\s*0?1\b/.test(identity)) return 'temperature';
    if (/kelembapan|kelembaban|humidity|hygro|\brh\b|\bmk\s*0?3\b/.test(identity)) return 'humidity';
    if (/pyranometer|piranometer|solar radiation|radiasi matahari/.test(identity)) return 'pyranometer';
    return 'generic';
}

const readingDecimals: Partial<Record<CalibrationParameter, number>> = {
    pressure: 2,
    temperature: 2,
    humidity: 1,
    wind_speed: 0,
    wind_direction: 0,
    pyranometer: 2,
};

function fixedDisplay(value: unknown, digits: number): string {
    if (!isNumericString(value)) return String(value ?? '-');
    const result = Number(String(value).trim().replace(',', '.')).toFixed(digits);
    return /^-0(?:\.0+)?$/.test(result)
        ? (digits > 0 ? `0.${'0'.repeat(digits)}` : '0')
        : result;
}

/** Format satu row hasil sesuai number format workbook AWOS. */
export function formatCalibrationResultRow(
    reading: unknown,
    correction: unknown,
    uncertainty: unknown,
    parameter: CalibrationParameter = 'generic',
): { reading: string; correction: string; uncertainty: string } {
    const uncertaintyDisplay = formatCalibrationResultValue(uncertainty, 2);
    if (!isNumericString(uncertainty)) {
        return {
            reading: formatCalibrationResultValue(reading, 2),
            correction: formatCalibrationResultValue(correction, 2),
            uncertainty: uncertaintyDisplay,
        };
    }

    const point = uncertaintyDisplay.indexOf('.');
    const uncertaintyDecimals = point === -1 ? 0 : uncertaintyDisplay.length - point - 1;
    const workbookReadingDecimals = readingDecimals[parameter];
    return {
        reading: workbookReadingDecimals === undefined
            ? formatCalibrationResultValue(reading, 2)
            : fixedDisplay(reading, workbookReadingDecimals),
        correction: fixedDisplay(correction, uncertaintyDecimals),
        uncertainty: uncertaintyDisplay,
    };
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
