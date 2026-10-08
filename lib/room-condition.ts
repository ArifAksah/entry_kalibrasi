import { formatUnit, normaliseUnit } from './unitConversion';

/**
 * Kondisi ruang / lingkungan.
 *
 * Sumber nilai, berurutan sesuai prioritas di `resolveRoomCondition`:
 *   1. `endpoint` — operator mengisi Awal & Akhir (cara workbook)
 *   2. `value`    — teks bebas yang diketik operator
 *
 * Data mentah kalibrasi sengaja TIDAK dipakai lagi sebagai sumber: di situ
 * yang tersimpan adalah titik ukur sensor, bukan kondisi ruangan.
 */
export type RoomConditionType = 'suhu' | 'kelembaban' | 'tekanan' | 'suhu_air';

export interface RoomConditionDefinition {
    type: RoomConditionType;
    /** Key yang dipakai di array `environment` (stabil, jangan diubah). */
    key: string;
    labelId: string;
    labelEn: string;
    unit: string;
}

/**
 * Empat parameter kondisi ruang, mengikuti blok "Kondisi Ruang" workbook.
 * `key` dua parameter dasar sengaja memakai ejaan lama (`Suhu`, `Kelembaban`)
 * agar data yang sudah tersimpan tidak berubah. Tekanan Ruang & Suhu Media
 * sudah tersedia tetapi belum ditampilkan di form (menunggu keputusan petugas).
 */
export const ROOM_CONDITION_DEFINITIONS: readonly RoomConditionDefinition[] = [
    { type: 'suhu', key: 'Suhu', labelId: 'Suhu Ruang', labelEn: 'Temperature', unit: '°C' },
    { type: 'kelembaban', key: 'Kelembaban', labelId: 'Kelembapan', labelEn: 'Relative Humidity', unit: '%' },
    { type: 'tekanan', key: 'Tekanan Ruang', labelId: 'Tekanan Ruang', labelEn: 'Pressure', unit: 'hPa' },
    { type: 'suhu_air', key: 'Suhu Air', labelId: 'Suhu Air', labelEn: 'Water Temperature', unit: '°C' },
];

/** Cari definisi berdasarkan `type` eksplisit atau kata kunci pada key/label. */
export function roomConditionDefinition(input: string): RoomConditionDefinition | null {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return null;

    const byType = ROOM_CONDITION_DEFINITIONS.find((d) => d.type === value);
    if (byType) return byType;

    const byKey = ROOM_CONDITION_DEFINITIONS.find(
        (d) => d.key.toLowerCase() === value || d.labelId.toLowerCase() === value,
    );
    if (byKey) return byKey;

    if (/tekanan|pressure|baro/.test(value)) {
        return ROOM_CONDITION_DEFINITIONS.find((d) => d.type === 'tekanan') ?? null;
    }
    if (/suhu air|water temp|air/.test(value)) {
        return ROOM_CONDITION_DEFINITIONS.find((d) => d.type === 'suhu_air') ?? null;
    }
    if (/kelembab|lembab|humidity|hygro|(^|\W)rh(\W|$)|%/.test(value)) {
        return ROOM_CONDITION_DEFINITIONS.find((d) => d.type === 'kelembaban') ?? null;
    }
    if (/suhu|temp|termometer|thermo/.test(value)) {
        return ROOM_CONDITION_DEFINITIONS.find((d) => d.type === 'suhu') ?? null;
    }
    return null;
}

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

    if (type === 'tekanan') {
        const unitMatches = ['hpa', 'mbar', 'bar', 'pa', 'kpa'].includes(unit);
        return unitMatches || /tekanan|pressure|baro/.test(name);
    }

    if (type === 'suhu_air') {
        return /suhu air|water temp|air/.test(name);
    }

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

function parseInputNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildResult(
    initial: number,
    final: number,
    unit: string,
    count: number,
): RoomConditionResult {
    const mean = (initial + final) / 2;
    const halfRange = roundOne(Math.abs(initial - final) / 2);

    return {
        initial,
        final,
        mean,
        halfRange,
        unit,
        initialDisplay: `${initial.toFixed(1)} ${formatUnit(unit)}`,
        finalDisplay: `${final.toFixed(1)} ${formatUnit(unit)}`,
        display: `(${Number(mean.toPrecision(12))} ± ${halfRange}) ${formatUnit(unit)}`,
        count,
    };
}

/**
 * Hitung kondisi ruang dari **Awal & Akhir** yang diisi operator.
 * Sama dengan rumus workbook: `(mean ± halfRange)`; Awal = pembacaan mulai,
 * Akhir = pembacaan selesai.
 */
export function calculateRoomConditionFromEndpoints(
    awal: unknown,
    akhir: unknown,
    unit: string,
): RoomConditionResult | null {
    const start = parseInputNumber(awal);
    const end = parseInputNumber(akhir);
    if (start == null || end == null) return null;
    return buildResult(start, end, unit, 2);
}

/** Replicate workbook B/C/E room-condition processing from corrected STD data. */
export function calculateRoomCondition(
    type: RoomConditionType,
    rawData: any[],
): RoomConditionResult | null {
    const values = rawData
        .filter(row => isMatchingRow(type, row))
        .map(correctedStandardValue)
        .filter((value): value is number => value != null && Number.isFinite(value));

    if (values.length === 0) return null;

    // Workbook B10/C10 and B11/C11 are one-decimal rounded extrema.
    const initial = roundOne(Math.min(...values));
    const final = roundOne(Math.max(...values));
    const definition = ROOM_CONDITION_DEFINITIONS.find(d => d.type === type);
    return buildResult(initial, final, definition?.unit ?? (type === 'kelembaban' ? '%' : '°C'), values.length);
}

export interface RoomConditionEntryLike {
    key?: string | null;
    value?: string | null;
    unit?: string | null;
    awal?: string | null;
    akhir?: string | null;
    /** U95 kondisi ruang (khusus sertifikat Tipping Bucket — input tersendiri). */
    u95?: string | null;
    type?: string | null;
}

export interface ResolvedRoomCondition {
    /** (rata-rata ± setengah rentang) — konvensi AWOS/AWS. */
    display: string;
    /** (Awal ± setengah rentang) — konvensi workbook Pyranometer. */
    initialHalfDisplay: string;
    /** (Awal ± U95) — konvensi workbook Tipping Bucket; null bila U95 kosong. */
    initialU95Display: string | null;
    initialDisplay: string;
    finalDisplay: string;
    unit: string;
    source: 'endpoint' | 'value';
}

/**
 * Tentukan nilai kondisi ruang yang ditampilkan untuk satu entri environment.
 * Prioritas: Awal/Akhir → data mentah (min/max) → teks bebas.
 * Mengembalikan `null` bila tidak ada sumber nilai sama sekali.
 */
export function resolveRoomCondition(entry: RoomConditionEntryLike): ResolvedRoomCondition | null {
    const definition = roomConditionDefinition(String(entry?.type || entry?.key || ''));
    const unit = String(entry?.unit || definition?.unit || '');

    // Kondisi ruang HARUS berasal dari pembacaan operator (Awal & Akhir).
    // Data mentah kalibrasi tidak boleh dipakai: itu rentang titik ukur sensor,
    // bukan kondisi ruangan (temuan petugas kalibrasi).
    const endpoints = calculateRoomConditionFromEndpoints(entry?.awal, entry?.akhir, unit);
    if (endpoints) {
        const u95 = parseInputNumber(entry?.u95);
        return {
            display: endpoints.display,
            initialHalfDisplay: `(${endpoints.initial} ± ${endpoints.halfRange}) ${formatUnit(endpoints.unit)}`,
            initialU95Display:
                u95 != null
                    ? `(${endpoints.initial} ± ${u95}) ${formatUnit(endpoints.unit)}`
                    : null,
            initialDisplay: endpoints.initialDisplay,
            finalDisplay: endpoints.finalDisplay,
            unit: endpoints.unit,
            source: 'endpoint',
        };
    }

    const value = String(entry?.value ?? '').trim();
    if (value) {
        return {
            display: value,
            initialHalfDisplay: value,
            initialU95Display: value,
            initialDisplay: value,
            finalDisplay: value,
            unit,
            source: 'value',
        };
    }

    return null;
}
