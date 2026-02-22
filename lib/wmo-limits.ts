
export type SensorType = 'Temperature' | 'Humidity' | 'Pressure' | 'Wind Speed' | 'Wind Direction' | 'Rainfall';

export interface QCResult {
    correction: number;
    limit: number;
    passed: boolean;
    message?: string;
}

/**
 * Normalizes sensor names to a standard type
 */
export const normalizeSensorType = (name: string, type: string): SensorType | null => {
    const combined = `${name} ${type}`.toLowerCase();

    if (combined.includes('suhu') || combined.includes('temp')) return 'Temperature';
    if (combined.includes('kelembaban') || combined.includes('humidity') || combined.includes('rh')) return 'Humidity';
    if (combined.includes('tekanan') || combined.includes('pressure')) return 'Pressure';
    if (combined.includes('kecepatan') || combined.includes('wind speed')) return 'Wind Speed';
    if (combined.includes('arah') || combined.includes('wind direction')) return 'Wind Direction';
    if (combined.includes('hujan') || combined.includes('rain')) return 'Rainfall';

    return null;
};

/**
 * Calculates QC Pass/Fail based on WMO Limits
 * Correction = Standard - UUT
 * Pass if |Correction| <= Limit
 */
export const checkWMOLimit = (
    sensorType: SensorType,
    uutValue: number,
    standardValue: number
): QCResult => {
    // 1. Calculate Correction
    // Correction = Standard - UUT (User requirement)
    // Ensure we handle floating point precision issues roughly
    const correction = Number((standardValue - uutValue).toFixed(3));
    const absCorrection = Math.abs(correction);

    let limit = 0;

    switch (sensorType) {
        case 'Temperature':
            // Limit: 0.1 °C
            limit = 0.1;
            break;

        case 'Humidity':
            // Limit: 3% (RH > 50%), 5% (RH < 50%)
            if (standardValue > 50) {
                limit = 3;
            } else {
                limit = 5;
            }
            break;

        case 'Pressure':
            // Limit: 0.1 hPa
            limit = 0.1;
            break;

        case 'Wind Speed':
            // Limit: 0.5 m/s (v <= 5 m/s), 10% (v > 5 m/s)
            if (standardValue <= 5) {
                limit = 0.5;
            } else {
                limit = standardValue * 0.10; // 10%
            }
            break;

        case 'Wind Direction':
            // Limit: 5 degrees
            limit = 5;
            break;

        case 'Rainfall':
            // Limit: 5% (Intensitas tinggi - assuming general 5% for now as per simple request)
            limit = standardValue * 0.05;
            break;

        default:
            // Default to loose limit if unknown, or maybe 0?
            // For now let's set a high limit so it passes if unknown type
            return { correction, limit: 999999, passed: true, message: 'Unknown sensor type' };
    }

    // Check pass/fail
    // Pass if |Correction| <= Limit
    const passed = absCorrection <= limit + 0.000001; // Epsilon for float comparison

    return {
        correction,
        limit: Number(limit.toFixed(2)),
        passed
    };
};
