import { tryConvertResultsLegacyToV1 } from '../../lib/validators/certificate-results-legacy';
import { resultsToLegacyView } from '../../lib/validators/certificate-results-render-adapter';

/**
 * Kondisi ruang diketik sebagai Awal & Akhir. Pastikan nilainya tidak hilang
 * saat normalisasi simpan (V0 → V1) maupun saat dibaca renderer (V1 → V0).
 */
describe('kondisi ruang — Awal/Akhir bertahan setelah normalisasi & render', () => {
    const legacy = [
        {
            sensorId: 1,
            environment: [
                {
                    key: 'Suhu Udara',
                    value: '(24.55 ± 0.1) °C',
                    awal: '24.6',
                    akhir: '24.5',
                    unit: '°C',
                    type: 'suhu',
                    u95: '',
                    enabled: true,
                },
                {
                    key: 'Tekanan Ruang',
                    value: '(1006.75 ± 0.3) hPa',
                    awal: '1006.5',
                    akhir: '1007',
                    unit: 'hPa',
                    type: 'tekanan',
                    u95: '',
                    enabled: true,
                },
            ],
        },
    ];

    it('converter legacy menyimpan awal/akhir/unit/type/enabled', () => {
        const outcome = tryConvertResultsLegacyToV1(legacy, { calibration_kind: 'FC' });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.data.sensors[0].setup.environment).toEqual([
            {
                key: 'Suhu Udara',
                value: '(24.55 ± 0.1) °C',
                awal: '24.6',
                akhir: '24.5',
                unit: '°C',
                type: 'suhu',
                u95: '',
                enabled: true,
            },
            {
                key: 'Tekanan Ruang',
                value: '(1006.75 ± 0.3) hPa',
                awal: '1006.5',
                akhir: '1007',
                unit: 'hPa',
                type: 'tekanan',
                u95: '',
                enabled: true,
            },
        ]);
    });

    it('render adapter tetap membawa awal/akhir ke halaman cetak', () => {
        const outcome = tryConvertResultsLegacyToV1(legacy, { calibration_kind: 'FC' });
        if (!outcome.ok) throw new Error('konversi gagal');

        const view = resultsToLegacyView(outcome.data);
        expect(view[0].environment[0]).toMatchObject({
            key: 'Suhu Udara',
            awal: '24.6',
            akhir: '24.5',
            type: 'suhu',
            u95: '',
        });
        expect(view[0].environment[1]).toMatchObject({
            key: 'Tekanan Ruang',
            awal: '1006.5',
            akhir: '1007',
            type: 'tekanan',
            u95: '',
        });
    });
});
