import {
    clearHitungKoreksiCache,
    buildCorrectionMapFromCertificates,
    hitungKoreksiBatch,
    hitungKoreksiDB,
} from '../../lib/qc-utils';

describe('standard correction error handling', () => {
    beforeEach(() => {
        clearHitungKoreksiCache();
        global.fetch = jest.fn();
    });

    it('retries an HTTP failure and caches only the successful correction', async () => {
        const fetchMock = global.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ correction: -0.126 }) });

        await expect(hitungKoreksiDB(1007.942, 7)).resolves.toBe(-0.126);
        await expect(hitungKoreksiDB(1007.942, 7)).resolves.toBe(-0.126);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries missing batch results individually instead of converting them to zero', async () => {
        const fetchMock = global.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ corrections: {}, errors: { '7:1007.942': 'temporary error' } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ correction: -0.126 }),
            });

        const result = await hitungKoreksiBatch([{ reading: 1007.942, sensorStdId: 7 }]);
        expect(result.get('7:1007.942')).toBe(-0.126);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('calculates every reading locally from one latest certificate snapshot', () => {
        const result = buildCorrectionMapFromCertificates([
            { reading: 1008.005, sensorStdId: 7 },
            { reading: 1008.02, sensorStdId: 7 },
            { reading: 1008.141, sensorStdId: 7 },
        ], [{
            sensor_id: 7,
            calibration_date: '2026-01-01',
            setpoint: [1000, 1010],
            correction_std: [-0.1, -0.2],
        }]);

        expect(result).toHaveProperty('size', 3);
        expect(result.get('latest:7:1008.005')).toBeCloseTo(-0.18005, 12);
        expect(result.get('latest:7:1008.02')).toBeCloseTo(-0.1802, 12);
        expect(result.get('latest:7:1008.141')).toBeCloseTo(-0.18141, 12);
    });

    it('uses the explicitly selected certificate instead of the latest sensor certificate', () => {
        const result = buildCorrectionMapFromCertificates([
            { reading: 5, sensorStdId: 7, standardCertificateId: 101 },
        ], [
            { id: 101, sensor_id: 7, calibration_date: '2025-01-01', setpoint: [0, 10], correction_std: [1, 1] },
            { id: 102, sensor_id: 7, calibration_date: '2026-01-01', setpoint: [0, 10], correction_std: [2, 2] },
        ]);
        expect(result.get('101:7:5')).toBe(1);
    });
});
