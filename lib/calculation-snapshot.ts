export interface CalculationSnapshot {
    id: number | string;
    std_correction: number;
    std_corrected: number;
    uut_correction: number;
}

export function dedupeCalculationSnapshots(snapshots: CalculationSnapshot[]): CalculationSnapshot[] {
    const unique = new Map<string, CalculationSnapshot>();
    snapshots.forEach(snapshot => {
        unique.set(String(snapshot.id), snapshot);
    });
    return Array.from(unique.values());
}

export function parseCalculationSnapshots(value: unknown): CalculationSnapshot[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;

    const parsed: CalculationSnapshot[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') return null;
        const snapshot = item as Record<string, unknown>;
        const id = snapshot.id;
        const validId = (typeof id === 'number' && Number.isSafeInteger(id))
            || (typeof id === 'string' && /^\d+$/.test(id));
        const stdCorrection = Number(snapshot.std_correction);
        const stdCorrected = Number(snapshot.std_corrected);
        const uutCorrection = Number(snapshot.uut_correction);

        if (!validId
            || !Number.isFinite(stdCorrection)
            || !Number.isFinite(stdCorrected)
            || !Number.isFinite(uutCorrection)) {
            return null;
        }

        parsed.push({
            id: id as number | string,
            std_correction: stdCorrection,
            std_corrected: stdCorrected,
            uut_correction: uutCorrection,
        });
    }

    return dedupeCalculationSnapshots(parsed);
}
