
import React, { useRef } from 'react';
import { Certificate, Instrument, Sensor, Station, CertStandard } from '../../lib/supabase';
import { normalizeSensorType } from '../../lib/wmo-limits';
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
    environmentConditions
}) => {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // Reload to restore event listeners/React state
        }
    };

    // Helper: Group Raw Data by Sensor
    const groupedData: Record<string, RawDataRow[]> = {};
    rawData.forEach(row => {
        const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown';
        if (!groupedData[key]) groupedData[key] = [];
        groupedData[key].push(row);
    });

    // Helper: Sample Data (Top 15 + Bottom 15)
    const getSampledData = (rows: RawDataRow[]) => {
        if (!rows || rows.length <= 30) return rows;
        return [...rows.slice(0, 15), ...rows.slice(-15)];
    };

    // Helper: Find Standard info used for a sensor
    // This logic might need refinement based on how standards are linked.
    // For now, listing all available standards or trying to match by sensor type/ID.
    const getStandardInfo = (sensorId?: number) => {
        // Logic to find specific standard used for this sensor
        // If generic, return all relevant standards
        return standardCerts;
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

                {/* Preview Content (Scrollable) */}
                <div className="flex-1 overflow-auto p-8 bg-gray-100">
                    <div ref={printRef} className="bg-white p-[10mm] shadow-lg max-w-[210mm] mx-auto min-h-[297mm] text-black font-serif text-[10pt] leading-tight">
                        <style>{`
                            @media print {
                                @page { size: A4; margin: 10mm; }
                                body { background: white; -webkit-print-color-adjust: exact; }
                                .page-break { page-break-before: always; }
                                table { border-collapse: collapse; width: 100%; }
                                th, td { border: 1px solid black; padding: 4px; text-align: center; }
                            }
                        `}</style>

                        {/* --- PAGE 1 --- */}
                        <div className="mb-8">
                            {/* Header */}
                            <div className="flex items-center border-b-2 border-black pb-4 mb-6">
                                <div className="w-20 h-20 relative mr-4">
                                    {/* Logo Placeholder - assuming next/image not working easily in print raw HTML replacement */}
                                    <img src={bmkgLogo.src} alt="BMKG" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center flex-1">
                                    <h1 className="font-bold text-[12pt]">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
                                    <h2 className="font-bold text-[11pt]">LABORATORIUM KALIBRASI BMKG</h2>
                                    <div className="border-t border-black mt-1 pt-1 w-full"></div>
                                </div>
                            </div>

                            <h3 className="text-center font-bold text-[11pt] mb-6 underline">LAPORAN HASIL KALIBRASI SEMENTARA</h3>

                            <div className="mb-4">
                                <p><span className="font-bold w-32 inline-block">No. Order</span>: {certificate.no_order}</p>
                            </div>

                            {/* IDENTITAS ALAT */}
                            <div className="mb-6">
                                <h4 className="font-bold underline mb-2">IDENTITAS ALAT / <span className="italic font-normal">Instrument Identification</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none w-48 align-top">Nomor Kalibrasi / <span className="italic">Calibration Number</span></td>
                                            <td className="border-none align-top">: {certificate.no_certificate}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top">: {instrument?.name}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Pabrik Pembuat / <span className="italic">Manufacturer</span></td>
                                            <td className="border-none align-top">: {instrument?.manufacturer}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Tipe / <span className="italic">Type</span></td>
                                            <td className="border-none align-top">: {instrument?.type}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Nomor Seri / <span className="italic">Serial Number</span></td>
                                            <td className="border-none align-top">: {instrument?.serial_number}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Resolusi / <span className="italic">Resolution</span></td>
                                            <td className="border-none align-top">
                                                {/* Group Resolutions */}
                                                <table className="border-none w-full">
                                                    <tbody>
                                                        {sensors.map(s => (
                                                            <tr key={s.id}>
                                                                <td className="border-none w-32">{s.name || s.type}</td>
                                                                <td className="border-none">: {s.graduating} {s.graduating_unit}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* IDENTITAS PEMILIK */}
                            <div className="mb-6">
                                <h4 className="font-bold underline mb-2">IDENTITAS PEMILIK / <span className="italic font-normal">Owner's Identification</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none w-48 align-top">Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top">: {owner?.name}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Alamat / <span className="italic">Address</span></td>
                                            <td className="border-none align-top">: {owner?.address}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* PROSES KALIBRASI */}
                            <div className="mb-6">
                                <h4 className="font-bold underline mb-2">PROSES KALIBRASI / <span className="italic font-normal">Calibration Process</span></h4>
                                <table className="w-full border-none text-left">
                                    <tbody>
                                        <tr>
                                            <td className="border-none w-48 align-top">Rentang Kalibrasi / <span className="italic">Calibration Range</span></td>
                                            <td className="border-none align-top">
                                                <table className="border-none w-full">
                                                    <tbody>
                                                        {sensors.map(s => (
                                                            <tr key={s.id}>
                                                                <td className="border-none w-32">{s.name || s.type}</td>
                                                                <td className="border-none">: {s.range_capacity} {s.range_capacity_unit}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Tanggal / <span className="italic">Date</span></td>
                                            <td className="border-none align-top">: {calibrationDate ? new Date(calibrationDate).toLocaleDateString('id-ID') : '-'}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Tempat / <span className="italic">Place</span></td>
                                            <td className="border-none align-top">: {calibrationLocation || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td className="border-none w-48 align-top">Kondisi Ruang / <span className="italic">Room Condition</span></td>
                                            <td className="border-none align-top">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>Suhu: {environmentConditions?.temperature || '-'}</div>
                                                    <div>Kelembapan: {environmentConditions?.humidity || '-'}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="page-break"></div>

                        {/* --- PAGE 2 --- */}
                        <div className="mb-8">
                            {/* IDENTITAS STANDAR */}
                            <div className="mb-6">
                                <h4 className="font-bold underline mb-2">IDENTITAS STANDAR / <span className="italic font-normal">Standard Identification</span></h4>
                                <table className="w-full border-none text-left ml-4">
                                    <tbody>
                                        <tr>
                                            <td className="border-none w-32 align-top">Nama / <span className="italic">Name</span></td>
                                            <td className="border-none align-top">
                                                <ul className="list-disc pl-4">
                                                    {standardCerts.map((std, i) => (
                                                        <li key={i}>{std.no_certificate} (Range: {std.range})</li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* KETELUSURAN */}
                            <div className="mb-6">
                                <h4 className="font-bold underline mb-2">KETELUSURAN / <span className="italic font-normal">Traceability</span></h4>
                                <div className="ml-4">
                                    <p>Tertulusur ke Satuan Internasional (SI) melalui:</p>
                                    <ul className="list-disc pl-5 mt-1">
                                        <li>Laboratorium Kalibrasi BMKG (LK-095-IDN)</li>
                                        <li>Lainnya...</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="page-break"></div>

                        {/* --- PAGE 3+: DATA --- */}
                        {Object.keys(groupedData).map((sensorKey) => {
                            const data = groupedData[sensorKey];
                            const sampled = getSampledData(data);

                            const sensor = sensors.find(s => String(s.id) === sensorKey);
                            const sensorName = sensor ? (sensor.name || sensor.type || `Sensor #${sensor.id}`) : `Sensor #${sensorKey}`;

                            return (
                                <div key={sensorKey} className="mb-8 break-inside-avoid">
                                    <h4 className="font-bold mb-2">Data Pengukuran: {sensorName}</h4>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr>
                                                <th className="w-10">No</th>
                                                <th>Timestamp</th>
                                                <th>Reading Std</th>
                                                <th>Reading UUT</th>
                                                <th>Correction</th>
                                                {/* Add Uncertainty column if data implies it, else skip */}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sampled.map((row, idx) => (
                                                <tr key={row.id}>
                                                    <td>{idx + 1}</td>
                                                    <td>{new Date(row.timestamp).toLocaleString('id-ID')}</td>
                                                    <td>{row.standard_data}</td>
                                                    <td>{row.uut_data}</td>
                                                    <td>{row.uut_correction?.toFixed(4) ?? (row.standard_data - row.uut_data).toFixed(4)}</td>
                                                </tr>
                                            ))}
                                            {data.length > 30 && (
                                                <tr>
                                                    <td colSpan={5} className="bg-gray-100 text-center italic py-1">
                                                        ... {data.length - 30} data points hidden ...
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="page-break"></div>
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
