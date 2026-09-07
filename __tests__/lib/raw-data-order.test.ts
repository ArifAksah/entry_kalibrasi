import { compareRawDataRows } from '../../lib/raw-data-order';

describe('raw data source ordering', () => {
    it('preserves the original spreadsheet row order', () => {
        const rows = [
            { id: 30, source_row_index: 3 },
            { id: 10, source_row_index: 1 },
            { id: 20, source_row_index: 2 },
        ];
        expect([...rows].sort(compareRawDataRows).map(row => row.source_row_index)).toEqual([1, 2, 3]);
    });

    it('uses database id for historical rows without a source index', () => {
        const rows = [{ id: 30 }, { id: 10 }, { id: 20 }];
        expect([...rows].sort(compareRawDataRows).map(row => row.id)).toEqual([10, 20, 30]);
    });
});
