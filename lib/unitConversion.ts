/**
 * Unit conversion utilities for meteorological sensors.
 *
 * Reference (from BMKG calibration table):
 *   Pressure: 1 inHg = 33.8639 hPa | 1 hPa = 0.02953 inHg | 1 mmHg = 1.33322 hPa
 *   Wind:     1 knot = 0.5144 m/s  | 1 m/s  = 1.9438 knots | 1 fpm = 0.00508 m/s
 *
 * Convention:
 *   Convert UUT value to the SAME unit as STD before computing correction.
 *   koreksi = std_terkoreksi - uut_converted
 */

/**
 * Strip LaTeX markup from a unit string, then lowercase + remove spaces.
 * This ensures LaTeX-stored units (e.g. "\\mathrm{hPa}", "^\\circ C") resolve
 * correctly against the plain-text CONVERSIONS table.
 */
export const normaliseUnit = (u: string): string => {
    const plain = formatUnit(u); // strip LaTeX first
    return plain.trim().toLowerCase().replace(/\s/g, '');
};

// Conversion matrix: [from][to] = factor  (y = x * factor + offset)
// For simple linear conversions offset = 0
type ConversionEntry = { factor: number; offset?: number };
const CONVERSIONS: Record<string, Record<string, ConversionEntry>> = {
    // Pressure
    inhg: { hpa: { factor: 33.8639 }, mbar: { factor: 33.8639 }, mmhg: { factor: 25.4 } },
    hpa: { inhg: { factor: 0.02953 }, mbar: { factor: 1 }, mmhg: { factor: 0.75006 } },
    mbar: { hpa: { factor: 1 }, inhg: { factor: 0.02953 }, mmhg: { factor: 0.75006 } },
    mmhg: { hpa: { factor: 1.33322 }, mbar: { factor: 1.33322 }, inhg: { factor: 0.03937 } },
    // Wind speed
    'm/s': { knot: { factor: 1.9438 }, 'kt': { factor: 1.9438 }, fpm: { factor: 196.85 } },
    'knot': { 'm/s': { factor: 0.5144 }, fpm: { factor: 101.27 } },
    'kt': { 'm/s': { factor: 0.5144 }, fpm: { factor: 101.27 } },
    'fpm': { 'm/s': { factor: 0.00508 }, knot: { factor: 0.00987 }, 'kt': { factor: 0.00987 } },
    // Temperature
    '°c': { '°f': { factor: 9 / 5, offset: 32 } },
    'c': { 'f': { factor: 9 / 5, offset: 32 } },
    '°f': { '°c': { factor: 5 / 9, offset: -160 / 9 } },
    'f': { 'c': { factor: 5 / 9, offset: -160 / 9 } },
    // Radiation (W/m² ↔ J/cm²/s)
    'w/m2': { 'j/cm2/s': { factor: 0.0001 } },
    'j/cm2/s': { 'w/m2': { factor: 10000 } },
};

/**
 * Convert a value from one unit to another.
 * Returns the original value unchanged if units are the same or conversion is unknown.
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
    const from = normaliseUnit(fromUnit);
    const to = normaliseUnit(toUnit);
    if (from === to) return value;
    const entry = CONVERSIONS[from]?.[to];
    if (!entry) return value; // unknown conversion → return as-is (log warning in dev)
    return value * entry.factor + (entry.offset ?? 0);
}

/**
 * Check if two unit strings require conversion.
 */
export function needsConversion(unitA: string, unitB: string): boolean {
    return normaliseUnit(unitA) !== normaliseUnit(unitB);
}

const SUPERSCRIPT_MAP: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
};

function toSuperscript(str: string): string {
    return str.split('').map(ch => SUPERSCRIPT_MAP[ch] ?? ch).join('');
}

/**
 * Format raw LaTeX units to plain text for display/comparison.
 * e.g., "^\circ C" -> "°C", "m/s^2" -> "m/s²", "\mu m" -> "µm",
 *       "\frac{kg}{m^2}" -> "kg/m²", "\cdot" -> "·", "\times" -> "×"
 */
export function formatUnit(unit: string): string {
    if (!unit) return '';
    let formatted = String(unit);

    // Replace degree symbols
    formatted = formatted.replace(/\\degree/g, '°');
    formatted = formatted.replace(/\^\{\\circ\}/g, '°');
    formatted = formatted.replace(/\^\\circ/g, '°');
    formatted = formatted.replace(/\\circ/g, '°');

    // Replace common operators and symbols
    formatted = formatted.replace(/\\cdot\b/g, '·');
    formatted = formatted.replace(/\\times\b/g, '×');
    formatted = formatted.replace(/\\pm\b/g, '±');
    formatted = formatted.replace(/\\div\b/g, '÷');
    formatted = formatted.replace(/\\leq\b/g, '≤');
    formatted = formatted.replace(/\\geq\b/g, '≥');
    formatted = formatted.replace(/\\approx\b/g, '≈');
    formatted = formatted.replace(/\\neq\b/g, '≠');

    // Replace Greek letters
    formatted = formatted.replace(/\\Alpha\b/g, 'Α');
    formatted = formatted.replace(/\\alpha\b/g, 'α');
    formatted = formatted.replace(/\\Beta\b/g, 'Β');
    formatted = formatted.replace(/\\beta\b/g, 'β');
    formatted = formatted.replace(/\\Gamma\b/g, 'Γ');
    formatted = formatted.replace(/\\gamma\b/g, 'γ');
    formatted = formatted.replace(/\\Delta\b/g, 'Δ');
    formatted = formatted.replace(/\\delta\b/g, 'δ');
    formatted = formatted.replace(/\\Lambda\b/g, 'Λ');
    formatted = formatted.replace(/\\lambda\b/g, 'λ');
    formatted = formatted.replace(/\\Sigma\b/g, 'Σ');
    formatted = formatted.replace(/\\sigma\b/g, 'σ');
    formatted = formatted.replace(/\\Omega\b/g, 'Ω');
    formatted = formatted.replace(/\\omega\b/g, 'ω');
    formatted = formatted.replace(/\\mu\b/g, 'µ');
    formatted = formatted.replace(/\\pi\b/g, 'π');
    formatted = formatted.replace(/\\theta\b/g, 'θ');
    formatted = formatted.replace(/\\Theta\b/g, 'Θ');

    // Replace \mathrm{...} and \text{...} (keep content)
    formatted = formatted.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    formatted = formatted.replace(/\\text\{([^}]*)\}/g, '$1');
    formatted = formatted.replace(/\\mathrm\b/g, '');
    formatted = formatted.replace(/\\text\b/g, '');

    // Replace \frac{num}{den} → num/den
    formatted = formatted.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2');

    // Replace \sqrt{x} → √(x) and bare \sqrt → √
    formatted = formatted.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
    formatted = formatted.replace(/\\sqrt\b/g, '√');

    // Replace \%/g before removing braces
    formatted = formatted.replace(/\\%/g, '%');

    // Replace superscripts with braces: ^{-3}, ^{3}, ^{123}
    formatted = formatted.replace(/\^\{([^}]*)\}/g, (_, exp) => toSuperscript(exp));

    // Replace single-char superscripts: ^2, ^3, ^-1, ^n
    formatted = formatted.replace(/\^(-?\w)/g, (_, exp) => toSuperscript(exp));

    // Remove remaining curly braces
    formatted = formatted.replace(/[{}]/g, '');

    // Clean up spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();

    // Clean up standalone ^ if any
    formatted = formatted.replace(/^\^/, '');

    return formatted;
}
