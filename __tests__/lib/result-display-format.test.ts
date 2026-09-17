import {
    formatCalibrationResultValue,
    formatCalibrationUncertainty,
    roundDisplay,
    isNumericString,
} from '../../lib/result-display-format';

describe('result display formatting', () => {
    it('detects numeric strings including comma decimals', () => {
        expect(isNumericString('0,0085')).toBe(true);
        expect(isNumericString('0.0085')).toBe(true);
        expect(isNumericString('-')).toBe(false);
        expect(isNumericString('')).toBe(false);
        expect(isNumericString('   ')).toBe(false);
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

    it.each([
        [27.78, '28'],
        [0.00166, '0.0017'],
        [2, '2.0'],
        [0.5, '0.50'],
        [12.34, '12'],
        [123.4, '120'],
        [-27.78, '-28'],
        [1000, '1000'],
        [0.0000123, '0.000012'],
        ['0,00166', '0.0017'],
        [0, '0.0'],
        [-0, '0.0'],
    ])('formats %p to two significant figures as %s', (value, expected) => {
        expect(formatCalibrationResultValue(value)).toBe(expected);
    });

    it('keeps non-numeric result cells unchanged', () => {
        expect(formatCalibrationResultValue('-')).toBe('-');
        expect(formatCalibrationResultValue('Tidak berlaku')).toBe('Tidak berlaku');
        expect(formatCalibrationResultValue(null)).toBe('-');
        expect(formatCalibrationResultValue('   ')).toBe('-');
    });

    it('never uses scientific notation for certificate result cells', () => {
        expect(formatCalibrationResultValue(1.23e21)).toBe('1200000000000000000000');
        expect(formatCalibrationResultValue(1.23e-12)).toBe('0.0000000000012');
    });
});
