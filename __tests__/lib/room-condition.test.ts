import { calculateRoomCondition } from '../../lib/room-condition';

describe('room condition calculation', () => {
    it('matches the workbook temperature condition', () => {
        const result = calculateRoomCondition('suhu', [
            { sheet_name: 'Termometer', unit_std: '°C', std_corrected: 24.462126948259613 },
            { sheet_name: 'Termometer', unit_std: '°C', std_corrected: 27.5 },
            { sheet_name: 'Termometer', unit_std: '°C', std_corrected: 33.73581955116313 },
        ]);

        expect(result).toMatchObject({
            initial: 24.5,
            final: 33.7,
            mean: 29.1,
            halfRange: 4.6,
            initialDisplay: '24.5 °C',
            finalDisplay: '33.7 °C',
            display: '(29.1 ± 4.6) °C',
        });
    });

    it('matches the workbook relative-humidity condition', () => {
        const result = calculateRoomCondition('kelembaban', [
            { sheet_name: 'Hygrometer', unit_std: '%RH', std_corrected: 51.605660788000804 },
            { sheet_name: 'Hygrometer', unit_std: '%RH', std_corrected: 75 },
            { sheet_name: 'Hygrometer', unit_std: '%RH', std_corrected: 99.778435294 },
        ]);

        expect(result).toMatchObject({
            initial: 51.6,
            final: 99.8,
            mean: 75.7,
            halfRange: 24.1,
            initialDisplay: '51.6 %',
            finalDisplay: '99.8 %',
            display: '(75.7 ± 24.1) %',
        });
    });

    it('falls back to standard reading plus correction when no snapshot exists', () => {
        const result = calculateRoomCondition('suhu', [
            { sheet_name: 'Suhu', unit_std: '°C', standard_data: 20, std_correction: 0.1 },
            { sheet_name: 'Suhu', unit_std: '°C', standard_data: 21, std_correction: 0.1 },
        ]);
        expect(result?.display).toBe('(20.6 ± 0.5) °C');
    });

    it('keeps a two-decimal midpoint like the workbook', () => {
        const result = calculateRoomCondition('suhu', [
            { sheet_name: 'Suhu', unit_std: '°C', std_corrected: 24.5 },
            { sheet_name: 'Suhu', unit_std: '°C', std_corrected: 24.6 },
        ]);
        expect(result?.display).toBe('(24.55 ± 0.1) °C');
    });

    it('does not mix unrelated parameter rows', () => {
        const result = calculateRoomCondition('suhu', [
            { sheet_name: 'Barometer', unit_std: 'hPa', std_corrected: 1000 },
            { sheet_name: 'Wind Speed', unit_std: 'm/s', std_corrected: 5 },
        ]);
        expect(result).toBeNull();
    });

    it('derives different conditions from a different raw dataset', () => {
        const temperature = calculateRoomCondition('suhu', [
            { sheet_name: 'Sensor Suhu', unit_std: '°C', std_corrected: 18.24 },
            { sheet_name: 'Sensor Suhu', unit_std: '°C', std_corrected: 19.91 },
            { sheet_name: 'Sensor Suhu', unit_std: '°C', std_corrected: 21.76 },
        ]);
        const humidity = calculateRoomCondition('kelembaban', [
            { sheet_name: 'Sensor Kelembapan', unit_std: '%RH', std_corrected: 40.14 },
            { sheet_name: 'Sensor Kelembapan', unit_std: '%RH', std_corrected: 56.68 },
        ]);

        expect(temperature).toMatchObject({
            initial: 18.2,
            final: 21.8,
            initialDisplay: '18.2 °C',
            finalDisplay: '21.8 °C',
        });
        expect(humidity).toMatchObject({
            initial: 40.1,
            final: 56.7,
            initialDisplay: '40.1 %',
            finalDisplay: '56.7 %',
        });
    });
});
