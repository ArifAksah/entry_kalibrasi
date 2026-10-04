import { calculateCalibrationFactor, calculateCalibrationResult, calculatePyranometerUncertainty, PYRANOMETER_METHOD_PROFILE, calculateStandardDeviation } from '../../lib/uncertainty-utils';

describe('pyranometer legacy CF policy', () => {
    it('returns a versioned audit profile with ISO references', () => {
        const cf = calculateCalibrationFactor([100, 101, 99], [100, 100, 100]);
        const result = calculatePyranometerUncertainty({
            cf_result: cf,
            certU95_percent: 2.1,
            resolutionStd: 0.01,
            resolutionUut: 0.1,
            range: 2000,
            sensorType: 'MS-802',
            stdSensorType: 'CMP3',
            stdMean: 100,
            uutMean: 100,
        });

        expect(result.method_profile).toEqual(PYRANOMETER_METHOD_PROFILE);
        expect(result.method_profile.standardReferences).toEqual(
            expect.arrayContaining([
                { code: 'ISO 9060', edition: '2018' },
                { code: 'ISO 9847', edition: '1992' },
            ]),
        );
        expect(result.audit.drift_class).toBe('C');
        expect(result.audit.drift_value_percent).toBe(3);
    });

    it('keeps valid statistical outliers in CF final and reports them separately', () => {
        const result = calculateCalibrationFactor(
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 1],
            { filterOutliers: false },
        );

        expect(result.cf_final).toBeCloseTo((9 * 1 + 10) / 10, 12);
        expect(result.n_filtered).toBe(10);
        expect(result.outlier_count).toBeGreaterThan(0);
        expect(result.filter_applied).toBe(false);
    });
});

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

    it('ignores partial rows instead of converting blanks to zero', () => {
        const result = calculateCalibrationResult({
            currentData: [
                ...currentData,
                { standard_data: null, uut_data: 99, unit_std: '°C', unit_uut: '°C' },
                { standard_data: 99, uut_data: null, unit_std: '°C', unit_uut: '°C' },
            ],
            uutSensor: { name: 'Termometer', resolution: 0 },
            standardCertRecord: null,
        });

        expect(result.uutAvg).toBeCloseTo((9.8 + 10.1 + 10.3) / 3, 12);
        expect(result.correction).toBeCloseTo(-0.06666666666666643, 12);
    });
});
