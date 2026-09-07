import { calculateCalibrationResult, calculateStandardDeviation } from '../../lib/uncertainty-utils';

describe('final QC corrections as uncertainty repeatability input', () => {
    const currentData = [
        { standard_data: 10, uut_data: 9.8, unit_std: '°C', unit_uut: '°C' },
        { standard_data: 10, uut_data: 10.1, unit_std: '°C', unit_uut: '°C' },
        { standard_data: 10, uut_data: 10.3, unit_std: '°C', unit_uut: '°C' },
    ];

    it('uses supplied final QC corrections for every non-pyranometer parameter', () => {
        const finalCorrections = [0.25, -0.05, -0.35];
        const result = calculateCalibrationResult({
            currentData,
            uutSensor: { name: 'Termometer', resolution: 0 },
            standardCertRecord: null,
            finalCorrections,
        });

        expect(result.correction).toBeCloseTo(-0.05, 12);
        // With all other uncertainty components zero, U95 is driven by this exact QC SD.
        expect(calculateStandardDeviation(finalCorrections)).toBeCloseTo(0.3, 12);
        expect(result.uncertainty).toBeGreaterThan(0);
    });

    it('calculates correction residuals instead of raw UUT repeatability when cert points are absent', () => {
        const result = calculateCalibrationResult({
            currentData,
            uutSensor: { name: 'Termometer', resolution: 0 },
            standardCertRecord: null,
        });

        expect(result.correction).toBeCloseTo(-0.06666666666666643, 12);
        expect(result.uncertainty).toBeGreaterThan(0);
    });
});
