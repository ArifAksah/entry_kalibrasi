import { formatUnit, normaliseUnit } from './unitConversion';

export type RoomConditionType = 'suhu' | 'kelembaban';

export interface RoomConditionResult {
    initial: number;
    final: number;
    mean: number;
    halfRange: number;
    unit: string;
    initialDisplay: string;
    finalDisplay: string;
    display: string;
    count: number;
}

function isMatchingRow(type: RoomConditionType, row: any): boolean {
    const unit = normaliseUnit(String(row?.unit_std || row?.unit_uut || ''));
    const name = String(row?.sheet_name || row?.name || row?.category || '').toLowerCase();

    if (type === 'suhu') {
        const unitMatches = ['°c', 'c', 'degc', 'celcius', 'celsius'].includes(unit);
        return unitMatches || /suhu|temp|termometer|temperature|thermo/.test(name);
    }

    const unitMatches = unit.includes('%') || ['rh', '%rh', 'r.h'].includes(unit);
    return unitMatches || /kelembab|lembab|humidity|hygro|(^|\W)rh(\W|$)/.test(name);
}

function correctedStandardValue(row: any): number | null {
    const stored = Number(row?.std_corrected);
    if (row?.std_corrected != null && Number.isFinite(stored)) return stored;

    const standard = Number(row?.standard_data);
    if (!Number.isFinite(standard)) return null;
    const correction = Number(row?.std_correction ?? 0);
    return standard + (Number.isFinite(correction) ? correction : 0);
}

function roundOne(value: number): number {
    return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** Replicate workbook B/C/E room-condition processing from corrected STD data. */
export function calculateRoomCondition(
    type: RoomConditionType,
    rawData: any[]
): RoomConditionResult | null {
    const values = rawData
        .filter(row => isMatchingRow(type, row))
        .map(correctedStandardValue)
        .filter((value): value is number => value != null && Number.isFinite(value));

    if (values.length === 0) return null;

    // Workbook B10/C10 and B11/C11 are one-decimal rounded extrema.
    const initial = roundOne(Math.min(...values));
    const final = roundOne(Math.max(...values));
    const mean = (initial + final) / 2;
    const halfRange = roundOne(Math.abs(initial - final) / 2);
    const unit = type === 'suhu' ? '°C' : '%';

    return {
        initial,
        final,
        mean,
        halfRange,
        unit,
        initialDisplay: `${initial.toFixed(1)} ${formatUnit(unit)}`,
        finalDisplay: `${final.toFixed(1)} ${formatUnit(unit)}`,
        display: `(${mean} ± ${halfRange}) ${formatUnit(unit)}`,
        count: values.length,
    };
}
