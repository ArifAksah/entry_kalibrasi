export interface WindDirectionSensorData {
    name?: string | null;
    type?: string | null;
    sheet_name?: string | null;
}

/** Detect wind-direction calibration without treating every degree-based sensor as directional. */
export function isWindDirectionSensor(
    sensor?: WindDirectionSensorData | null,
    canonicalName?: string | null,
    calibrationMethod?: string | null
): boolean {
    const identity = [canonicalName, sensor?.name, sensor?.type, sensor?.sheet_name, calibrationMethod]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return identity.includes('arah angin')
        || identity.includes('wind direction')
        || identity.includes('wind vane')
        || /\bmk\s*0?5\b/.test(identity);
}

/** Match the workbook formula MOD(delta + 180, 360) - 180. */
export function wrapWindDirectionCorrection(deltaRaw: number): number {
    if (!Number.isFinite(deltaRaw)) return deltaRaw;
    const correction = ((deltaRaw + 180) % 360 + 360) % 360 - 180;
    return Object.is(correction, -0) ? 0 : correction;
}

/** Mean heading in the [0, 360) interval. */
export function circularMeanDegrees(values: number[]): number {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0) return 0;

    const sumSin = finiteValues.reduce((sum, value) => sum + Math.sin(value * Math.PI / 180), 0);
    const sumCos = finiteValues.reduce((sum, value) => sum + Math.cos(value * Math.PI / 180), 0);
    if (Math.abs(sumSin) < Number.EPSILON && Math.abs(sumCos) < Number.EPSILON) return 0;

    const mean = Math.atan2(sumSin, sumCos) * 180 / Math.PI;
    const normalized = (mean + 360) % 360;
    return Math.abs(normalized - 360) < 1e-12 ? 0 : normalized;
}
