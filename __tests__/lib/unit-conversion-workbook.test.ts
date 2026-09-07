import { canConvertUnit, convertDeltaUnit, convertUnit } from '../../lib/unitConversion';

describe('official workbook conversion constants', () => {
    it('matches the Barometer workbook hPa to inHg result', () => {
        expect(convertUnit(1004.4540902893643, 'hPa', 'inHg'))
            .toBeCloseTo(29.661512282288616, 12);
    });

    it('matches the Wind Speed workbook m/s to knot result', () => {
        expect(convertUnit(2.84234, 'm/s', 'knot'))
            .toBeCloseTo(5.5250669546436155, 12);
    });

    it('uses the workbook knot to m/s factor', () => {
        expect(convertUnit(0.48, 'knot', 'm/s'))
            .toBeCloseTo(0.48 / 1.9438444924406, 12);
    });

    it('matches the workbook pressure and fpm constants', () => {
        expect(convertUnit(1000, 'hPa', 'bar')).toBe(1);
        expect(convertUnit(1, 'hPa', 'mmHg')).toBe(0.750062);
        expect(convertUnit(1, 'm/s', 'fpm')).toBeCloseTo(196.850393700787, 12);
    });

    it('converts uncertainty deltas without an absolute temperature offset', () => {
        expect(convertUnit(1, '°C', '°F')).toBeCloseTo(33.8, 12);
        expect(convertDeltaUnit(1, '°C', '°F')).toBeCloseTo(1.8, 12);
        expect(convertDeltaUnit(1.8, '°F', '°C')).toBeCloseTo(1, 12);
    });

    it('reports whether a conversion pair is supported', () => {
        expect(canConvertUnit('m/s', 'knot')).toBe(true);
        expect(canConvertUnit('unknown-a', 'unknown-b')).toBe(false);
    });
});
