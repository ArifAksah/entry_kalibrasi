import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Instrument, Sensor } from '../../lib/supabase';
import {
    fetchQCLimitForSensor, checkQCResult, QCLimit,
    hitungKoreksiBatch, clearHitungKoreksiCache, buildCorrectionMapFromCertificates
} from '../../lib/qc-utils';
import { convertUnit, needsConversion } from '../../lib/unitConversion';
import { 
    calculateCalibrationResult,
    isPyranometer, calculateCalibrationFactor, calculatePyranometerUncertainty,
    PyranometerSensorData
} from '../../lib/uncertainty-utils';
import { SigFigBadge } from '../ui/SigFigBadge';
import qcCacheService from '../../lib/qc-cache-service';
import { deserializeMap } from '../../lib/qc-cache-storage';
import { isWindDirectionSensor, wrapWindDirectionCorrection } from '../../lib/wind-direction';
import { calculateAuditRow, calculateAuditStats } from '../../lib/calculation-audit';
import { CalculationSnapshot, dedupeCalculationSnapshots } from '../../lib/calculation-snapshot';
import { compareRawDataRows } from '../../lib/raw-data-order';


interface RawDataRow {
    id: number;
    created_at: string;
    timestamp: string | null;
    standard_data: number | null;
    uut_data: number | null;
    session_id: string;
    sensor_id_uut?: number;
    sensor_id_std?: number;
    standard_certificate_id?: number | null;
    source_row_index?: number | null;
    sheet_name?: string | null;
    unit_uut?: string | null;   // UUT data unit (reference)
    unit_std?: string | null;   // STD data unit (may need conversion to UUT unit)
    std_correction?: number | null;
}

interface QCDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    sessionId?: string;
    certificateId?: string;
    certificateInstrumentId?: number;
    instruments: Instrument[];
    sensors: any[];
    instrumentNames: Array<{ id: number; name: string }>;
    standardCerts?: any[];
    resultEntries?: Array<{
        sensorId: number | null;
        unitUut?: string | null;
        unitStd?: string | null;
        calibrationMethod?: string | null;
        standardCertificateId?: number | null;
    }>;
    onCalculateSaved?: (updates: Array<{ sensorId: number | string, table: any[] }>) => void | Promise<void>;
    /**
     * Status certificate pemilik data (mis. 'draft' | 'sent' | 'verified' | ...).
     * Button "Hitung dan Input Tabel ke Sertifikat" hanya tampil saat draft
     * karena setelah kirim konsep, data sudah frozen untuk proses verifikasi.
     * Jika undefined → default permissive (tombol tampil) untuk backward compat.
     */
    certificateStatus?: string | null;
}

const QCDataModal: React.FC<QCDataModalProps> = ({
    isOpen, onClose, title, sessionId, instruments, sensors, certificateInstrumentId, instrumentNames, standardCerts = [], resultEntries = [], onCalculateSaved, certificateStatus
}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<RawDataRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<number | 'unknown'>('unknown');
    const [isSavingToTable, setIsSavingToTable] = useState(false);
    const [hasSavedToTable, setHasSavedToTable] = useState(false);
    const [showCalculationAudit, setShowCalculationAudit] = useState(false);

    // Per UUT sensor: QC limits from master_qc
    const [qcLimits, setQcLimits] = useState<Record<string, QCLimit | null>>({});
    const [qcLimitsLoading, setQcLimitsLoading] = useState(false);

    // Cache integration state
    const [usedCache, setUsedCache] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    /** Resolve sensor display name: instrument_names → alias → type → fallback */
    const resolveSensorName = (s: any): string => {
        if (!s) return 'Unknown Sensor';
        // 1. Prioritas: lookup dari instrument_names via sensor_name_id
        const fromLookup = s.sensor_name_id
            ? instrumentNames.find((n: any) => n.id === s.sensor_name_id)?.name
            : undefined;
        if (fromLookup) return fromLookup;
        // 2. Gunakan s.name hanya jika bukan angka murni (hindari "123", "456", dll.)
        if (s.name && !/^\d+$/.test(String(s.name).trim())) return s.name;
        // 3. Gunakan type
        if (s.type) return s.type;
        // 4. Fallback
        return `Sensor #${s.id}`;
    };

    const isWindDirectionRow = (row: RawDataRow): boolean => {
        const sensor = row.sensor_id_uut ? sensors.find((s: any) => s.id === row.sensor_id_uut) : null;
        const canonicalName = sensor?.sensor_name_id
            ? instrumentNames.find((name) => name.id === sensor.sensor_name_id)?.name
            : null;
        const resultEntry = resultEntries.find((entry) => entry.sensorId === row.sensor_id_uut);
        return isWindDirectionSensor({ ...sensor, sheet_name: row.sheet_name }, canonicalName, resultEntry?.calibrationMethod);
    };


    /**
     * Batch map of `${sensor_id_std}:${standard_data}` → correction value
     * Populated by calling hitungKoreksiBatch → DB function hitung_koreksi()
     */
    const [correctionMap, setCorrectionMap] = useState<Map<string, number>>(new Map());
    const [correctionLoading, setCorrectionLoading] = useState(false);

    const normalizedData = React.useMemo(() => {
        if (!Array.isArray(data) || data.length === 0 || resultEntries.length === 0) return data;

        const orderedGroups: Array<{ key: string; rows: RawDataRow[] }> = [];
        const groupMap = new Map<string, RawDataRow[]>();

        data.forEach((row) => {
            const key = row.sheet_name && row.sheet_name.trim() !== ''
                ? `sheet:${row.sheet_name.trim()}`
                : row.sensor_id_uut != null
                    ? `sensor:${row.sensor_id_uut}`
                    : 'unknown';

            let bucket = groupMap.get(key);
            if (!bucket) {
                bucket = [];
                groupMap.set(key, bucket);
                orderedGroups.push({ key, rows: bucket });
            }
            bucket.push(row);
        });

        const rowOverrides = new Map<number, { sensorId: number | null; unitUut?: string | null; unitStd?: string | null }>();
        orderedGroups.forEach((group, index) => {
            const fallback = resultEntries[index];
            if (!fallback) return;
            group.rows.forEach((row) => {
                rowOverrides.set(row.id, fallback);
            });
        });

        return data.map((row) => {
            const fallback = rowOverrides.get(row.id);
            if (!fallback) return row;
            return {
                ...row,
                sensor_id_uut: row.sensor_id_uut ?? fallback.sensorId ?? undefined,
                unit_uut: row.unit_uut ?? fallback.unitUut ?? null,
                unit_std: row.unit_std ?? fallback.unitStd ?? null,
            };
        });
    }, [data, resultEntries]);

    // Group data by UUT sensor ID
    const groupedData = React.useMemo(() => {
        const groups: Record<string, RawDataRow[]> = {};
        normalizedData.forEach(row => {
            const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        return groups;
    }, [normalizedData]);

    const localCorrectionMap = React.useMemo(() => {
        const pairs = normalizedData
            .filter(row => row.sensor_id_std != null && row.standard_data != null)
            .map(row => ({
                reading: row.standard_data as number,
                sensorStdId: row.sensor_id_std!,
                standardCertificateId: row.standard_certificate_id
                    ?? resultEntries.find(entry => entry.sensorId === row.sensor_id_uut)?.standardCertificateId,
            }));
        return buildCorrectionMapFromCertificates(pairs, standardCerts);
    }, [normalizedData, standardCerts]);

    const sensorKeys = Object.keys(groupedData);

    useEffect(() => {
        // Jika activeTab masih 'unknown' atau 0, dan kita punya data sensor yang jelas (bukan unknown),
        // otomatis pindah ke tab pertama.
        if (sensorKeys.length > 0 && (activeTab === 0 || (activeTab === 'unknown' && !sensorKeys.includes('unknown')))) {
            setActiveTab(sensorKeys[0] === 'unknown' ? 'unknown' : Number(sensorKeys[0]));
        }
    }, [sensorKeys, activeTab]);

    useEffect(() => {
        if (isOpen && sessionId) {
            // Check cache first before on-demand computation
            const cached = qcCacheService.get(sessionId);
            if (cached) {
                // Cache hit: pre-populate correctionMap and qcLimits from cache
                setCorrectionMap(deserializeMap(cached.correction_map));
                setQcLimits(cached.qc_limits);
                setUsedCache(true);
                // Still fetch raw data for table display
                fetchRawData(sessionId);
            } else {
                // Cache miss: fall back to existing on-demand flow
                setUsedCache(false);
                fetchRawData(sessionId);
            }
            setHasSavedToTable(false); // reset indicator on each open
        }
    }, [isOpen, sessionId]);

    // Fetch QC limits per UUT sensor (skip if loaded from cache)
    useEffect(() => {
        if (usedCache) return; // Already populated from cache

        const uutSensorIds = sensorKeys
            .filter(k => k !== 'unknown')
            .map(Number)
            .filter(id => !isNaN(id));
        if (uutSensorIds.length === 0) return;

        setQcLimitsLoading(true);
        Promise.all(
            uutSensorIds.map(async id => [String(id), await fetchQCLimitForSensor(id)] as [string, QCLimit | null])
        ).then(results => {
            const map: Record<string, QCLimit | null> = {};
            results.forEach(([k, v]) => { map[k] = v; });
            setQcLimits(map);
        }).finally(() => setQcLimitsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sensorKeys.join(','), usedCache]);

    /**
     * After raw data loads, call hitungKoreksiBatch which calls the DB function
     * hitung_koreksi(reading, sensor_std_id) for each unique (standard_data, sensor_id_std) pair.
     * Skip if correctionMap was already populated from cache.
     */
    useEffect(() => {
        if (usedCache) return; // Already populated from cache
        if (normalizedData.length === 0) return;

        // Collect unique pairs that have both standard_data and sensor_id_std
        const pairs = normalizedData
            .filter(r => r.sensor_id_std != null && r.standard_data != null)
            .map(r => ({ reading: r.standard_data as number, sensorStdId: r.sensor_id_std! }));

        if (pairs.length === 0) return;

        setCorrectionLoading(true);
        hitungKoreksiBatch(pairs)
            .then(map => setCorrectionMap(map))
            .finally(() => setCorrectionLoading(false));
    }, [normalizedData, usedCache]);

    const fetchRawData = async (sId: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/raw-data?session_id=${sId}`);
            if (!res.ok) throw new Error('Failed to fetch raw data');
            const json = await res.json();
            setData(json.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Force-refresh: invalidate cache and recompute from scratch.
     * Updates correctionMap and qcLimits with fresh results.
     */
    const handleRefresh = async () => {
        if (!sessionId || isRefreshing) return;
        setIsRefreshing(true);
        try {
            clearHitungKoreksiCache();
            const newEntry = await qcCacheService.refresh(sessionId);
            // Update state with fresh computed results
            setCorrectionMap(deserializeMap(newEntry.correction_map));
            setQcLimits(newEntry.qc_limits);
            setUsedCache(true); // Mark as cache-sourced to prevent re-triggering useEffects
        } catch (err: any) {
            console.error('[QCDataModal] Refresh failed:', err);
            // On failure, fall back to on-demand computation
            setUsedCache(false);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDownloadExcel = () => {
        if (currentData.length === 0) return;

        const rows = currentData.map((row, index) => {
            const { stdCorrection, stdCorrected, uutCorrection, qc } = computeRowQC(row);
            const audit = computeAuditRow(row);
            return {
                'No': index + 1,
                'Source Row': row.source_row_index ?? '',
                'Timestamp': row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : '',
                'Std Reading': row.standard_data ?? '',
                'Koreksi Std': stdCorrection,
                'Std Terkoreksi': stdCorrected ?? '',
                'UUT Reading': row.uut_data ?? '',
                'Koreksi UUT': uutCorrection ?? '',
                ...(showCalculationAudit && audit ? {
                    'Audit Sistem': audit.systemCorrection,
                    'Audit Excel Legacy': audit.legacyCorrection,
                    'Selisih Sistem - Excel': audit.correctionDifference,
                    'Koreksi STD Tersimpan': row.std_correction ?? '',
                    'Selisih Koreksi STD Aktif - Tersimpan': audit.storedCorrectionDifference ?? '',
                    'Sumber Koreksi STD': audit.correctionSource,
                } : {}),
                'Batas WMO': qc.limitStr,
                'Status': qc.passed ? 'PASS' : 'FAIL',
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 22 },  // Timestamp
            { wch: 14 },  // Std Reading
            { wch: 14 },  // Koreksi Std
            { wch: 16 },  // Std Terkoreksi
            { wch: 14 },  // UUT Reading
            { wch: 14 },  // Koreksi UUT
            { wch: 16 },  // Batas WMO
            { wch: 8 },   // Status
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QC Check Data');
        if (showCalculationAudit && auditComparison) {
            const summary = XLSX.utils.json_to_sheet([
                { Profil: 'Sistem', Jumlah: auditComparison.system.count, 'Rata-rata': auditComparison.system.mean, 'STDEV.S': auditComparison.system.standardDeviation },
                { Profil: 'Excel Legacy', Jumlah: auditComparison.legacy.count, 'Rata-rata': auditComparison.legacy.mean, 'STDEV.S': auditComparison.legacy.standardDeviation },
                { Profil: 'Selisih', Jumlah: auditComparison.difference.count, 'Rata-rata': auditComparison.difference.mean, 'STDEV.S': auditComparison.difference.standardDeviation },
            ]);
            XLSX.utils.book_append_sheet(wb, summary, 'Ringkasan Audit');
        }

        const fileName = `QC_Check_${activeSensorName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const activeSensorLimit = activeTab !== 'unknown' && activeTab !== 0
        ? qcLimits[String(activeTab)] ?? null
        : null;

    const activeSensorName = React.useMemo(() => {
        if (activeTab === 'unknown' || activeTab === 0) {
            const inst = instruments.find(i => i.id === certificateInstrumentId);
            return inst?.name || 'Unknown Sensor';
        }
        // 1. Gunakan sheet_name asli dari baris data (prioritas utama)
        const rowsForTab = groupedData[String(activeTab)] || [];
        const storedSheetName = rowsForTab[0]?.sheet_name;
        if (storedSheetName && !/^\d+$/.test(storedSheetName.trim())) {
            return storedSheetName;
        }
        // 2. Fallback: resolve dari sensor object
        const sensor = sensors.find(s => s.id === activeTab);
        return resolveSensorName(sensor);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, sensors, instruments, certificateInstrumentId, instrumentNames, groupedData]);

    // Sensor saat ini untuk deteksi pyranometer
    const currentSensorForPyranometer = React.useMemo(() => {
        if (activeTab === 'unknown' || activeTab === 0) return null;
        const sensor = sensors.find(s => s.id === activeTab);
        if (!sensor) return null;
        return { name: sensor.name, type: sensor.type };
    }, [activeTab, sensors]);

    if (!isOpen) return null;

    const currentData = [...(groupedData[String(activeTab)] || [])].sort(compareRawDataRows);

    /**
     * Get the correction from the DB-computed correctionMap for a row.
     * Key: `${sensor_id_std}:${standard_data}`
     * 
     * UNTUK PYRANOMETER: Hitung koreksi sebagai (Std/UUT - 1) × 100%
     */
    const getStdCorrection = (row: RawDataRow): { value: number; hasData: boolean; source: 'active' | 'stored' | 'missing' | 'pyranometer' } => {
        if (row.standard_data == null) return { value: 0, hasData: false, source: 'missing' };
        
        // DETEKSI PYRANOMETER
        const sensor = row.sensor_id_uut ? sensors.find((s: any) => s.id === row.sensor_id_uut) : null;
        const pyrSensorData: PyranometerSensorData | null = sensor ? {
            name: sensor.name,
            type: sensor.type,
        } : null;
        const isPyrano = isPyranometer(pyrSensorData);
        
        if (isPyrano && row.uut_data != null && row.standard_data > 0 && row.uut_data > 0) {
            // PYRANOMETER: koreksi = (Std/UUT - 1) × 100%
            const cf = (row.standard_data / row.uut_data - 1) * 100;
            return { value: cf, hasData: true, source: 'pyranometer' };
        }
        
        // BIASA: Gunakan correctionMap
        if (!row.sensor_id_std) return { value: 0, hasData: false, source: 'missing' };
        const key = `${row.sensor_id_std}:${row.standard_data}`;
        const standardCertificateId = row.standard_certificate_id
            ?? resultEntries.find(entry => entry.sensorId === row.sensor_id_uut)?.standardCertificateId;
        const localKey = `${standardCertificateId || 'latest'}:${row.sensor_id_std}:${row.standard_data}`;
        if (localCorrectionMap.has(localKey)) {
            return { value: localCorrectionMap.get(localKey)!, hasData: true, source: 'active' };
        }
        const hasData = correctionMap.has(key);
        if (hasData) return { value: correctionMap.get(key)!, hasData: true, source: 'active' };
        if (row.std_correction != null && Number.isFinite(row.std_correction)) {
            return { value: row.std_correction, hasData: true, source: 'stored' };
        }
        return { value: 0, hasData: false, source: 'missing' };
    };

    /**
     * Statistik koreksi STD (rata-rata & standar deviasi sampel/n-1) atas
     * SEMUA baris yang punya pembacaan standar pada sensor aktif — memakai nilai
     * yang sama dengan kolom "Koreksi Std" di tabel, agar kartu = rata-rata kolom.
     * Catatan: nilai mengikuti correctionMap yang dimuat modal; klik refresh (↻)
     * setelah data di-save ulang agar statistik ikut ter-update.
     */
    const correctionStats = (() => {
        const vals = currentData
            .filter((r) => r.standard_data != null && r.sensor_id_std != null)
            .map((r) => getStdCorrection(r).value);
        if (vals.length === 0) return null;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.length > 1
            ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)
            : 0;
        return { mean, std: Math.sqrt(variance), n: vals.length };
    })();

    const computeRowQC = (row: RawDataRow) => {
        const { value: stdCorrection, hasData: hasCertData } = getStdCorrection(row);
        const hasUutValue = row.uut_data != null;
        const hasStdValue = row.standard_data != null;

        // DETEKSI PYRANOMETER
        const sensor = row.sensor_id_uut ? sensors.find((s: any) => s.id === row.sensor_id_uut) : null;
        const pyrSensorData: PyranometerSensorData | null = sensor ? {
            name: sensor.name,
            type: sensor.type,
        } : null;
        const isPyrano = isPyranometer(pyrSensorData);

        let rawStdCorrected: number | null = null;
        let stdCorrectedInUutUnit: number | null = null;
        let rawUutCorrection: number | null = null;
        let hasConversion = false;

        if (isPyrano) {
            // ═══════════════════════════════════════════════════════════
            // PYRANOMETER: stdCorrection sudah dalam % (dari getStdCorrection)
            // Tidak perlu hitung stdCorrected atau uutCorrection
            // ═══════════════════════════════════════════════════════════
            rawUutCorrection = stdCorrection; // Koreksi = CF-based correction (%)
        } else {
            // ═══════════════════════════════════════════════════════════
            // BIASA: Hitung stdCorrected dan uutCorrection
            // ═══════════════════════════════════════════════════════════
            rawStdCorrected = hasStdValue ? ((row.standard_data as number) + stdCorrection) : null;

            // Convert std_corrected to UUT unit when units differ
            const unitStd = row.unit_std || '';
            let unitUut = row.unit_uut || '';
            if (!unitUut && row.sensor_id_uut) {
                const uutSensor = sensors.find((s: any) => s.id === row.sensor_id_uut);
                unitUut = uutSensor?.graduating_unit || uutSensor?.range_capacity_unit || '';
            }
            hasConversion = !!(unitStd && unitUut && needsConversion(unitStd, unitUut));
            stdCorrectedInUutUnit = rawStdCorrected == null
                ? null
                : hasConversion
                    ? convertUnit(rawStdCorrected, unitStd, unitUut)
                    : rawStdCorrected;

            if (stdCorrectedInUutUnit != null && hasUutValue) {
                const deltaRaw = stdCorrectedInUutUnit - (row.uut_data as number);
                rawUutCorrection = isWindDirectionRow(row)
                    ? wrapWindDirectionCorrection(deltaRaw)
                    : deltaRaw;
            }
        }

        return {
            stdCorrection,                                // raw value (untuk pyranometer: %)
            stdCorrected: stdCorrectedInUutUnit,          // raw value (null untuk pyranometer)
            stdCorrectedRaw: rawStdCorrected,             // raw value (null untuk pyranometer)
            uutCorrection: rawUutCorrection,              // raw value (untuk pyranometer: %)
            hasCertData,
            hasConversion,
            qc: rawUutCorrection == null
                ? { passed: true, limitStr: '-', absCorrection: 0, limitValue: null }
                : checkQCResult(rawUutCorrection, activeSensorLimit),
        };
    };

    const computeAuditRow = (row: RawDataRow) => {
        if (row.standard_data == null || row.uut_data == null) return null;
        const { value: stdCorrection, source } = getStdCorrection(row);
        const uutSensor = row.sensor_id_uut
            ? sensors.find((sensor: any) => sensor.id === row.sensor_id_uut)
            : null;
        return {
            ...calculateAuditRow({
            standardReading: row.standard_data,
            uutReading: row.uut_data,
            standardCorrection: stdCorrection,
            storedStandardCorrection: row.std_correction,
            unitStd: row.unit_std,
            unitUut: row.unit_uut || uutSensor?.graduating_unit || uutSensor?.range_capacity_unit,
            isWindDirection: isWindDirectionRow(row),
            }),
            correctionSource: source,
        };
    };

    const auditRows = currentData
        .map(row => ({ row, audit: computeAuditRow(row) }))
        .filter((item): item is { row: RawDataRow; audit: NonNullable<ReturnType<typeof computeAuditRow>> } => item.audit != null);
    const auditComparison = auditRows.length > 0 ? {
        system: calculateAuditStats(auditRows.map(item => item.audit.systemCorrection)),
        legacy: calculateAuditStats(auditRows.map(item => item.audit.legacyCorrection)),
        difference: calculateAuditStats(auditRows.map(item => item.audit.correctionDifference)),
        storedCorrectionMismatchCount: auditRows.filter(item =>
            item.audit.storedCorrectionDifference != null
            && Math.abs(item.audit.storedCorrectionDifference) > 1e-12
        ).length,
        storedFallbackCount: auditRows.filter(item => item.audit.correctionSource === 'stored').length,
        storedFallbackReadings: auditRows
            .filter(item => item.audit.correctionSource === 'stored')
            .slice(0, 5)
            .map(item => item.row.standard_data),
    } : null;

    const failCount = currentData.filter(row => {
        const qc = computeRowQC(row);
        return qc.uutCorrection != null && !qc.qc.passed;
    }).length;
    const stdSensorId = currentData.length > 0 ? currentData[0].sensor_id_std : null;

    /**
     * Calculate UUT Avg, Correction, and Uncertainty for ALL sensor tabs (bulk)
     * then call onCalculateSaved to update the certificate table.
     */
    const handleSaveToTable = async () => {
        if (sensorKeys.length === 0) return;
        if (correctionLoading) return;

        const unresolvedCorrections = normalizedData.filter(row => {
            if (row.standard_data == null || row.sensor_id_std == null) return false;
            const sensor = row.sensor_id_uut
                ? sensors.find((item: any) => item.id === row.sensor_id_uut)
                : null;
            if (isPyranometer(sensor ? { name: sensor.name, type: sensor.type } : null)) return false;
            return getStdCorrection(row).source !== 'active';
        });
        if (unresolvedCorrections.length > 0) {
            window.alert(
                `${unresolvedCorrections.length} koreksi STD belum berhasil dihitung aktif. `
                + 'Klik Refresh dan pastikan Fallback koreksi tersimpan = 0 sebelum menyimpan hasil.'
            );
            return;
        }

        setIsSavingToTable(true);
        try {
            const updates: Array<{ sensorId: number | string, table: any[] }> = [];
            const calculationSnapshots: CalculationSnapshot[] = [];

            for (const key of sensorKeys) {
                const groupData = groupedData[key] || [];
                if (groupData.length === 0) continue;

                const sensorId = key === 'unknown' ? null : Number(key);
                const uutSensor = sensorId ? sensors.find((s: any) => s.id === sensorId) : null;

                // Find standard cert for this sensor group via correctionMap data
                const stdSensorId = groupData[0]?.sensor_id_std;
                const selectedCertificateId = groupData[0]?.standard_certificate_id
                    ?? resultEntries.find(entry => entry.sensorId === groupData[0]?.sensor_id_uut)?.standardCertificateId;
                const standardCertRecord = selectedCertificateId
                    ? standardCerts.find((certificate: any) => Number(certificate.id) === Number(selectedCertificateId))
                    : stdSensorId
                        ? standardCerts.find((certificate: any) => certificate.sensor_id === stdSensorId)
                        : null;

                const rowsForCalc = groupData.filter(r => r.uut_data != null);
                if (rowsForCalc.length === 0) continue;
                const isWindDirectionGroup = isWindDirectionRow(rowsForCalc[0]);
                const uutAvg = rowsForCalc.reduce((sum, r) => sum + (r.uut_data as number), 0) / rowsForCalc.length;

                // ═══════════════════════════════════════════════════════════════
                // DETEKSI PYRANOMETER (SEBELUM HITUNG KOREKSI)
                // ═══════════════════════════════════════════════════════════════
                const pyranometerSensorData: PyranometerSensorData | null = uutSensor ? {
                    name: uutSensor.name,
                    type: uutSensor.type,
                    resolution: uutSensor.resolution ?? undefined,
                    range_capacity: uutSensor.range_capacity
                } : null;

                const isPyranometerSensor = isPyranometer(pyranometerSensorData);
                const finalCorrectionPairs = isPyranometerSensor
                    ? []
                    : rowsForCalc
                        .map(row => ({ row, correction: computeRowQC(row).uutCorrection }))
                        .filter((item): item is { row: RawDataRow; correction: number } =>
                            item.row.standard_data != null
                            && item.correction != null
                            && Number.isFinite(item.correction)
                        );

                finalCorrectionPairs.forEach(({ row, correction }) => {
                    const computed = computeRowQC(row);
                    if (computed.stdCorrectedRaw == null) return;
                    calculationSnapshots.push({
                        id: row.id,
                        std_correction: computed.stdCorrection,
                        std_corrected: computed.stdCorrectedRaw,
                        uut_correction: correction,
                    });
                });
                
                // Compute average correction
                let correctionAvg = 0;
                
                if (isPyranometerSensor && uutSensor) {
                    // ═══════════════════════════════════════════════════════════
                    // PYRANOMETER: Hitung koreksi per baris sebagai (Std/UUT - 1) × 100%
                    // ═══════════════════════════════════════════════════════════
                    console.log('[QCDataModal] PYRANOMETER DETECTED - Calculating CF-based correction');
                    console.log('[QCDataModal] rowsForCalc count:', rowsForCalc.length);
                    
                    const cfPerRow = rowsForCalc.map((row, idx) => {
                        const std = row.standard_data || 0;
                        const uut = row.uut_data || 0;
                        if (std <= 0 || uut <= 0) return null;
                        const cf = (std / uut - 1) * 100;
                        if (idx < 3) console.log(`[QCDataModal] Row ${idx}: std=${std}, uut=${uut}, CF=${cf.toFixed(4)}%`);
                        return cf;
                    }).filter((v): v is number => v != null);
                    
                    if (cfPerRow.length > 0) {
                        correctionAvg = cfPerRow.reduce((sum, c) => sum + c, 0) / cfPerRow.length;
                        console.log('[QCDataModal] correctionAvg (pyranometer):', correctionAvg.toFixed(4) + '%');
                    } else {
                        console.log('[QCDataModal] WARNING: No valid CF data found!');
                    }
                } else {
                    // ═══════════════════════════════════════════════════════════
                    // BIASA: Hitung koreksi dari correctionMap (interpolasi)
                    // ═══════════════════════════════════════════════════════════
                    const corrections = finalCorrectionPairs.map(item => item.correction);
                    if (corrections.length > 0) {
                        correctionAvg = corrections.reduce((sum, correction) => sum + correction, 0) / corrections.length;
                    }
                }

                // Hitung uncertainty
                let uncertainty: number;
                let displayUutAvg = uutAvg;
                let displayCorrection = correctionAvg;
                
                if (isPyranometerSensor && uutSensor) {
                    // PYRANOMETER: Hitung CF (rasio) dalam %
                    const stdReadings = rowsForCalc.map(r => r.standard_data || 0).filter(v => v > 0);
                    const uutReadingsForCF = rowsForCalc.map(r => r.uut_data || 0).filter(v => v > 0);
                    
                    const cfResult = calculateCalibrationFactor(stdReadings, uutReadingsForCF);
                    
                    const range = parseFloat(uutSensor.range_capacity || '2000') || 2000;
                    const interpolatedU95 = standardCertRecord?.u95_general || 2.1;
                    const stdMeanVal = stdReadings.length > 0 ? stdReadings.reduce((a, b) => a + b, 0) / stdReadings.length : 0;
                    const uutMeanVal = uutReadingsForCF.length > 0 ? uutReadingsForCF.reduce((a, b) => a + b, 0) / uutReadingsForCF.length : 0;
                    const stdMinVal = stdReadings.length > 0 ? Math.min(...stdReadings) : 0;
                    
                    // Tipe alat standar (untuk ISO 9060 Drift lookup)
                    const stdSensorForPyr = rowsForCalc[0]?.sensor_id_std
                        ? sensors.find((s: any) => s.id === rowsForCalc[0].sensor_id_std)
                        : null;
                    const stdSensorTypeForPyr = (stdSensorForPyr as any)?.type || (stdSensorForPyr as any)?.name || '';
                    
                    const pyrResult = calculatePyranometerUncertainty({
                        cf_result: cfResult,
                        certU95_percent: interpolatedU95,
                        resolutionStd: standardCertRecord?.resolution || 0.01,
                        resolutionUut: uutSensor.resolution || 0.1,
                        range: range,
                        sensorType: uutSensor.type || uutSensor.name || '',
                        stdMean: stdMeanVal,
                        uutMean: uutMeanVal,
                        stdMin: stdMinVal,
                        stdSensorType: stdSensorTypeForPyr,
                        sensitivityStd: (standardCertRecord as any)?.sensitivity || undefined,
                        sensitivityUut: (uutSensor as any)?.sensitivity || undefined,
                    });
                    
                    // Untuk pyranometer: 
                    // - uutAvg = rata-rata UUT (W/m²) untuk "Penunjukkan Alat"
                    // - displayCorrection = CF untuk "Faktor Kalibrasi"
                    // - uncertainty = U95% untuk "Ketidakpastian"
                    uncertainty = pyrResult.u95_percent;
                    displayUutAvg = uutAvg; // Rata-rata UUT (W/m²)
                    displayCorrection = cfResult.cf_final; // Faktor Kalibrasi (CF)
                } else {
                    // BIASA: Gunakan perhitungan standar (selisih absolut)
                    const isAnalog = (instruments.find(i => i.id === certificateInstrumentId)?.instrument_type_id ?? 1) === 2;
                    const result = calculateCalibrationResult({
                        currentData: finalCorrectionPairs.map(item => item.row),
                        uutSensor,
                        standardCertRecord,
                        isAnalog,
                        isWindDirection: isWindDirectionGroup,
                        finalCorrections: finalCorrectionPairs.map(item => item.correction),
                    });
                    displayUutAvg = result.uutAvg;
                    displayCorrection = result.correction;
                    uncertainty = result.uncertainty;
                }

                // DEBUG: Log final values
                console.log('[QCDataModal] Final values for sensor', sensorId, ':', {
                    isPyranometerSensor,
                    correctionAvg: correctionAvg.toFixed(4),
                    displayCorrection: displayCorrection.toFixed(4),
                    uncertainty: uncertainty.toFixed(4),
                    displayUutAvg: displayUutAvg.toFixed(4)
                });

                // Format as standard table structure
                // PENTING: Jangan bulatkan di tahap ini — pertahankan presisi penuh.
                // Pembulatan hanya dilakukan di layer display (UI), bukan di data yang disimpan.
                const newTable = [{
                    title: isPyranometerSensor ? 'Hasil Kalibrasi Pyranometer / Pyranometer Calibration Result' : 'Hasil Kalibrasi / Calibration Result',
                    headers: isPyranometerSensor 
                        ? ['Penunjukkan Alat / Instrument Reading', 'Faktor Kalibrasi / Calibration Factor', 'Ketidakpastian / Uncertainty']
                        : ['Penunjukan Alat / Instrument Reading', 'Koreksi / Correction', 'Ketidakpastian / Uncertainty'],
                    rows: [{
                        key: isPyranometerSensor ? String(uutAvg) : String(displayUutAvg), // Pyranometer: rata-rata UUT, Biasa: rata-rata UUT
                        unit: isPyranometerSensor ? String(displayCorrection) : String(displayCorrection), // Pyranometer: CF, Biasa: Koreksi
                        value: String(uncertainty), // Pyranometer: U95%, Biasa: U95 absolut
                        extraValues: []
                    }]
                }];

                updates.push({ sensorId: key === 'unknown' ? 'unknown' : Number(key), table: newTable });
            }

            if (calculationSnapshots.length > 0) {
                const uniqueSnapshots = dedupeCalculationSnapshots(calculationSnapshots);
                const snapshotResponse = await fetch('/api/raw-data', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ calculation_snapshots: uniqueSnapshots }),
                });
                if (!snapshotResponse.ok) {
                    const payload = await snapshotResponse.json().catch(() => ({}));
                    throw new Error(payload.error || 'Gagal menyimpan snapshot kalkulasi raw data');
                }
                const snapshotsById = new Map(uniqueSnapshots.map(snapshot => [String(snapshot.id), snapshot]));
                setData(current => current.map(row => {
                    const snapshot = snapshotsById.get(String(row.id));
                    return snapshot ? {
                        ...row,
                        std_correction: snapshot.std_correction,
                        std_corrected: snapshot.std_corrected,
                        uut_correction: snapshot.uut_correction,
                    } : row;
                }));
            }

            if (onCalculateSaved && updates.length > 0) {
                await onCalculateSaved(updates);
                setHasSavedToTable(true); // mark as saved
            }
        } catch (err: any) {
            console.error('Error calculating table bulk:', err);
        } finally {
            setIsSavingToTable(false);
        }
    };

    const isCalculateDisabled = isSavingToTable || correctionLoading;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <svg className="w-6 h-6 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            QC Check — Raw Data Analysis
                            {/* Refresh button */}
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing || !sessionId}
                                title="Refresh QC data (recompute from scratch)"
                                className={`ml-2 p-1.5 rounded-full transition-all ${
                                    isRefreshing
                                        ? 'text-gray-400 cursor-wait'
                                        : 'text-gray-500 hover:text-[#1e377c] hover:bg-blue-50'
                                }`}
                            >
                                {isRefreshing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                )}
                            </button>
                            {/* Download Excel button */}
                            {currentData.length > 0 && (
                                <button
                                    onClick={handleDownloadExcel}
                                    disabled={correctionLoading}
                                    title="Download data QC sebagai file Excel"
                                    className={`ml-1 p-1.5 rounded-full transition-all ${
                                        correctionLoading
                                            ? 'text-gray-400 cursor-wait'
                                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </button>
                            )}
                            {currentData.length > 0 && !isPyranometer(currentSensorForPyranometer) && (
                                <button
                                    onClick={() => setShowCalculationAudit(value => !value)}
                                    title="Bandingkan kalkulasi Sistem dengan formula Excel Legacy"
                                    className={`ml-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${showCalculationAudit
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'text-gray-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent'
                                    }`}
                                >
                                    Audit {showCalculationAudit ? 'ON' : 'OFF'}
                                </button>
                            )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Certificate: <span className="font-mono font-medium">{title}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-100">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e377c]"></div>
                            <p className="text-gray-500 font-medium">Memuat data...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center p-8 m-6 bg-red-50 rounded-xl border border-red-200">
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    ) : normalizedData.length === 0 ? (
                        <div className="text-center p-12 m-6 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">Tidak ada data untuk sesi ini.</p>
                        </div>
                    ) : (
                        <>
                            {/* Tabs */}
                            {sensorKeys.length > 0 && (
                                <div className="bg-white border-b border-gray-200 flex px-6 overflow-x-auto shrink-0 shadow-sm">
                                    {sensorKeys.map((key) => {
                                        const sensorId = key === 'unknown' ? 'unknown' : Number(key);
                                        const isActive = activeTab === sensorId;
                                        let tabLabel = 'Unknown Sensor';
                                        if (key !== 'unknown') {
                                            // 1. Gunakan sheet_name asli dari Excel (disimpan di DB)
                                            const rowsForKey = groupedData[key] || [];
                                            const storedSheetName = rowsForKey[0]?.sheet_name;
                                            if (storedSheetName && !/^\d+$/.test(storedSheetName.trim())) {
                                                tabLabel = storedSheetName;
                                            } else {
                                                // 2. Fallback: resolve dari sensor object
                                                const s = sensors.find(sen => sen.id === Number(key));
                                                tabLabel = resolveSensorName(s);
                                            }
                                        }
                                        const limit = key !== 'unknown' ? qcLimits[key] : null;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActiveTab(sensorId)}
                                                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${isActive ? 'border-[#1e377c] text-[#1e377c] bg-blue-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {tabLabel}
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {groupedData[key].length}
                                                </span>
                                                {key !== 'unknown' && qcLimits[key] !== undefined && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${limit ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {limit ? `±${limit.rawLimit}` : 'No QC'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex-1 overflow-hidden flex flex-col p-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                                    {showCalculationAudit && auditComparison && !isPyranometer(currentSensorForPyranometer) && (
                                        <div className="p-4 border-b border-amber-200 bg-amber-50 shrink-0">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div>
                                                    <div className="text-xs font-bold text-amber-900 uppercase">Audit Perbandingan Kalkulasi</div>
                                                    <div className="text-[11px] text-amber-700 mt-0.5">
                                                        Formula resmi Sistem mengikuti workbook. Selisih harus nol bila input dan koreksi STD identik.
                                                    </div>
                                                </div>
                                                <div className="text-[11px] text-amber-800 whitespace-nowrap">
                                                    {auditComparison.system.count} pasangan valid
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                {[
                                                    { label: 'Sistem', stats: auditComparison.system },
                                                    { label: 'Excel Legacy', stats: auditComparison.legacy },
                                                    { label: 'Selisih', stats: auditComparison.difference },
                                                ].map(({ label, stats }) => (
                                                    <div key={label} className="bg-white rounded border border-amber-200 p-2">
                                                        <div className="text-[10px] uppercase font-semibold text-gray-500">{label}</div>
                                                        <div className="text-xs text-gray-700 mt-1">Rata-rata: <b className="font-mono">{stats.mean.toFixed(9)}</b></div>
                                                        <div className="text-xs text-gray-700">STDEV.S: <b className="font-mono">{stats.standardDeviation.toFixed(9)}</b></div>
                                                    </div>
                                                ))}
                                                <div className="bg-white rounded border border-amber-200 p-2">
                                                    <div className="text-[10px] uppercase font-semibold text-gray-500">Sumber Koreksi STD</div>
                                                    <div className="text-xs text-gray-700 mt-1">Aktif vs tersimpan berbeda:</div>
                                                    <div className={`text-sm font-bold ${auditComparison.storedCorrectionMismatchCount > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                                        {auditComparison.storedCorrectionMismatchCount} baris
                                                    </div>
                                                    <div className={`text-[10px] mt-1 ${auditComparison.storedFallbackCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                                                        Fallback koreksi tersimpan: {auditComparison.storedFallbackCount} baris
                                                    </div>
                                                    {auditComparison.storedFallbackReadings.length > 0 && (
                                                        <div className="text-[10px] text-amber-700 mt-1 break-words">
                                                            STD: {auditComparison.storedFallbackReadings.join(', ')}
                                                            {auditComparison.storedFallbackCount > auditComparison.storedFallbackReadings.length ? ', ...' : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Stats row */}
                                    <div className={`grid gap-3 p-4 border-b border-gray-100 shrink-0 ${isPyranometer(currentSensorForPyranometer) ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'}`}>
                                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                            <div className="text-[10px] text-indigo-600 font-semibold uppercase">Sensor UUT</div>
                                            <div className="text-sm font-bold text-indigo-900 truncate" title={activeSensorName}>{activeSensorName}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${activeSensorLimit ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                                            <div className={`text-[10px] font-semibold uppercase ${activeSensorLimit ? 'text-green-600' : 'text-yellow-600'}`}>Batas WMO (Master QC)</div>
                                            <div className={`text-sm font-bold ${activeSensorLimit ? 'text-green-900' : 'text-yellow-800'}`}>
                                                {qcLimitsLoading ? <span className="text-xs italic">Memuat...</span>
                                                    : activeSensorLimit ? `± ${activeSensorLimit.rawLimit} ${activeSensorLimit.unit}`
                                                        : <span className="text-xs italic text-yellow-700">Tidak ada di Master QC</span>}
                                            </div>
                                        </div>
                                        
                                        {/* Koreksi Std (DB) - HANYA untuk non-pyranometer */}
                                        {!isPyranometer(currentSensorForPyranometer) && (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                <div className="text-[10px] text-blue-600 font-semibold uppercase">Koreksi Std (DB)</div>
                                                <div className="text-blue-900">
                                                    {correctionLoading
                                                        ? <span className="text-xs italic animate-pulse">Menghitung...</span>
                                                        : !stdSensorId || !correctionStats
                                                            ? <span className="text-gray-400 text-xs">–</span>
                                                            : (
                                                                <div className="mt-0.5 space-y-0.5">
                                                                    <div className="flex items-baseline justify-between gap-2">
                                                                        <span className="text-[10px] font-normal text-blue-600">Rata²</span>
                                                                        <span className="text-sm font-bold tabular-nums">{correctionStats.mean.toFixed(4)}</span>
                                                                    </div>
                                                                    <div className="flex items-baseline justify-between gap-2">
                                                                        <span className="text-[10px] font-normal text-blue-600">Std Dev</span>
                                                                        <span className="text-sm font-bold tabular-nums">{correctionStats.std.toFixed(4)}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Statistik Standar & UUT - KHUSUS pyranometer */}
                                        {isPyranometer(currentSensorForPyranometer) && (() => {
                                            const stdValues = currentData.filter(r => r.standard_data != null).map(r => r.standard_data as number);
                                            const uutValues = currentData.filter(r => r.uut_data != null).map(r => r.uut_data as number);
                                            
                                            const calcStats = (vals: number[]) => {
                                                if (vals.length === 0) return { avg: '-', std: '-', max: '-', min: '-' };
                                                const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
                                                const max = Math.max(...vals).toFixed(2);
                                                const min = Math.min(...vals).toFixed(2);
                                                let std = '-';
                                                if (vals.length >= 2) {
                                                    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                                                    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
                                                    std = Math.sqrt(variance).toFixed(2);
                                                }
                                                return { avg, std, max, min };
                                            };
                                            
                                            const stdStats = calcStats(stdValues);
                                            const uutStats = calcStats(uutValues);
                                            
                                            return (
                                                <div className="bg-gradient-to-r from-emerald-50 to-orange-50 p-2 rounded-lg border border-gray-200">
                                                    <div className="text-[9px] font-semibold text-gray-600 uppercase mb-1 text-center">Statistik Kalibrasi</div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                                                        <div className="flex justify-between">
                                                            <span className="text-emerald-600">Std Rata²</span>
                                                            <span className="font-bold tabular-nums">{stdStats.avg}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-orange-600">UUT Rata²</span>
                                                            <span className="font-bold tabular-nums">{uutStats.avg}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-emerald-600">Std Dev</span>
                                                            <span className="font-bold tabular-nums">{stdStats.std}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-orange-600">UUT Dev</span>
                                                            <span className="font-bold tabular-nums">{uutStats.std}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-emerald-600">Std Max</span>
                                                            <span className="font-bold tabular-nums">{stdStats.max}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-orange-600">UUT Max</span>
                                                            <span className="font-bold tabular-nums">{uutStats.max}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-emerald-600">Std Min</span>
                                                            <span className="font-bold tabular-nums">{stdStats.min}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-orange-600">UUT Min</span>
                                                            <span className="font-bold tabular-nums">{uutStats.min}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div className="text-[10px] text-gray-600 font-semibold uppercase">Data Points</div>
                                            <div className="text-xl font-bold text-gray-900">{currentData.length}</div>
                                        </div>
                                        {activeSensorLimit && (
                                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                                <div className="text-[10px] text-red-600 font-semibold uppercase">Melebihi Batas</div>
                                                <div className="text-xl font-bold text-red-900">{failCount}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Table */}
                                    <div className="flex-1 overflow-auto">
                                        <table className="min-w-full divide-y divide-gray-200 relative">
                                            <thead className="bg-[#1e377c] text-white sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase w-10">No</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Timestamp</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Std Reading</th>
                                                    {/* KOLOM FAKTOR KALIBRASI - KHUSUS PYRANOMETER */}
                                                    {isPyranometer(currentSensorForPyranometer) && (
                                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-green-900/30">
                                                            Faktor Kalibrasi
                                                            <span className="text-[9px] block opacity-70 font-normal normal-case">Std/UUT</span>
                                                        </th>
                                                    )}
                                                    {/* KOLOM KOREKSI - HANYA untuk non-pyranometer */}
                                                    {!isPyranometer(currentSensorForPyranometer) && (
                                                        <>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-blue-900/30">
                                                                Koreksi Std
                                                                <span className="text-[9px] block opacity-70 font-normal normal-case">hitung_koreksi()</span>
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-blue-900/20">
                                                                Std Terkoreksi
                                                                <span className="text-[9px] block opacity-70 font-normal normal-case">std + koreksi</span>
                                                            </th>
                                                        </>
                                                    )}
                                                    {showCalculationAudit && !isPyranometer(currentSensorForPyranometer) && (
                                                        <>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-amber-900/30">Sistem</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-amber-900/30">Excel Legacy</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-amber-900/30">Selisih</th>
                                                        </>
                                                    )}
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">UUT Reading</th>
                                                    {/* KOLOM KOREKSI UUT, BATAS WMO, STATUS - HANYA untuk non-pyranometer */}
                                                    {!isPyranometer(currentSensorForPyranometer) && (
                                                        <>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                                                                Koreksi UUT
                                                                <span className="text-[9px] block opacity-70 font-normal normal-case">std_kor − uut</span>
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Batas WMO</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase w-20">Status</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentData.length > 0 ? currentData.map((row, index) => {
                                                    const { stdCorrection, stdCorrected, uutCorrection, hasCertData, qc } = computeRowQC(row);
                                                    const audit = computeAuditRow(row);
                                                    const isFail = uutCorrection != null && !qc.passed;
                                                    
                                                    // DETEKSI PYRANOMETER untuk hitung CF
                                                    const sensor = row.sensor_id_uut ? sensors.find((s: any) => s.id === row.sensor_id_uut) : null;
                                                    const pyrSensorData: PyranometerSensorData | null = sensor ? {
                                                        name: sensor.name,
                                                        type: sensor.type,
                                                    } : null;
                                                    const isPyrano = isPyranometer(pyrSensorData);
                                                    
                                                    // Hitung CF untuk pyranometer
                                                    const cfValue = (isPyrano && row.standard_data != null && row.uut_data != null && row.standard_data > 0 && row.uut_data > 0)
                                                        ? (row.standard_data / row.uut_data)
                                                        : null;
                                                    
                                                    return (
                                                        <tr key={`${row.id}-${index}`} className={`${isFail ? 'bg-pink-50 hover:bg-pink-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">{index + 1}</td>
                                                            <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                                                                {row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : <span className="text-gray-400 italic">-</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm font-medium text-gray-700">
                                                                {row.standard_data != null ? (
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <span>{row.standard_data}</span>
                                                                        <SigFigBadge value={row.standard_data} />
                                                                    </span>
                                                                ) : <span className="text-gray-400 italic">-</span>}
                                                            </td>
                                                            {/* KOLOM FAKTOR KALIBRASI - KHUSUS PYRANOMETER */}
                                                            {isPyrano && (
                                                                <td className="px-4 py-2 text-sm font-bold bg-green-50/50">
                                                                    {cfValue != null ? (
                                                                        <span className="text-green-700 font-mono">{cfValue.toFixed(2)}</span>
                                                                    ) : <span className="text-gray-400 italic">-</span>}
                                                                </td>
                                                            )}
                                                            {/* KOLOM KOREKSI STD - HANYA untuk non-pyranometer */}
                                                            {!isPyrano && (
                                                                <>
                                                                    <td className="px-4 py-2 text-sm font-medium bg-blue-50/50">
                                                                        {correctionLoading
                                                                            ? <span className="text-gray-300 text-xs">...</span>
                                                                            : hasCertData
                                                                                ? (
                                                                                    <span className="inline-flex items-center gap-1.5">
                                                                                        <span className="text-blue-700 font-mono">{stdCorrection > 0 ? '+' : ''}{stdCorrection.toFixed(4)}</span>
                                                                                        <SigFigBadge value={stdCorrection} />
                                                                                    </span>
                                                                                )
                                                                                : <span className="text-gray-400 text-[10px] italic">tidak ada</span>}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-sm font-bold text-blue-900 bg-blue-50/30">
                                                                        {stdCorrected != null ? (
                                                                            <span className="inline-flex items-center gap-1.5">
                                                                                <span>{stdCorrected}</span>
                                                                                <SigFigBadge value={stdCorrected} />
                                                                            </span>
                                                                        ) : row.standard_data != null ? <span className="text-gray-400 text-xs">= {row.standard_data}</span> : <span className="text-gray-400 italic">-</span>}
                                                                    </td>
                                                                </>
                                                            )}
                                                            {showCalculationAudit && !isPyrano && (
                                                                <>
                                                                    <td className="px-4 py-2 text-xs font-mono bg-amber-50/40">{audit ? audit.systemCorrection.toFixed(9) : '-'}</td>
                                                                    <td className="px-4 py-2 text-xs font-mono bg-amber-50/40">{audit ? audit.legacyCorrection.toFixed(9) : '-'}</td>
                                                                    <td className={`px-4 py-2 text-xs font-mono bg-amber-50/40 ${audit && Math.abs(audit.correctionDifference) > 1e-12 ? 'text-amber-800 font-bold' : 'text-gray-500'}`}>
                                                                        {audit ? audit.correctionDifference.toExponential(6) : '-'}
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-4 py-2 text-sm font-medium text-gray-700">
                                                                {row.uut_data != null ? (
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <span>{row.uut_data}</span>
                                                                        <SigFigBadge value={row.uut_data} />
                                                                    </span>
                                                                ) : <span className="text-gray-400 italic">-</span>}
                                                            </td>
                                                            {/* KOLOM KOREKSI UUT, BATAS WMO, STATUS - HANYA untuk non-pyranometer */}
                                                            {!isPyrano && (
                                                                <>
                                                                    <td className={`px-4 py-2 text-sm font-bold ${isFail ? 'text-red-600' : 'text-green-600'}`}>
                                                                        {uutCorrection != null ? (
                                                                            <span className="inline-flex items-center gap-1.5">
                                                                                <span>{uutCorrection > 0 ? '+' : ''}{uutCorrection.toFixed(4)}</span>
                                                                                <SigFigBadge value={uutCorrection} />
                                                                            </span>
                                                                        ) : <span className="text-gray-400 italic">-</span>}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs text-gray-500">{qc.limitStr}</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        {isFail
                                                                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">FAIL</span>
                                                                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">PASS</span>}
                                                                    </td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan={isPyranometer(currentSensorForPyranometer) ? 4 : showCalculationAudit ? 12 : 9} className="px-6 py-10 text-center text-gray-400 italic">
                                                            Tidak ada data untuk sensor ini.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center shrink-0">
                    <div className="text-xs text-gray-500 max-w-2xl">
                        <span className="font-semibold text-gray-700">Alur:</span>{' '}
                        Std Reading → <code className="bg-gray-100 px-1 rounded">hitung_koreksi()</code> (interpolasi DB) → Std Terkoreksi → Koreksi UUT = Std Terkoreksi − UUT Reading.
                        Batas dari <b>Master QC</b> berdasarkan jenis sensor.
                        {!activeSensorLimit && (
                            <span className="ml-1 text-yellow-600">⚠ Sensor belum ada di Master QC.</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Info frozen-data muncul di non-draft (sent/verified/...) agar user paham kenapa tombol hilang */}
                        {currentData.length > 0 && certificateStatus && certificateStatus !== 'draft' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>Data sudah {certificateStatus === 'sent' ? 'dikirim ke Verifikator' : 'diverifikasi'} — tabel tidak bisa diubah lagi.</span>
                            </div>
                        )}
                        {/* Tombol Hitung & Input: hanya saat draft (atau status tidak di-set → legacy) */}
                        {currentData.length > 0 && (!certificateStatus || certificateStatus === 'draft') && (
                            <button
                                onClick={handleSaveToTable}
                                disabled={isCalculateDisabled}
                                title={
                                    correctionLoading
                                        ? 'Tunggu sampai perhitungan koreksi standar selesai.'
                                        : hasSavedToTable
                                            ? 'Sudah pernah dijalankan. Klik lagi untuk memperbarui.'
                                            : 'Hitung dan simpan hasil ke tabel sertifikat'
                                }
                                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                                    isCalculateDisabled
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : hasSavedToTable
                                            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-sm ring-2 ring-green-300'
                                            : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-sm'
                                }`}
                            >
                                {correctionLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                                        <span>Menghitung koreksi...</span>
                                    </>
                                ) : isSavingToTable ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : hasSavedToTable ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Tersimpan ke Tabel Sertifikat</span>
                                        <span className="text-[10px] bg-green-400/30 px-1.5 py-0.5 rounded-full font-normal">Klik lagi utk update</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Hitung &amp; Input ke Tabel Sertifikat</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-all">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QCDataModal;
