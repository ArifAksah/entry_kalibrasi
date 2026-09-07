import {
    circularMeanDegrees,
    isWindDirectionSensor,
    wrapWindDirectionCorrection,
} from '../../lib/wind-direction';
import { checkWMOLimit } from '../../lib/wmo-limits';

describe('wind direction calculations', () => {
    test.each([
        [-299.8873051, 60.1126949],
        [-358, 2],
        [358, -2],
        [181, -179],
        [-181, 179],
        [180, -180],
        [-180, -180],
        [721, 1],
    ])('wraps %p degrees to %p degrees', (deltaRaw, expected) => {
        expect(wrapWindDirectionCorrection(deltaRaw)).toBeCloseTo(expected, 10);
    });

    it('uses a circular mean across north', () => {
        expect(circularMeanDegrees([359, 1])).toBeCloseTo(0, 10);
    });

    it('detects canonical names and MK 05 without classifying arbitrary degree sensors', () => {
        expect(isWindDirectionSensor({ name: 'Arah Angin' })).toBe(true);
        expect(isWindDirectionSensor({ type: 'Wind Vane' })).toBe(true);
        expect(isWindDirectionSensor({ name: 'Anemometer' }, null, 'MK 05 - Anemometer')).toBe(true);
        expect(isWindDirectionSensor({ name: 'Sensor Suhu', type: 'Temperature' })).toBe(false);
    });

    it('uses the wrapped correction for the wind-direction WMO check', () => {
        const result = checkWMOLimit('Wind Direction', 359, 1);
        expect(result.correction).toBe(2);
        expect(result.passed).toBe(true);
    });
});
