import {
    classifyCalibrationParameter,
    formatCalibrationResultRow,
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

    it.each([
        ['pressure', 29.710556730091515, 0.0014780317238612696, 0.00847694807437403, ['29.71', '0.0015', '0.0085']],
        ['temperature', 27.53608879492602, 0.007977426823819082, 0.3, ['27.54', '0.01', '0.30']],
        ['humidity', 87.06892177589862, -2.8670159770252774, 1.6476984652908766, ['87.1', '-2.9', '1.6']],
        ['wind_speed', 4.093844601412714, -0.21327886531401463, 1.1718865424949996, ['4', '-0.2', '1.2']],
        ['wind_direction', 190.37840565085773, -1.154219199443145, 3.5240001077491194, ['190', '-1.2', '3.5']],
    ] as const)(
        'matches workbook AWOS formatting for %s',
        (parameter, reading, correction, uncertainty, expected) => {
            const result = formatCalibrationResultRow(reading, correction, uncertainty, parameter);
            expect([result.reading, result.correction, result.uncertainty]).toEqual(expected);
        },
    );

    it('classifies AWOS sensor identities in workbook priority order', () => {
        expect(classifyCalibrationParameter({ name: 'Barometer' })).toBe('pressure');
        expect(classifyCalibrationParameter({ name: 'Termometer HygroClip2' })).toBe('temperature');
        expect(classifyCalibrationParameter({ name: 'Hygrometer RH' })).toBe('humidity');
        expect(classifyCalibrationParameter({ name: 'Anemometer Wind Speed' })).toBe('wind_speed');
        expect(classifyCalibrationParameter({ name: 'Anemometer Wind Direction' })).toBe('wind_direction');
    });

    it('falls back safely when uncertainty is not numeric', () => {
        expect(formatCalibrationResultRow(27.78, 0.00166, '-', 'temperature')).toEqual({
            reading: '28',
            correction: '0.0017',
            uncertainty: '-',
        });
    });
});
