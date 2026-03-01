
import React, { useEffect, useState } from 'react';
import { Instrument, Sensor } from '../../lib/supabase';
import { fetchQCLimitForSensor, checkQCResult, QCLimit } from '../../lib/qc-utils';

interface RawDataRow {
    id: number;
    created_at: string;
    timestamp: string;
    standard_data: number;
    uut_data: number;
    session_id: string;
    sensor_id_uut?: number;
    sensor_id_std?: number;
}

interface QCDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    sessionId?: string;
    certificateId: string; // Passed for context
    sensorName?: string; // Optional context
    instruments?: Instrument[];
    sensors?: Sensor[];
    certificateInstrumentId?: number; // Main UUT Instrument
}

const QCDataModal: React.FC<QCDataModalProps> = ({
    isOpen,
    onClose,
    title,
    sessionId,
    certificateId,
    instruments = [],
    sensors = [],
    certificateInstrumentId
}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<RawDataRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<number | 'unknown'>(0);

    // Per-sensor QC limits fetched from master_qc table
    const [qcLimits, setQcLimits] = useState<Record<string, QCLimit | null>>({});
    const [qcLimitsLoading, setQcLimitsLoading] = useState(false);

    // Group Data by Sensor ID UUT
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

    // Initial Tab Selection
    useEffect(() => {
        if (sensorKeys.length > 0 && activeTab === 0) {
            setActiveTab(sensorKeys[0] === 'unknown' ? 'unknown' : Number(sensorKeys[0]));
        }
    }, [sensorKeys, activeTab]);

    useEffect(() => {
        if (isOpen && sessionId) {
            fetchData(sessionId);
        }
    }, [isOpen, sessionId]);

    // Fetch QC limits from master_qc for all detected sensors
    useEffect(() => {
        const sensorIds = sensorKeys
            .filter(k => k !== 'unknown')
            .map(k => Number(k))
            .filter(id => !isNaN(id));

        if (sensorIds.length === 0) return;

        setQcLimitsLoading(true);
        Promise.all(
            sensorIds.map(async id => {
                const limit = await fetchQCLimitForSensor(id);
                return [String(id), limit] as [string, QCLimit | null];
            })
        ).then(results => {
            const map: Record<string, QCLimit | null> = {};
            results.forEach(([key, limit]) => { map[key] = limit; });
            setQcLimits(map);
        }).finally(() => setQcLimitsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sensorKeys.join(',')]);

    const fetchData = async (sId: string) => {
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

    // Get QC limit for the active sensor tab
    const activeSensorLimit = activeTab !== 'unknown' && activeTab !== 0
        ? qcLimits[String(activeTab)] ?? null
        : null;

    // Active sensor display info
    const activeSensorName = React.useMemo(() => {
        if (activeTab === 'unknown' || activeTab === 0) {
            const inst = instruments.find(i => i.id === certificateInstrumentId);
            return inst?.name || 'Unknown Sensor';
        }
        const sensor = sensors.find(s => s.id === activeTab);
        return sensor ? (sensor.name || sensor.type || `Sensor #${sensor.id}`) : `Sensor #${activeTab}`;
    }, [activeTab, sensors, instruments, certificateInstrumentId]);

    if (!isOpen) return null;

    const currentData = groupedData[String(activeTab)] || [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <svg className="w-6 h-6 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            QC Check - Raw Data Analysis
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Certificate: <span className="font-mono font-medium">{title}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-full"
                    >
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
                            <p className="text-gray-500 font-medium">Fetching 2000+ data points...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center p-8 m-6 bg-red-50 rounded-xl border border-red-200">
                            <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="text-lg font-bold text-red-800 mb-2">Error Loading Data</h4>
                            <p className="text-red-600">{error}</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center p-12 m-6 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500 text-lg">No raw data found for this session.</p>
                            <p className="text-sm text-gray-400 mt-2">Make sure you have uploaded raw data files during creation.</p>
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
                                            const s = sensors.find(sen => sen.id === Number(key));
                                            if (s) tabLabel = s.name || s.type || `Sensor #${key}`;
                                            else tabLabel = `Sensor #${key}`;
                                        }

                                        // Show whether QC limit is loaded for this tab
                                        const hasLimit = key !== 'unknown' && qcLimits[key] !== undefined;
                                        const limitLoaded = qcLimits[key] != null;

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActiveTab(sensorId)}
                                                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${isActive
                                                    ? 'border-[#1e377c] text-[#1e377c] bg-blue-50/50'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <svg className={`w-4 h-4 ${isActive ? 'text-[#1e377c]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                </svg>
                                                {tabLabel}
                                                <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {groupedData[key].length}
                                                </span>
                                                {/* QC limit badge */}
                                                {hasLimit && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${limitLoaded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {limitLoaded ? `±${qcLimits[key]!.rawLimit}` : 'No QC'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Active Tab Content */}
                            <div className="flex-1 overflow-hidden flex flex-col p-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                                    {/* Stats Summary */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-gray-100 bg-white shadow-sm shrink-0">
                                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                            <div className="text-xs text-indigo-600 font-semibold uppercase">Sensor</div>
                                            <div className="text-sm font-bold text-indigo-900 truncate" title={activeSensorName}>{activeSensorName}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${activeSensorLimit ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                                            <div className={`text-xs font-semibold uppercase ${activeSensorLimit ? 'text-green-600' : 'text-yellow-600'}`}>
                                                Batas Koreksi (Master QC)
                                            </div>
                                            <div className={`text-sm font-bold ${activeSensorLimit ? 'text-green-900' : 'text-yellow-800'}`}>
                                                {qcLimitsLoading ? (
                                                    <span className="text-xs italic">Memuat...</span>
                                                ) : activeSensorLimit ? (
                                                    `± ${activeSensorLimit.rawLimit} ${activeSensorLimit.unit}`
                                                ) : (
                                                    <span className="text-xs italic text-yellow-700">Tidak ada di Master QC</span>
                                                )}
                                            </div>
                                            {activeSensorLimit && (
                                                <div className="text-[10px] text-green-600 mt-0.5">{activeSensorLimit.instrumentName}</div>
                                            )}
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div className="text-xs text-gray-600 font-semibold uppercase">Data Points</div>
                                            <div className="text-xl font-bold text-gray-900">{currentData.length}</div>
                                        </div>
                                        {/* Count of failing rows */}
                                        {activeSensorLimit && (
                                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                                <div className="text-xs text-red-600 font-semibold uppercase">Melebihi Batas</div>
                                                <div className="text-xl font-bold text-red-900">
                                                    {currentData.filter(row => {
                                                        const correction = row.standard_data - row.uut_data;
                                                        const result = checkQCResult(correction, activeSensorLimit);
                                                        return !result.passed;
                                                    }).length}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-auto">
                                        <table className="min-w-full divide-y divide-gray-200 relative">
                                            <thead className="bg-[#1e377c] text-white sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider w-16">No</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Timestamp</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Reading Std</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Reading UUT</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider bg-blue-900/30">
                                                        Correction <span className="text-[10px] normal-case opacity-70 block">(Std - UUT)</span>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                                                        Batas WMO
                                                        {activeSensorLimit && (
                                                            <span className="text-[10px] normal-case font-normal opacity-80 block">dari Master QC</span>
                                                        )}
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider w-24">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentData.length > 0 ? (
                                                    currentData.map((row, index) => {
                                                        const rawCorrection = row.standard_data - row.uut_data;
                                                        const qc = checkQCResult(rawCorrection, activeSensorLimit);
                                                        const isFail = !qc.passed;

                                                        return (
                                                            <tr key={row.id} className={`${isFail ? 'bg-pink-50 hover:bg-pink-100' : 'hover:bg-gray-50'} transition-colors border-b border-gray-50`}>
                                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                                                                    {index + 1}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-600">
                                                                    {new Date(row.timestamp).toLocaleString('id-ID')}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {row.standard_data}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {row.uut_data}
                                                                </td>
                                                                <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold ${isFail ? 'text-red-600' : 'text-green-600'} bg-gray-50/50`}>
                                                                    {qc.correction > 0 ? '+' : ''}{qc.correction}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                                                                    {qc.limitStr}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-center">
                                                                    {isFail ? (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                                            FAIL
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                                            PASS
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic">
                                                            No data available for this sensor.
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
                <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div className="text-xs text-gray-500 max-w-xl">
                        <span className="font-semibold text-gray-700">Note:</span> Batas koreksi diambil dari tabel <b>Master QC</b> berdasarkan jenis sensor (instrument_name).
                        Baris merah muda = nilai koreksi melebihi batas keberterimaan WMO.
                        {!activeSensorLimit && (
                            <span className="ml-1 text-yellow-600">⚠ Sensor aktif belum memiliki entri di Master QC.</span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm font-medium rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        Close View
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QCDataModal;
