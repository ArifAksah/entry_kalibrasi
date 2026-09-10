import { formatCalibrationUncertainty, roundDisplay, isNumericString } from '../../lib/result-display-format';

describe('result display formatting', () => {
    it('detects numeric strings including comma decimals', () => {
        expect(isNumericString('0,0085')).toBe(true);
        expect(isNumericString('0.0085')).toBe(true);
        expect(isNumericString('-')).toBe(false);
        expect(isNumericString('')).toBe(false);
    });

    it('rounds to the requested number of decimals', () => {
        expect(roundDisplay(0.0084769480, 4)).toBe('0.0085');
        expect(roundDisplay(0.0084769480, 6)).toBe('0.008477');
        expect(roundDisplay(0.0084769480, 10)).toBe('0.0084769480');
    });

    it('uses default four decimals for uncertainty', () => {
        expect(formatCalibrationUncertainty(0.0084769480)).toBe('0.0085');
        expect(formatCalibrationUncertainty(0.0084769480, false, 2)).toBe('0.01');
        expect(formatCalibrationUncertainty(0.0084769480, false, 6)).toBe('0.008477');
    });
});
