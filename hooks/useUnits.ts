import { useState, useCallback } from 'react';

export interface Unit {
    id: number;
    unit: string;
}

export function useUnits() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUnits = useCallback(async (q?: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (q) params.append('q', q);

            const res = await fetch(`/api/units?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch units');

            const data = await res.json();
            setUnits(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        units,
        loading,
        error,
        fetchUnits
    };
}
