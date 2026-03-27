import React, { useEffect, useState, useCallback } from 'react';
import { Instrument, Sensor } from '../../lib/supabase';
import {
    fetchQCLimitForSensor, checkQCResult, QCLimit,
    hitungKoreksiBatch
} from '../../lib/qc-utils';
import { convertUnit, needsConversion } from '../../lib/unitConversion';
import { calculateCalibrationResult } from '../../lib/uncertainty-utils';


interface RawDataRow {
    id: number;
    created_at: string;
    timestamp: string;
    standard_data: number;
    uut_data: number;
    session_id: string;
    sensor_id_uut?: number;
    sensor_id_std?: number;
    sheet_name?: string | null;
    unit_uut?: string | null;   // UUT data unit (reference)
    unit_std?: string | null;   // STD data unit (may need conversion to UUT unit)
}

interface QCDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    sessionId?: string;
    certificateId: string;
    certificateInstrumentId?: number;
    instruments: Instrument[];
    sensors: any[];
    instrumentNames: Array<{ id: number; name: string }>;
    standardCerts?: any[];
    onCalculateSaved?: (updates: Array<{ sensorId: number | string, table: any[] }>) => void | Promise<void>;
}

const QCDataModal: React.FC<QCDataModalProps> = ({
    isOpen, onClose, title, sessionId, instruments, sensors, certificateInstrumentId, instrumentNames, standardCerts = [], onCalculateSaved
}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<RawDataRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<number | 'unknown'>('unknown');
    const [isSavingToTable, setIsSavingToTable] = useState(false);

    // Per UUT sensor: QC limits from master_qc
    const [qcLimits, setQcLimits] = useState<Record<string, QCLimit | null>>({});
    const [qcLimitsLoading, setQcLimitsLoading] = useState(false);

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


    /**
     * Batch map of `${sensor_id_std}:${standard_data}` → correction value
     * Populated by calling hitungKoreksiBatch → DB function hitung_koreksi()
     */
    const [correctionMap, setCorrectionMap] = useState<Map<string, number>>(new Map());
    const [correctionLoading, setCorrectionLoading] = useState(false);

    // Group data by UUT sensor ID
    const groupedData = React.useMemo(() => {
        const groups: Record<string, RawDataRow[]> = {};
        data.forEach(row => {
            const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        return groups;
    }, [data]);

    const sensorKeys = Object.keys(groupedData);

    useEffect(() => {
        // Jika activeTab masih 'unknown' atau 0, dan kita punya data sensor yang jelas (bukan unknown),
        // otomatis pindah ke tab pertama.
        if (sensorKeys.length > 0 && (activeTab === 0 || (activeTab === 'unknown' && !sensorKeys.includes('unknown')))) {
            setActiveTab(sensorKeys[0] === 'unknown' ? 'unknown' : Number(sensorKeys[0]));
        }
    }, [sensorKeys, activeTab]);

    useEffect(() => {
        if (isOpen && sessionId) fetchRawData(sessionId);
    }, [isOpen, sessionId]);

    // Fetch QC limits per UUT sensor
    useEffect(() => {
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
    }, [sensorKeys.join(',')]);

    /**
     * After raw data loads, call hitungKoreksiBatch which calls the DB function
     * hitung_koreksi(reading, sensor_std_id) for each unique (standard_data, sensor_id_std) pair.
     */
    useEffect(() => {
        if (data.length === 0) return;

        // Collect unique pairs that have both standard_data and sensor_id_std
        const pairs = data
            .filter(r => r.sensor_id_std != null)
            .map(r => ({ reading: r.standard_data, sensorStdId: r.sensor_id_std! }));

        if (pairs.length === 0) return;

        setCorrectionLoading(true);
        hitungKoreksiBatch(pairs)
            .then(map => setCorrectionMap(map))
            .finally(() => setCorrectionLoading(false));
    }, [data]);

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

    if (!isOpen) return null;

    const currentData = (groupedData[String(activeTab)] || []).sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    /**
     * Get the correction from the DB-computed correctionMap for a row.
     * Key: `${sensor_id_std}:${standard_data}`
     */
    const getStdCorrection = (row: RawDataRow): { value: number; hasData: boolean } => {
        if (!row.sensor_id_std) return { value: 0, hasData: false };
        const key = `${row.sensor_id_std}:${row.standard_data}`;
        const hasData = correctionMap.has(key);
        return { value: correctionMap.get(key) ?? 0, hasData };
    };

    const computeRowQC = (row: RawDataRow) => {
        const { value: stdCorrection, hasData: hasCertData } = getStdCorrection(row);

        // Exact floating point math before rounding
        const rawStdCorrected = row.standard_data + stdCorrection;

        // Convert std_corrected to UUT unit when units differ
        // e.g. STD in hPa, UUT in inHg → convert hPa→inHg before subtraction
        const unitStd = row.unit_std || '';
        // Fallback: if unit_uut is null in DB, resolve from UUT sensor's graduating_unit
        let unitUut = row.unit_uut || '';
        if (!unitUut && row.sensor_id_uut) {
            const uutSensor = sensors.find((s: any) => s.id === row.sensor_id_uut);
            unitUut = uutSensor?.graduating_unit || uutSensor?.range_capacity_unit || '';
        }
        const hasConversion = unitStd && unitUut && needsConversion(unitStd, unitUut);
        const stdCorrectedInUutUnit = hasConversion
            ? convertUnit(rawStdCorrected, unitStd, unitUut)
            : rawStdCorrected;

        const rawUutCorrection = stdCorrectedInUutUnit - row.uut_data;

        // Round to 3 decimal places (standard for calibration) to match Excel formulas
        const round3 = (num: number) => Math.round((num + Number.EPSILON) * 1000) / 1000;

        return {
            stdCorrection: round3(stdCorrection),
            stdCorrected: round3(stdCorrectedInUutUnit),  // displayed in UUT unit
            stdCorrectedRaw: round3(rawStdCorrected),     // original STD unit (for reference)
            uutCorrection: round3(rawUutCorrection),
            hasCertData,
            hasConversion,
            qc: checkQCResult(rawUutCorrection, activeSensorLimit),
        };
    };

    const failCount = currentData.filter(row => !computeRowQC(row).qc.passed).length;
    const stdSensorId = currentData.length > 0 ? currentData[0].sensor_id_std : null;

    /**
     * Calculate UUT Avg, Correction, and Uncertainty for ALL sensor tabs (bulk)
     * then call onCalculateSaved to update the certificate table.
     */
    const handleSaveToTable = async () => {
        if (sensorKeys.length === 0) return;
        setIsSavingToTable(true);
        try {
            const updates: Array<{ sensorId: number | string, table: any[] }> = [];

            for (const key of sensorKeys) {
                const groupData = groupedData[key] || [];
                if (groupData.length === 0) continue;

                const sensorId = key === 'unknown' ? null : Number(key);
                const uutSensor = sensorId ? sensors.find((s: any) => s.id === sensorId) : null;

                // Find standard cert for this sensor group via correctionMap data
                const stdSensorId = groupData[0]?.sensor_id_std;
                const standardCertRecord = stdSensorId
                    ? standardCerts.find((c: any) => c.sensor_id === stdSensorId)
                    : null;

                const uutAvg = groupData.reduce((sum, r) => sum + r.uut_data, 0) / groupData.length;

                // Compute average correction from existing correctionMap
                let correctionAvg = 0;
                if (correctionMap.size > 0) {
                    const corrections = groupData.map(row => {
                        const { uutCorrection } = computeRowQC(row);
                        return uutCorrection;
                    });
                    correctionAvg = corrections.reduce((sum, c) => sum + c, 0) / corrections.length;
                }

                // Get uncertainty from calculateCalibrationResult
                const isAnalog = (instruments.find(i => i.id === certificateInstrumentId)?.instrument_type_id ?? 1) === 2;
                const { uncertainty } = calculateCalibrationResult({
                    currentData: groupData,
                    uutSensor,
                    standardCertRecord,
                    isAnalog
                });

                // Format as standard table structure
                const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
                const newTable = [{
                    title: 'Hasil Kalibrasi / Calibration Result',
                    headers: ['Penunjukan Alat / Instrument Reading', 'Koreksi / Correction', 'Ketidakpastian / Uncertainty'],
                    rows: [{
                        key: String(round4(uutAvg)),
                        unit: String(round4(correctionAvg)),
                        value: String(round4(uncertainty)),
                        extraValues: []
                    }]
                }];

                updates.push({ sensorId: key === 'unknown' ? 'unknown' : Number(key), table: newTable });
            }

            if (onCalculateSaved && updates.length > 0) {
                await onCalculateSaved(updates);
            }
        } catch (err: any) {
            console.error('Error calculating table bulk:', err);
        } finally {
            setIsSavingToTable(false);
        }
    };

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
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Certificate: <span className="font-mono font-medium">{title}</span>
                        </p>
                        {/* DEBUG: Unit values from DB */}
                        {currentData.length > 0 && (() => {
                            const r0 = currentData[0];
                            const r0UutSensor = r0.sensor_id_uut ? sensors.find((s: any) => s.id === r0.sensor_id_uut) : null;
                            const resolvedUut = r0.unit_uut || r0UutSensor?.graduating_unit || r0UutSensor?.range_capacity_unit || 'EMPTY';
                            return (
                                <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded px-3 py-1.5 text-[10px] font-mono text-gray-700">
                                    <strong>🐛 DEBUG (row[0]):</strong>{' '}
                                    unit_uut_db=<strong>{JSON.stringify(r0.unit_uut)}</strong>{' | '}
                                    unit_std_db=<strong>{JSON.stringify(r0.unit_std)}</strong>{' | '}
                                    sensor_id_uut=<strong>{r0.sensor_id_uut ?? 'null'}</strong>{' | '}
                                    sensor.grad_unit=<strong>{r0UutSensor?.graduating_unit ?? 'null'}</strong>{' | '}
                                    resolvedUut=<strong>{resolvedUut}</strong>{' | '}
                                    needsConv={String(r0.unit_std && resolvedUut !== 'EMPTY' ? needsConversion(r0.unit_std!, resolvedUut) : false)}
                                </div>
                            );
                        })()}
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
                    ) : data.length === 0 ? (
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
                                    {/* Stats row */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b border-gray-100 shrink-0">
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
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <div className="text-[10px] text-blue-600 font-semibold uppercase">Koreksi Std (DB)</div>
                                            <div className="text-sm font-bold text-blue-900">
                                                {correctionLoading
                                                    ? <span className="text-xs italic animate-pulse">Menghitung...</span>
                                                    : stdSensorId
                                                        ? <span className="text-green-700 text-xs">hitung_koreksi() ✓</span>
                                                        : <span className="text-gray-400 text-xs">–</span>}
                                            </div>
                                        </div>
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
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-blue-900/30">
                                                        Koreksi Std
                                                        <span className="text-[9px] block opacity-70 font-normal normal-case">hitung_koreksi()</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-blue-900/20">
                                                        Std Terkoreksi
                                                        <span className="text-[9px] block opacity-70 font-normal normal-case">std + koreksi</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">UUT Reading</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                                                        Koreksi UUT
                                                        <span className="text-[9px] block opacity-70 font-normal normal-case">std_kor − uut</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Batas WMO</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase w-20">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentData.length > 0 ? currentData.map((row, index) => {
                                                    const { stdCorrection, stdCorrected, uutCorrection, hasCertData, qc } = computeRowQC(row);
                                                    const isFail = !qc.passed;
                                                    return (
                                                        <tr key={row.id} className={`${isFail ? 'bg-pink-50 hover:bg-pink-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">{index + 1}</td>
                                                            <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                                                                {new Date(row.timestamp).toLocaleString('id-ID')}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm font-medium text-gray-700">{row.standard_data}</td>
                                                            <td className="px-4 py-2 text-sm font-medium bg-blue-50/50">
                                                                {correctionLoading
                                                                    ? <span className="text-gray-300 text-xs">...</span>
                                                                    : hasCertData
                                                                        ? <span className="text-blue-700">{stdCorrection > 0 ? '+' : ''}{stdCorrection}</span>
                                                                        : <span className="text-gray-400 text-[10px] italic">tidak ada</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm font-bold text-blue-900 bg-blue-50/30">
                                                                {hasCertData ? stdCorrected : <span className="text-gray-400 text-xs">= {row.standard_data}</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm font-medium text-gray-700">{row.uut_data}</td>
                                                            <td className={`px-4 py-2 text-sm font-bold ${isFail ? 'text-red-600' : 'text-green-600'}`}>
                                                                {uutCorrection > 0 ? '+' : ''}{uutCorrection}
                                                            </td>
                                                            <td className="px-4 py-2 text-xs text-gray-500">{qc.limitStr}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                {isFail
                                                                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">FAIL</span>
                                                                    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">PASS</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan={9} className="px-6 py-10 text-center text-gray-400 italic">
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
                        {currentData.length > 0 && (
                            <button
                                onClick={handleSaveToTable}
                                disabled={isSavingToTable}
                                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                                    isSavingToTable
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-sm'
                                }`}
                            >
                                {isSavingToTable ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Hitung & Input ke Tabel Sertifikat</span>
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
