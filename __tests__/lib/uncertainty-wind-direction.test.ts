import { calculateCalibrationResult } from '../../lib/uncertainty-utils';
import { circularMeanDegrees } from '../../lib/wind-direction';

describe('calculateCalibrationResult for wind direction', () => {
    it('wraps each correction and uses the arithmetic UUT mean', () => {
        const result = calculateCalibrationResult({
            currentData: [
                { standard_data: 1, uut_data: 359, unit_std: '°', unit_uut: '°' },
                { standard_data: 359, uut_data: 1, unit_std: '°', unit_uut: '°' },
            ],
            uutSensor: { name: 'Arah Angin', resolution: 1 },
            standardCertRecord: null,
        });

        // Workbook memakai AVERAGE (aritmatika) untuk penunjukan heading UUT.
        expect(result.uutAvg).toBeCloseTo(180, 10);
        expect(result.correction).toBeCloseTo(0, 10);
        expect(result.uncertainty).toBeLessThan(30);
    });

    it('calculates a stable mean across the 0/360 boundary', () => {
        expect(circularMeanDegrees([358, 359, 0, 1, 2])).toBeCloseTo(0, 10);
        expect(circularMeanDegrees([89, 90, 91])).toBeCloseTo(90, 10);
    });

    it('turns the reported -299 degree delta into the shortest positive correction', () => {
        const result = calculateCalibrationResult({
            currentData: [{
                standard_data: 54.1126949,
                uut_data: 354,
                unit_std: '°',
                unit_uut: '°',
            }],
            uutSensor: { name: 'Wind Direction', resolution: 0.1 },
            standardCertRecord: null,
        });

        expect(result.correction).toBeCloseTo(60.1126949, 7);
    });
});
