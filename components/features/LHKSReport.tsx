
import React, { useRef, useEffect, useState } from 'react';
import { Certificate, Instrument, Sensor, Station, CertStandard } from '../../lib/supabase';
import { fetchQCLimitForSensor, checkQCResult, QCLimit } from '../../lib/qc-utils';
import { convertUnit, needsConversion } from '../../lib/unitConversion';
import bmkgLogo from '../../app/bmkg.png';

// Define RawDataRow interface locally if not exported, or match what's used in QCDataModal
interface RawDataRow {
    id: number;
    created_at: string;
    timestamp: string;
    standard_data: number;
    uut_data: number;
    session_id: string;
    sensor_id_uut?: number;
    sensor_id_std?: number;
    std_correction?: number;
    std_corrected?: number;
    uut_correction?: number;
    sheet_name?: string;
    unit_std?: string;
    unit_uut?: string;
}

interface LHKSReportProps {
    isOpen: boolean;
    onClose: () => void;
    certificate: Certificate;
    owner: Station | null; // Station or Owner info
    instrument: Instrument | null;
    sensors: Sensor[];
    rawData: RawDataRow[];
    standardCerts: CertStandard[];
    calibrationDate?: string;
    calibrationLocation?: string;
    environmentConditions?: { temperature?: string; humidity?: string; pressure?: string };
    sessionResults?: any[]; // results array from the certificate (for per-sensor dates/locations)
    allInstruments?: Instrument[];
    allSensors?: Sensor[];
    instrumentNames?: any[];
}

const LHKSReport: React.FC<LHKSReportProps> = ({
    isOpen,
    onClose,
    certificate,
    owner,
    instrument,
    sensors,
    rawData,
    standardCerts,
    calibrationDate,
    calibrationLocation,
    environmentConditions,
    sessionResults,
    allInstruments,
    allSensors,
    instrumentNames,
}) => {
    const printRef = useRef<HTMLDivElement>(null);

    // Fetch QC limits for all unique sensor IDs present in rawData
    const [qcLimits, setQcLimits] = useState<Record<string, QCLimit | null>>({});

    useEffect(() => {
        if (!isOpen || rawData.length === 0) return;

        const uniqueSensorIds = Array.from(
            new Set(rawData.map(r => r.sensor_id_uut).filter((id): id is number => !!id))
        );

        Promise.all(
            uniqueSensorIds.map(async id => {
                const limit = await fetchQCLimitForSensor(id);
                return [String(id), limit] as [string, QCLimit | null];
            })
        ).then(results => {
            const map: Record<string, QCLimit | null> = {};
            results.forEach(([key, limit]) => { map[key] = limit; });
            setQcLimits(map);
        });
    }, [isOpen, rawData]);

    if (!isOpen) return null;

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload();
        }
    };

    // Helper: Group Raw Data by Sensor
    const groupedData: Record<string, RawDataRow[]> = {};
    rawData.forEach(row => {
        const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown';
        if (!groupedData[key]) groupedData[key] = [];
        groupedData[key].push(row);
    });

    // Sort each group by timestamp
    Object.keys(groupedData).forEach(key => {
        groupedData[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    // Helper: Sample Data (Top 15 + Bottom 15)
    const getSampledData = (rows: RawDataRow[]) => {
        if (!rows || rows.length <= 30) return rows;
        return [...rows.slice(0, 15), ...rows.slice(-15)];
    };

    // Get sensor display name — prioritize sheet_name from raw_data (reflects Excel tab name like "Barometer", "Termometer")
    const getSensorDisplayName = (sensor: Sensor): string => {
        const sensorKey = String(sensor.id);
        const rows = groupedData[sensorKey];

        // 1. sheet_name stored in raw data rows (e.g. "Sensor Suhu", "Barometer")
        if (rows && rows.length > 0) {
            const sheetName = rows[0].sheet_name;
            if (sheetName && !/^\d+$/.test(String(sheetName).trim())) {
                return sheetName;
            }
        }

        // 2. sensor.type if it's not purely numeric
        if (sensor.type && !/^\d+$/.test(String(sensor.type).trim())) {
            return sensor.type;
        }

        // 3. sensor.name if it's not purely numeric
        if (sensor.name && !/^\d+$/.test(String(sensor.name).trim())) {
            return sensor.name;
        }

        return `Sensor #${sensor.id}`;
    };

    // Try to get calibration date per sensor from rawData (first timestamp)
    const getSensorCalDate = (sensor: Sensor): string => {
        const sensorRows = rawData.filter(r => r.sensor_id_uut === sensor.id);
        if (sensorRows.length > 0) {
            const sorted = [...sensorRows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return new Date(sorted[0].timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        if (calibrationDate) {
            return new Date(calibrationDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '-';
    };

    // Get the QC limit label for a sensor
    const getQcLimitLabel = (sensorId: number): string => {
        const limit = qcLimits[String(sensorId)];
        if (!limit) return '-';
        return `± ${limit.rawLimit} ${limit.unit}`;
    };

    /**
     * Compute kondisi lingkungan in format "(mean ± half_range) unit"
     * Sumber: data parameter alat standar dari raw data
     * - Untuk "suhu": ambil data raw dari sensor yang sheet_name-nya mengandung kata suhu/temp/termometer
     * - Untuk "kelembaban": sheet_name mengandung kelembaban/hum/hygro
     * nilai yang dipakai adalah std_corrected (bacaan standar terkoreksi)
     * Rumus: mean = (max+min)/2, half_range = max - mean = (max-min)/2
     * Tampil: "(mean ± half_range) unit"
     */
    const computeEnvCondition = (type: 'suhu' | 'kelembaban'): string => {
        const keywords = type === 'suhu'
            ? ['suhu', 'temp', 'termometer', 'temperature', 'thermo']
            : ['kelembab', 'hum', 'hygro', 'rh'];

        // Find rows from sensor sheets matching the env type
        const matchedRows = rawData.filter(r => {
            const name = (r.sheet_name || '').toLowerCase();
            return keywords.some(k => name.includes(k));
        });

        if (matchedRows.length === 0) return '-';

        const values = matchedRows
            .map(r => r.std_corrected ?? (r.standard_data + (r.std_correction ?? 0)))
            .filter(v => !isNaN(v));

        if (values.length === 0) return '-';

        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const mean = (minV + maxV) / 2;
        const halfRange = maxV - mean;

        const unit = type === 'suhu' ? '°C' : '%';
        return `(${mean.toFixed(1)} ± ${halfRange.toFixed(1)}) ${unit}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Preview LHKS</h3>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">
                            Close
                        </button>
                        <button onClick={handlePrint} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Print
                        </button>
                    </div>
                </div>

                {/* Legend */}
                <div className="px-4 py-2 border-b border-gray-100 bg-white flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                    <span className="font-semibold">Keterangan warna baris:</span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-4 rounded bg-white border border-gray-300"></span>
                        Nilai koreksi ≤ batas keberterimaan WMO (OK)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-4 rounded bg-pink-200 border border-pink-300"></span>
                        Nilai koreksi melebihi batas WMO (perlu perhatian)
                    </span>
                    {Object.keys(qcLimits).length === 0 && rawData.length > 0 && (
                        <span className="text-yellow-600">⚠ Memuat batas QC dari Master QC...</span>
                    )}
                </div>

                {/* Preview Content (Scrollable) */}
                <div className="flex-1 overflow-auto p-8 bg-gray-100">
                    <div ref={printRef} className="bg-white p-[10mm] shadow-lg max-w-[210mm] mx-auto min-h-[297mm] text-black font-serif text-[9.5pt] leading-snug">
                        <style>{`
                            @media print {
                                @page { size: A4; margin: 10mm; }
                                body { 
                                    background: white; 
                                    -webkit-print-color-adjust: exact; 
                                    print-color-adjust: exact; 
                                    font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                                    font-size: 9.5pt;
                                    line-height: 1.375;
                                    color: black;
                                }
                                .page-break { page-break-before: always; }
                                .no-break { page-break-inside: avoid; break-inside: avoid; }
                                .row-exceed { background-color: #fce7f3 !important; }
                                
                                * {
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                }
                            }
                        `}</style>

                        {/* --- PAGE 1 --- */}
                        <div className="no-break">
                            {/* Header */}
                            <div className="flex items-center border-b-2 border-black pb-3 mb-4">
                                <div className="w-20 h-20 flex-shrink-0 mr-4">
                                    <img src={bmkgLogo.src} alt="BMKG" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center flex-1">
                                    <div className="font-bold text-[12pt]">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</div>
                                    <div className="font-bold text-[11pt]">LABORATORIUM KALIBRASI BMKG</div>
                                </div>
                            </div>

                            <h3 className="text-center font-bold text-[11pt] mb-4 underline">LAPORAN HASIL KALIBRASI SEMENTARA</h3>

                            <div className="mb-3">
                                <p><span className="font-bold w-28 inline-block">No. Order</span><span>: {certificate.no_order}</span></p>
                            </div>

                            {/* IDENTITAS ALAT */}
                            <div className="mb-5">
                                <h4 className="font-bold underline mb-1">IDENTITAS ALAT / <span className="italic font-normal">Instrument Identification</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none align-top" style={{ width: '44%' }}>Nomor Kalibrasi / <span className="italic">Calibration Number</span></td>
                                            <td className="border-none align-top w-2">:</td>
                                            <td className="border-none align-top">{certificate.no_certificate}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top">Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{instrument?.name}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top">Pabrik Pembuat / <span className="italic">Manufacturer</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{instrument?.manufacturer}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top">Tipe / <span className="italic">Type</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{instrument?.type}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top">Nomor Seri / <span className="italic">Serial Number</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{instrument?.serial_number}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top pt-1">Resolusi / <span className="italic">Resolution</span></td>
                                            <td className="border-none align-top pt-1"></td>
                                            <td className="border-none align-top pt-1"></td>
                                        </tr>
                                        {/* Per-sensor resolution rows (indented) */}
                                        {sensors.filter(s => !s.is_standard).map(s => (
                                            <tr key={`res-${s.id}`}>
                                                <td className="border-none align-top pl-6">{getSensorDisplayName(s)}</td>
                                                <td className="border-none align-top">:</td>
                                                <td className="border-none align-top">{s.graduating} {s.graduating_unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* IDENTITAS PEMILIK */}
                            <div className="mb-5">
                                <h4 className="font-bold underline mb-1">IDENTITAS PEMILIK / <span className="italic font-normal">Owner's Identification</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none align-top" style={{ width: '44%' }}>Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top w-2">:</td>
                                            <td className="border-none align-top">{owner?.name || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none align-top">Alamat / <span className="italic">Address</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{owner?.address || '-'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* PROSES KALIBRASI */}
                            <div className="mb-5">
                                <h4 className="font-bold underline mb-1">PROSES KALIBRASI / <span className="italic font-normal">Calibration Process</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        {/* Rentang Kalibrasi header row */}
                                        <tr>
                                            <td className="border-none align-top" style={{ width: '44%' }}>Rentang Kalibrasi / <span className="italic">calibration range</span></td>
                                            <td className="border-none align-top w-2"></td>
                                            <td className="border-none align-top"></td>
                                        </tr>
                                        {/* Per-sensor range rows (indented) - computed from Min~Max of std_corrected */}
                                        {sensors.filter(s => !s.is_standard).map(s => {
                                            // Compute actual range from corrected standard readings in raw data
                                            const sensorRows = rawData.filter(r => r.sensor_id_uut === s.id);
                                            const stdCorrectedVals = sensorRows
                                                .map(r => r.std_corrected ?? (r.standard_data + (r.std_correction ?? 0)))
                                                .filter(v => !isNaN(v));

                                            let rangeDisplay = '-';
                                            if (stdCorrectedVals.length > 0) {
                                                const minVal = Math.min(...stdCorrectedVals);
                                                const maxVal = Math.max(...stdCorrectedVals);
                                                // Use unit from raw data (unit_std) or sensor graduating_unit
                                                const unit = sensorRows[0]?.unit_std || s.graduating_unit || s.range_capacity_unit || '';
                                                rangeDisplay = `${minVal.toFixed(2)} ~ ${maxVal.toFixed(2)}${unit ? ' ' + unit : ''}`;
                                            } else {
                                                // Fallback: sensor.range_capacity if no raw data
                                                const rawRange = s.range_capacity ? String(s.range_capacity).trim() : '';
                                                const rawUnit = s.range_capacity_unit ? String(s.range_capacity_unit).trim() : '';
                                                if (rawRange && !/^\d+$/.test(rawRange)) {
                                                    rangeDisplay = `${rawRange}${rawUnit ? ' ' + rawUnit : ''}`;
                                                }
                                            }

                                            return (
                                                <tr key={`range-${s.id}`}>
                                                    <td className="border-none align-top pl-6">{getSensorDisplayName(s)}</td>
                                                    <td className="border-none align-top">:</td>
                                                    <td className="border-none align-top">{rangeDisplay}</td>
                                                </tr>
                                            );
                                        })}

                                        {/* Spacer */}
                                        <tr><td colSpan={3} className="border-none py-1"></td></tr>

                                        {/* Tanggal header row */}
                                        <tr>
                                            <td className="border-none align-top">Tanggal / <span className="italic">Date</span></td>
                                            <td className="border-none align-top"></td>
                                            <td className="border-none align-top"></td>
                                        </tr>
                                        {/* Per-sensor date rows (indented) */}
                                        {sensors.filter(s => !s.is_standard).map(s => (
                                            <tr key={`date-${s.id}`}>
                                                <td className="border-none align-top pl-6">{getSensorDisplayName(s)}</td>
                                                <td className="border-none align-top">:</td>
                                                <td className="border-none align-top">{getSensorCalDate(s)}</td>
                                            </tr>
                                        ))}

                                        {/* Spacer */}
                                        <tr><td colSpan={3} className="border-none py-0.5"></td></tr>

                                        {/* Tempat / Place */}
                                        <tr>
                                            <td className="border-none align-top">Tempat / <span className="italic">Place</span></td>
                                            <td className="border-none align-top">:</td>
                                            <td className="border-none align-top">{calibrationLocation || owner?.name || '-'}</td>
                                        </tr>

                                        {/* Spacer */}
                                        <tr><td colSpan={3} className="border-none py-0.5"></td></tr>

                                        {/* Kondisi Ruang */}
                                        <tr>
                                            <td className="border-none align-top text-blue-700 italic">Kondisi Ruang / <span className="italic">room condition</span></td>
                                            <td className="border-none"></td>
                                            <td className="border-none"></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Kondisi Ruang - computed from raw data */}
                                {(() => {
                                    // Compute from raw data first (preferred)
                                    const computedTemp = computeEnvCondition('suhu');
                                    const computedHum = computeEnvCondition('kelembaban');

                                    // Fallback: sessionResults.environment or environmentConditions
                                    const globalTemp = environmentConditions?.temperature;
                                    const globalHum = environmentConditions?.humidity;
                                    const allEnvs = Array.isArray(sessionResults)
                                        ? sessionResults.flatMap((r: any) => r.environment || [])
                                        : [];
                                    const fallbackTemp = allEnvs.find((e: any) =>
                                        e.key?.toLowerCase().includes('suhu') || e.key?.toLowerCase().includes('temp')
                                    )?.value || globalTemp;
                                    const fallbackHum = allEnvs.find((e: any) =>
                                        e.key?.toLowerCase().includes('kelembab') || e.key?.toLowerCase().includes('hum') || e.key?.toLowerCase().includes('rh')
                                    )?.value || globalHum;

                                    const tempDisplay = computedTemp !== '-' ? computedTemp : (fallbackTemp || '-');
                                    const humDisplay = computedHum !== '-' ? computedHum : (fallbackHum || '-');

                                    if (tempDisplay === '-' && humDisplay === '-') return null;

                                    return (
                                        <table className="w-full border-none text-left mt-1">
                                            <thead>
                                                <tr>
                                                    <td className="border-none" style={{ width: '44%' }}></td>
                                                    <td className="border-none w-2"></td>
                                                    <td className="border-none font-semibold" style={{ width: '28%' }}>Suhu</td>
                                                    <td className="border-none font-semibold" style={{ width: '28%' }}>Kelembaban</td>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="border-none align-top pl-6">Selama Kalibrasi</td>
                                                    <td className="border-none align-top">:</td>
                                                    <td className="border-none align-top">{tempDisplay}</td>
                                                    <td className="border-none align-top">{humDisplay}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    );
                                })()}

                            </div>
                            {/* Page 1 page number */}
                            <div className="text-right text-xs text-red-600 mt-4">Halaman 1 dari 2</div>
                        </div>

                        <div className="page-break"></div>

                        {/* --- PAGE 2: IDENTITAS STANDAR & KETELUSURAN --- */}
                        <div className="no-break mb-6">
                            {/* Page 2 Header (repeated for print) */}
                            <div className="flex items-center border-b-2 border-black pb-3 mb-4">
                                <div className="w-20 h-20 flex-shrink-0 mr-4">
                                    <img src={bmkgLogo.src} alt="BMKG" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center flex-1">
                                    <div className="font-bold text-[12pt]">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</div>
                                    <div className="font-bold text-[11pt]">LABORATORIUM KALIBRASI BMKG</div>
                                </div>
                            </div>

                            {/* IDENTITAS STANDAR */}
                            <div className="mb-5">
                                <h4 className="font-bold underline mb-1">IDENTITAS STANDAR / <span className="italic font-normal">Standard Identification</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none align-top" style={{ width: '44%' }}>Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top w-2"></td>
                                            <td className="border-none align-top"></td>
                                        </tr>
                                        {sensors.filter(s => !s.is_standard).map(s => {
                                            // Find standard sensor used for this UUT sensor from raw data
                                            const stdSensorId = rawData.find(r => r.sensor_id_uut === s.id)?.sensor_id_std;

                                            const stdSensor = allSensors?.find(x => x.id === stdSensorId);
                                            const stdInstrument = allInstruments?.find(x => x.id === stdSensor?.instrument_id);
                                            const matchedStdCert = standardCerts.find(sc => sc.sensor_id === stdSensorId) ?? standardCerts[0];

                                            // Build display string
                                            let displayStr = '-';
                                            if (stdSensor || stdInstrument || matchedStdCert) {
                                                // Try to resolve a good name for the standard sensor
                                                let stdName = stdSensor?.name;
                                                // If name is numeric id, try lookup or instrument name
                                                if (!stdName || /^\d+$/.test(stdName)) {
                                                    stdName = instrumentNames?.find(n => n.id === stdSensor?.sensor_name_id)?.name;
                                                }
                                                if (!stdName || /^\d+$/.test(stdName)) {
                                                    stdName = stdSensor?.type;
                                                }
                                                if (!stdName || /^\d+$/.test(stdName)) {
                                                    stdName = stdInstrument?.name;
                                                }

                                                const manufacturer = stdSensor?.manufacturer || stdInstrument?.manufacturer;
                                                const type = stdSensor?.type || stdInstrument?.type;
                                                const serial = stdSensor?.serial_number || stdInstrument?.serial_number;

                                                const parts = [
                                                    stdName,
                                                    manufacturer,
                                                    type,
                                                    serial
                                                ].filter(p => p && !/^\d+$/.test(String(p).trim()) || typeof p === 'string' && p.trim() !== '');

                                                if (parts.length > 0) {
                                                    displayStr = parts.join('; ');
                                                } else if (matchedStdCert) {
                                                    displayStr = matchedStdCert.no_certificate;
                                                }
                                            }

                                            return (
                                                <tr key={`std-${s.id}`}>
                                                    <td className="border-none align-top pl-6">{getSensorDisplayName(s)}</td>
                                                    <td className="border-none align-top">:</td>
                                                    <td className="border-none align-top">{displayStr}</td>
                                                </tr>
                                            );
                                        })}
                                        {standardCerts.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="border-none italic text-gray-400 pl-6">Tidak ada data standar tersedia</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* KETELUSURAN */}
                            <div className="mb-5">
                                <h4 className="font-bold underline mb-1">KETELUSURAN / <span className="italic font-normal">Traceability</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        {sensors.filter(s => !s.is_standard).map(s => {
                                            // Lookup traceable org from std cert or fallback
                                            const matchedStd = standardCerts.find(sc => (sc as any).sensor_id === s.id);
                                            const traceOrg = (matchedStd as any)?.traceable_to
                                                || (matchedStd as any)?.traceable_organization
                                                || 'Laboratorium Kalibrasi BMKG (LK-095-IDN)';
                                            return (
                                                <tr key={`trace-${s.id}`}>
                                                    <td className="border-none align-top" style={{ width: '44%' }}>{getSensorDisplayName(s)}</td>
                                                    <td className="border-none align-top w-2">:</td>
                                                    <td className="border-none align-top">{traceOrg}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Page 2 page number */}
                            <div className="text-right text-xs text-red-600 mt-4">Halaman 2 dari 2</div>
                        </div>

                        <div className="page-break"></div>

                        {/* --- DATA PAGES: one section per sensor --- */}
                        {Object.keys(groupedData).map((sensorKey, pageIdx) => {
                            const data = groupedData[sensorKey];
                            const sampled = getSampledData(data);

                            const sensor = sensors.find(s => String(s.id) === sensorKey);
                            const sensorName = sensor ? getSensorDisplayName(sensor) : (data[0]?.sheet_name || `Sensor #${sensorKey}`);

                            // Get the QC limit for this sensor from master_qc
                            const qcLimit = sensorKey !== 'unknown' ? (qcLimits[sensorKey] ?? null) : null;

                            // Calculate statistics
                            // When units differ: STD data (hPa) is converted → UUT unit (inHg)
                            // so all values and corrections are in UUT's unit
                            const totalRows = data.length;
                            // Resolve std sensor early so we can use it for unit fallback
                            const stdSensorId = data[0]?.sensor_id_std;
                            const stdSensor = allSensors?.find(x => x.id === stdSensorId);

                            const rowUnitStd = data[0]?.unit_std || stdSensor?.graduating_unit || stdSensor?.range_capacity_unit || '';
                            // UUT unit: from DB, fallback to UUT sensor's graduating_unit so UUT is always the display reference
                            const rowUnitUut = data[0]?.unit_uut || sensor?.graduating_unit || sensor?.range_capacity_unit || rowUnitStd;
                            const hasUnitMismatch = rowUnitStd && rowUnitUut && needsConversion(rowUnitStd, rowUnitUut);

                            // Helper: get std_corrected converted to UUT unit (when mismatch)
                            const getStdConverted = (row: typeof data[0]) => {
                                const stdCorr = row.std_corrected ?? (row.standard_data + (row.std_correction ?? 0));
                                if (!hasUnitMismatch) return stdCorr;
                                return convertUnit(stdCorr, row.unit_std || rowUnitStd, row.unit_uut || rowUnitUut);
                            };

                            const avgStdCorrected = data.reduce((sum, row) => sum + getStdConverted(row), 0) / (totalRows || 1);
                            const avgUutData = data.reduce((sum, row) => sum + row.uut_data, 0) / (totalRows || 1);
                            const avgCorrection = data.reduce((sum, row) => {
                                return sum + (getStdConverted(row) - row.uut_data);
                            }, 0) / (totalRows || 1);

                            const varianceCorrection = data.reduce((sum, row) => {
                                const corr = getStdConverted(row) - row.uut_data;
                                return sum + Math.pow(corr - avgCorrection, 2);
                            }, 0) / (totalRows - 1 || 1);
                            const stdDevCorrection = Math.sqrt(varianceCorrection);

                            // Lookup Standard Instrument details (stdSensorId and stdSensor resolved above)
                            const stdInstrument = allInstruments?.find(x => x.id === stdSensor?.instrument_id);
                            const matchedStdCert = standardCerts.find(sc => sc.sensor_id === stdSensorId) ?? standardCerts[0];

                            // Standard names
                            let stdNameStr = '-';
                            if (stdSensor || stdInstrument || matchedStdCert) {
                                let stdName = stdSensor?.name;
                                if (!stdName || /^\d+$/.test(stdName)) stdName = instrumentNames?.find(n => n.id === stdSensor?.sensor_name_id)?.name;
                                if (!stdName || /^\d+$/.test(stdName)) stdName = stdSensor?.type;
                                if (!stdName || /^\d+$/.test(stdName)) stdName = stdInstrument?.name;
                                if (!stdName || /^\d+$/.test(stdName)) stdName = (matchedStdCert as any)?.sensor_name;
                                stdNameStr = stdName || '-';
                            }
                            const stdMerkTipeSN = [
                                stdSensor?.manufacturer || stdInstrument?.manufacturer,
                                stdSensor?.type || stdInstrument?.type,
                                stdSensor?.serial_number || stdInstrument?.serial_number
                            ].filter(p => p && !/^\d+$/.test(String(p).trim()) || typeof p === 'string' && p.trim() !== '').join(' / ') || '-';
                            const stdDrift = matchedStdCert?.drift ? `${matchedStdCert.drift} ${qcLimit?.unit || ''}` : '-';

                            // UUT details — Daerah Ukur from Min~Max of std_corrected (actual calibration range)
                            const stdCorrectedVals = data
                                .map((r: typeof data[0]) => r.std_corrected ?? (r.standard_data + (r.std_correction ?? 0)))
                                .filter((v: number) => !isNaN(v));
                            let rangeDisplay: string;
                            if (stdCorrectedVals.length > 0) {
                                const minV = Math.min(...stdCorrectedVals);
                                const maxV = Math.max(...stdCorrectedVals);
                                const rangeUnit = data[0]?.unit_std || sensor?.graduating_unit || sensor?.range_capacity_unit || '';
                                rangeDisplay = `${minV.toFixed(2)} ~ ${maxV.toFixed(2)}${rangeUnit ? ' ' + rangeUnit : ''}`;
                            } else {
                                const rawRange = sensor?.range_capacity ? String(sensor.range_capacity).trim() : '';
                                const rawUnit = sensor?.range_capacity_unit ? String(sensor.range_capacity_unit).trim() : '';
                                const isRangeValid = rawRange && !/^\d+$/.test(rawRange);
                                rangeDisplay = isRangeValid ? `${rawRange} ${rawUnit}`.trim() : (qcLimit ? `± ${qcLimit.rawLimit} ${qcLimit.unit}` : '-');
                            }

                            // Environment details
                            const globalTemp = environmentConditions?.temperature || '-';
                            const globalHum = environmentConditions?.humidity || '-';
                            const sessionRes = Array.isArray(sessionResults) ? sessionResults.find((r: any) => r.sensorId === (sensor?.id ?? Number(sensorKey)) || r.sensor_id === (sensor?.id ?? Number(sensorKey))) : null;
                            const envs = sessionRes?.environment || [];
                            const temp = envs.find((e: any) => e.key?.toLowerCase().includes('suhu') || e.key?.toLowerCase().includes('temp'))?.value || globalTemp;
                            const hum = envs.find((e: any) => e.key?.toLowerCase().includes('kelembaban') || e.key?.toLowerCase().includes('humidity') || e.key?.toLowerCase().includes('rh'))?.value || globalHum;
                            // For lack of start/end, just put same value in both columns
                            const tempAwal = temp, tempAkhir = temp;
                            const humAwal = hum, humAkhir = hum;

                            // Date
                            let targetDateStr = '-';
                            if (data.length > 0) {
                                const d = new Date(data[0].timestamp);
                                targetDateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            }

                            // All column values displayed in UUT unit (UUT is the reference for the report)
                            const unitDisplay = rowUnitUut || qcLimit?.unit || sensor?.graduating_unit || sensor?.range_capacity_unit || '';

                            return (
                                <div key={sensorKey} className={`no-break mb-8 w-full ${pageIdx > 0 ? 'page-break' : ''}`}>
                                    <div className="text-center font-bold mb-3 text-sm">
                                        Tabel {(pageIdx + 2).toString().padStart(2, '0')}. Data Mentah Hasil Kalibrasi {sensorName.toUpperCase()}
                                    </div>

                                    {/* Header Section Box */}
                                    <table className="w-full text-xs border-collapse border border-black mb-1 table-fixed">
                                        <tbody>
                                            <tr>
                                                <td className="w-1/2 p-0 align-top border-r border-black">
                                                    <table className="w-full border-none border-collapse text-left">
                                                        <tbody>
                                                            <tr>
                                                                <td className="border-none w-32 px-1">No. Order/Identifikasi</td>
                                                                <td className="border-none px-1">: {certificate.no_order} / {certificate.no_certificate}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none px-1">Nama Alat</td>
                                                                <td className="border-none px-1">: {sensorName}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none px-1">Daerah Ukur</td>
                                                                <td className="border-none px-1">: {rangeDisplay}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none px-1">Tanggal Kalibrasi</td>
                                                                <td className="border-none px-1">: {targetDateStr}</td>
                                                            </tr>
                                                            <tr>
                                                                <td colSpan={2} className="border-t border-b border-black text-center relative underline pt-1">
                                                                    Kondisi Ruangan
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td colSpan={2} className="p-0 border-none">
                                                                    <table className="w-full text-left border-none border-collapse bg-transparent">
                                                                        <tbody>
                                                                            <tr className="border-t border-black">
                                                                                <td className="border-none border-r border-black text-left px-1 w-1/3">Temperatur</td>
                                                                                <td className="border-none px-1">{computeEnvCondition('suhu') !== '-' ? computeEnvCondition('suhu') : (temp !== '-' ? temp : '-')}</td>
                                                                            </tr>
                                                                            <tr className="border-t border-black">
                                                                                <td className="border-none border-r border-black text-left px-1">Kelembapan</td>
                                                                                <td className="border-none px-1">{computeEnvCondition('kelembaban') !== '-' ? computeEnvCondition('kelembaban') : (hum !== '-' ? hum : '-')}</td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                                <td className="w-1/2 p-0 align-top">
                                                    <table className="w-full border-none border-collapse text-left">
                                                        <tbody>
                                                            <tr>
                                                                <td colSpan={2} className="px-1 border-b border-black underline">Alat Standar</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none w-28 px-1">Nama Alat</td>
                                                                <td className="border-none px-1">: {stdNameStr}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none px-1">Merk / Tipe / SN</td>
                                                                <td className="border-none px-1">: {stdMerkTipeSN}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="border-none px-1">Drift</td>
                                                                <td className="border-none px-1">: {stdDrift}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Data Table */}
                                    <table className="w-full text-xs border-collapse border border-black text-center">
                                        <thead>
                                            <tr>
                                                <th colSpan={6} className="bg-gray-100 border border-black font-bold text-center uppercase">DATA HASIL KALIBRASI {sensorName}</th>
                                            </tr>
                                            <tr>
                                                <th rowSpan={2} className="border border-black w-10">No</th>
                                                <th colSpan={3} className="border border-black">STANDAR</th>
                                                <th rowSpan={2} className="border border-black leading-tight">Alat yang<br />dikalibrasi</th>
                                                <th rowSpan={2} className="border border-black">Koreksi</th>
                                            </tr>
                                            <tr>
                                                <th className="border border-black">Pembacaan</th>
                                                <th className="border border-black">Koreksi</th>
                                                <th className="border border-black">Terkoreksi</th>
                                            </tr>
                                            <tr>
                                                <th className="border border-black bg-gray-50 italic"></th>
                                                <th className="border border-black bg-gray-50 italic">{unitDisplay}</th>
                                                <th className="border border-black bg-gray-50 italic">{unitDisplay}</th>
                                                <th className="border border-black bg-gray-50 italic">{unitDisplay}</th>
                                                <th className="border border-black bg-gray-50 italic">{unitDisplay}</th>
                                                <th className="border border-black bg-gray-50 italic">{unitDisplay}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sampled.map((row, idx) => {
                                                const stdCorrectionRaw = row.std_correction ?? 0;
                                                const stdCorrectionStr = stdCorrectionRaw === 0 ? 'FALSE' : stdCorrectionRaw.toFixed(4).replace(/\.?0+$/, '');
                                                const stdCorrected = row.std_corrected ?? (row.standard_data + stdCorrectionRaw);

                                                // Convert UUT to std unit if mismatch, then compute koreksi
                                                const stdConverted = getStdConverted(row);
                                                const rawCorrection = stdConverted - row.uut_data;
                                                const qcResult = checkQCResult(rawCorrection, qcLimit);
                                                const isFail = !qcResult.passed;

                                                // Determine original row index to display
                                                let displayIdx = idx + 1;
                                                if (data.length > 30 && idx >= 15) {
                                                    displayIdx = data.length - 30 + idx + 1;
                                                }

                                                return (
                                                    <React.Fragment key={row.id}>
                                                        {data.length > 30 && idx === 15 && (
                                                            <tr>
                                                                <td colSpan={6} className="border border-black text-center italic py-1 bg-gray-50 text-gray-500">
                                                                    ... {data.length - 30} titik data tersembunyi ...
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr className={isFail ? 'bg-pink-100' : ''} style={isFail ? { backgroundColor: '#fce7f3' } : {}}>
                                                            <td className="border border-black px-1">{displayIdx}</td>
                                                            <td className="border border-black px-1">{row.standard_data.toFixed(2)}</td>
                                                            <td className="border border-black px-1">{stdCorrectionStr}</td>
                                                            <td className="border border-black px-1">
                                                                {stdConverted.toFixed(3)}
                                                                {hasUnitMismatch && (
                                                                    <span className="text-[8px] text-gray-400 ml-0.5" title={`Dikonversi dari ${row.unit_std || rowUnitStd} ke ${row.unit_uut || rowUnitUut}`}>*</span>
                                                                )}
                                                            </td>
                                                            <td className="border border-black px-1">{row.uut_data.toFixed(2)}</td>
                                                            <td className={`border border-black px-1 ${isFail ? 'text-red-600 font-bold' : ''}`}>
                                                                {rawCorrection.toFixed(4).replace(/\.?0+$/, '') || '0'}
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })}
                                            {/* Rata-rata */}
                                            <tr>
                                                <td colSpan={3} className="border border-black text-left font-bold px-1 pl-2">Rata-Rata</td>
                                                <td className="border border-black font-bold px-1">{avgStdCorrected.toFixed(3)}</td>
                                                <td className="border border-black font-bold px-1">{avgUutData.toFixed(2)}</td>
                                                <td className="border border-black font-bold px-1">{avgCorrection.toFixed(4).replace(/\.?0+$/, '') || '0'}</td>
                                            </tr>
                                            {/* Standar Deviasi */}
                                            <tr>
                                                <td colSpan={5} className="border border-black text-left font-bold px-1 pl-2">Standar Deviasi</td>
                                                <td className="border border-black px-1">{stdDevCorrection.toFixed(4).replace(/\.?0+$/, '') || '0'}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {!qcLimit && (
                                        <div className="mt-1 text-[10px] text-yellow-600 italic text-right">
                                            * Batas WMO (QC) tidak ditemukan untuk sensor ini.
                                        </div>
                                    )}
                                    {hasUnitMismatch && (
                                        <div className="mt-1 text-[10px] text-gray-500 italic text-right">
                                            * Nilai UUT telah dikonversi dari <strong>{rowUnitUut}</strong> ke <strong>{rowUnitStd}</strong> sebelum penghitungan koreksi.
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default LHKSReport;
