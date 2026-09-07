import {
    dedupeCalculationSnapshots,
    parseCalculationSnapshots,
} from '../../lib/calculation-snapshot';

describe('calculation snapshot normalization', () => {
    const first = {
        id: 10,
        std_correction: 0.1,
        std_corrected: 10.1,
        uut_correction: 0.2,
    };

    it('keeps only one update for each raw_data id', () => {
        const last = { ...first, uut_correction: 0.25 };
        expect(dedupeCalculationSnapshots([first, last])).toEqual([last]);
    });

    it('preserves bigint ids represented as strings', () => {
        const id = '9007199254740993123';
        expect(parseCalculationSnapshots([{ ...first, id }])?.[0].id).toBe(id);
    });

    it('deduplicates API payloads before upsert', () => {
        const parsed = parseCalculationSnapshots([first, { ...first }]);
        expect(parsed).toHaveLength(1);
    });

    it('rejects invalid snapshots', () => {
        expect(parseCalculationSnapshots([{ ...first, uut_correction: Number.NaN }])).toBeNull();
    });
});
