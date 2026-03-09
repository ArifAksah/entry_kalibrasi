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

// Normalise unit string for comparison (lowercase, strip spaces)
export const normaliseUnit = (u: string): string => u.trim().toLowerCase().replace(/\s/g, '');

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
