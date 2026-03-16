'use client';

import React, { useState, useEffect } from 'react';
import { Certificate, Instrument, Sensor } from '../../lib/supabase';
import { calculateUncertaintyBudget, UncertaintyResult, interpolateU95FromPoints } from '../../lib/uncertainty-utils';
import { parseCertCorrectionPoints, interpolateCorrectionFromPoints } from '../../lib/qc-utils';
import { convertUnit } from '../../lib/unitConversion';
// RawDataRow defined locally to avoid circular imports
interface RawDataRow {
    id: any;
    created_at: string;
    timestamp: string;
    standard_data: number;
    uut_data: number;
    session_id: string;
    sensor_id_uut?: number | null;
    sensor_id_std?: number | null;
    sheet_name?: string | null;
    unit_uut?: string | null;
    unit_std?: string | null;
}

interface UncertaintyModalProps {
    isOpen: boolean;
    onClose: () => void;
    certificate: Certificate;
    instruments: Instrument[];
    sensors: Sensor[];
    standardCerts: any[];
    rawData: RawDataRow[];
    instrumentNames: Array<{ id: number; name: string }>;
}

export default function UncertaintyModal({
    isOpen,
    onClose,
    certificate,
    instruments,
    sensors,
    standardCerts,
    rawData,
    instrumentNames
}: UncertaintyModalProps) {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<number | 'unknown'>(0);

    const groupedData = React.useMemo(() => {
        const groups: Record<string, RawDataRow[]> = {};
        rawData.forEach((row) => {
            const key = row.sensor_id_uut ? String(row.sensor_id_uut) : 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        return groups;
    }, [rawData]);

    const tabKeys = Object.keys(groupedData);

    useEffect(() => {
        if (!isOpen) {
            setLoading(true);
            return;
        }

        if (tabKeys.length > 0 && (activeTab === 0 || activeTab === 'unknown' || !tabKeys.includes(String(activeTab)))) {
            const firstKey = tabKeys[0] !== 'unknown' ? Number(tabKeys[0]) : 'unknown';
            setActiveTab(firstKey);
        }
        setLoading(false);
    }, [isOpen, tabKeys, activeTab]);

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] backdrop-blur-sm">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    const currentData = (groupedData[String(activeTab)] || []).sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    const resolveSensorName = (s: any) => {
        if (!s) return 'Unknown Sensor';
        const fromLookup = s.sensor_name_id
            ? instrumentNames?.find((n: any) => n.id === s.sensor_name_id)?.name
            : undefined;
        if (fromLookup) return fromLookup;
        if (s.name && !/^\d+$/.test(String(s.name).trim())) return s.name;
        if (s.type) return s.type;
        return `Sensor ${s.id}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Uncertainty Budget (U95)
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Certificate: <span className="font-mono font-medium">{certificate.no_certificate}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-1 min-h-0 bg-gray-50">
                    {/* Sidebar Tabs */}
                    <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
                        <div className="p-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Sensors Evaluated</h4>
                            <div className="space-y-1">
                                {tabKeys.map(key => {
                                    const tKey = key === 'unknown' ? 'unknown' : Number(key);
                                    let sensorName = 'Unknown Sensor';
                                    if (key !== 'unknown') {
                                        const storedSheetName = groupedData[key][0]?.sheet_name;
                                        if (storedSheetName && !/^\d+$/.test(storedSheetName.trim())) {
                                            sensorName = storedSheetName;
                                        } else {
                                            const sensor = sensors.find(s => s.id === Number(key));
                                            sensorName = resolveSensorName(sensor);
                                        }
                                    }

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveTab(tKey)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${activeTab === tKey
                                                ? 'bg-purple-100 text-purple-800 font-semibold'
                                                : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <span className="truncate pr-2">{sensorName}</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tKey ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-500'}`}>
                                                {groupedData[key].length}
                                            </span>
                                        </button>
                                    );
                                })}
                                {tabKeys.length === 0 && (
                                    <div className="text-sm text-gray-500 px-2 py-4 italic text-center">
                                        Data mentah belum tersedia / belum lengkap.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                        <UncertaintyContent
                            activeTab={activeTab}
                            currentData={currentData}
                            sensors={sensors}
                            instruments={instruments}
                            standardCerts={standardCerts}
                            certificate={certificate}
                            instrumentNames={instrumentNames}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function UncertaintyContent({
    activeTab,
    currentData,
    sensors,
    instruments,
    standardCerts,
    certificate,
    instrumentNames
}: {
    activeTab: number | 'unknown';
    currentData: RawDataRow[];
    sensors: Sensor[];
    instruments: Instrument[];
    standardCerts: any[];
    certificate: Certificate;
    instrumentNames: Array<{ id: number; name: string }>;
}) {
    // 1. Preparation
    const uutSensor = activeTab !== 'unknown' ? sensors.find(s => s.id === activeTab) : null;
    const stdSensorId = currentData.length > 0 ? currentData[0].sensor_id_std : null;
    const certMatches = certificate.results?.filter((r: any) => {
        // Strictly match the current UUT sensor or the standard sensor used in the data
        // Do NOT use `|| r.standardInstrumentId` generically as it will match the first cert (e.g. Pressure) for all tabs
        return (r.sensor_id_uut === activeTab) || (stdSensorId && r.sensor_id_std === stdSensorId);
    });


    let standardCertRecord = null;
    if (currentData.length > 0 && certMatches && certMatches.length > 0) {
        const stdCertId = certMatches[0].standardCertificateId;
        if (stdCertId) {
            standardCertRecord = standardCerts.find(c => c.id === stdCertId);
        }
    }

    // Fallback if not specifically linked in results
    if (!standardCertRecord && stdSensorId) {
        // Find most recent standard cert for this standard sensor
        const certs = standardCerts.filter(c => c.sensor_id === stdSensorId);
        if (certs.length > 0) {
            standardCertRecord = certs.sort((a, b) => new Date(b.calibration_date).getTime() - new Date(a.calibration_date).getTime())[0];
        }
    }

    // resolusiUut: ambil dari field 'resolution' sensor (kolom baru di DB).
    // Fallback ke 'graduating' jika resolution belum diisi (backwards compatibility).
    const rawResolusiUut = uutSensor?.resolution != null
        ? uutSensor.resolution
        : parseFloat(uutSensor?.graduating ?? '0');
    const resolusiUut = isNaN(rawResolusiUut) ? 0 : rawResolusiUut;


    // Advanced unit resolution: Row -> Sensor -> Instrument (Certificate)
    let unitUut = currentData[0]?.unit_uut;
    if (!unitUut) {
        unitUut = uutSensor?.graduating_unit || uutSensor?.range_capacity_unit;
    }
    if (!unitUut && certificate.instrument) {
        const certInst = instruments.find(i => i.id === certificate.instrument);
        if (certInst?.sensor && certInst.sensor.length > 0) {
            unitUut = certInst.sensor[0].graduating_unit || certInst.sensor[0].range_capacity_unit;
        }
    }
    unitUut = unitUut || 'Unit';

    const driftStd = typeof standardCertRecord?.drift === 'number' ? standardCertRecord.drift :
        parseFloat(standardCertRecord?.drift) || 0;

    const resolusiStd = typeof standardCertRecord?.resolution === 'number' ? standardCertRecord.resolution :
        parseFloat(standardCertRecord?.resolution) || 0;

    // Detect if UUT instrument is Analog (instrument_type_id = 2) or Digital (instrument_type_id = 1 or null)
    // Analog → Triangular distribution (√6), Digital → Rectangular (√3)
    const uutInstrument = certificate.instrument ? instruments.find(i => i.id === certificate.instrument) : null;
    const isAnalog = (uutInstrument?.instrument_type_id ?? 1) === 2;
    // Parse correction points from standardCertRecord (certificate_standard table)
    // Data source: setpoint[] + correction_std[] columns (not master_qc!)
    const stdCorrectionPoints = React.useMemo(() => {
        if (!standardCertRecord) return [];
        return parseCertCorrectionPoints(standardCertRecord);
    }, [standardCertRecord]);

    // The average corrected standard reading: used ONLY for interpolating U95 from the
    // certificate_standard table (setpoints are in the standard's native unit, e.g. hPa)
    const globalStdCorrected = React.useMemo(() => {
        if (currentData.length === 0) return 0;
        let total = 0;
        currentData.forEach((row) => {
            const stdData = row.standard_data || 0;
            const correction = stdCorrectionPoints.length > 0
                ? interpolateCorrectionFromPoints(stdCorrectionPoints, stdData)
                : 0;
            total += stdData + correction;
        });
        return total / currentData.length;
    }, [currentData, stdCorrectionPoints]);

    // The displayed set point: rata-rata UUT readings (matches LHKS "Rata-Rata" UUT column)
    const globalUutAvg = React.useMemo(() => {
        if (currentData.length === 0) return 0;
        return currentData.reduce((sum, row) => sum + (row.uut_data || 0), 0) / currentData.length;
    }, [currentData]);

    // Repeat must use std dev of UUT correction values:
    // koreksi_uut = std_terkoreksi_dalam_unit_UUT - uut_data
    // CRITICAL: convert standard_data from its unit (unit_std, e.g. hPa) to uut unit (unit_uut, e.g. inHg)
    // before subtraction. Without this, hPa(~1007) - inHg(~29.7) = ~977 → wrong huge std dev.
    const unitStd = currentData[0]?.unit_std || '';
    const uutReadings = React.useMemo(() => {
        if (stdCorrectionPoints.length === 0) {
            // No cert correction data: fallback to raw UUT readings
            return currentData.map(row => row.uut_data);
        }
        return currentData.map(row => {
            const stdData = row.standard_data || 0;
            const unitStdRow = row.unit_std || unitStd || '';
            const unitUutRow = row.unit_uut || unitUut || '';
            // Step 1: add cert correction (in std native unit)
            const correction = interpolateCorrectionFromPoints(stdCorrectionPoints, stdData);
            const stdCorrected = stdData + correction;
            // Step 2: convert corrected standard to UUT unit, then subtract uut_data
            const stdCorrectedInUutUnit = unitStdRow && unitUutRow && unitStdRow.toLowerCase() !== unitUutRow.toLowerCase()
                ? convertUnit(stdCorrected, unitStdRow, unitUutRow)
                : stdCorrected;
            return stdCorrectedInUutUnit - (row.uut_data || 0);
        });
    }, [currentData, stdCorrectionPoints, unitStd, unitUut]);


    // Formatters
    const formatDec = (n: number, d: number = 4) => n.toFixed(d).replace('.', ',');
    const formatSci = (n: number, d: number = 2) => {
        if (n === 0) return '0,0E+00';
        const sci = n.toExponential(d).toUpperCase().replace('.', ',');
        return sci.replace(/E([+-])(\d)$/, 'E$10$2');
    };

    // Build sensor display name using the same logic as the sidebar tabs
    // Must be called before any early returns (Rules of Hooks)
    const sensorNameDisplay = React.useMemo(() => {
        if (!uutSensor) return 'SENSOR';
        const storedSheetName = currentData[0]?.sheet_name;
        if (storedSheetName && !/^\d+$/.test(storedSheetName.trim())) {
            return storedSheetName.toUpperCase();
        }
        const fromLookup = uutSensor.sensor_name_id
            ? instrumentNames?.find((n: any) => n.id === uutSensor.sensor_name_id)?.name
            : undefined;
        if (fromLookup) return fromLookup.toUpperCase();
        if (uutSensor.name && !/^\d+$/.test(String(uutSensor.name).trim())) return uutSensor.name.toString().toUpperCase();
        if (uutSensor.type) return uutSensor.type.toUpperCase();
        return 'SENSOR';
    }, [uutSensor, currentData, instrumentNames]);

    if (currentData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p className="text-lg">No raw data available to calculate.</p>
            </div>
        );
    }


    // Interpolasi Linier U95 dari sertifikat standar
    // x = globalStdCorrected (rata-rata pembacaan terkoreksi alat standar, dalam unit native sertifikat, e.g. hPa)
    // Menggunakan fungsi interpolateU95FromPoints dari uncertainty-utils (forecast linear)
    let interpolatedU95 = 0;
    if (stdCorrectionPoints.length > 0) {
        // stdCorrectionPoints sudah mengandung u95 per setpoint (dari parseCertCorrectionPoints)
        interpolatedU95 = interpolateU95FromPoints(stdCorrectionPoints, globalStdCorrected);
    } else if (standardCertRecord?.u95_general) {
        // Fallback: ambil u95_general jika tidak ada tabel setpoint
        interpolatedU95 = typeof standardCertRecord.u95_general === 'number'
            ? standardCertRecord.u95_general
            : parseFloat(standardCertRecord.u95_general) || 0;
    }

    const result: UncertaintyResult = calculateUncertaintyBudget({
        unit: unitUut,
        uutReadings,
        interpolatedCertU95: interpolatedU95,
        driftStd,
        resolusiStd,
        resolusiUut,
        isAnalog
    });

    // Rename repeating components to match screenshot closely
    const components = result.components.map(c => {
        if (c.name.includes('Repeatability')) return { ...c, name: 'Repeat' };
        if (c.name.includes('Cert Std U95')) return { ...c, name: 'Sertifikat Std', symbol: 'u_sertf.' }; // To match standard report syntax
        if (c.name.includes('Drift Std')) return { ...c, name: 'Drif Std', symbol: 'u_drift' };
        if (c.name.includes('Res Uut')) return { ...c, name: 'Resolusi Uut', symbol: 'u_resolusi uut' };
        if (c.name.includes('Res Std')) return { ...c, name: 'Resolusi Std', symbol: 'u_resolusi std' };
        return c;
    });

    // Temporary helper for parsing symbol for subscripts
    const renderSymbol = (sym: string) => {
        if (sym.includes('_')) {
            const [base, sub] = sym.split('_');
            return <>{base}<sub>{sub}</sub></>;
        }
        return sym;
    };

    return (
        <div className="space-y-6">

            {/* A4 Paper Container Concept */}
            <div className="bg-white mx-auto shadow-md border border-gray-300 overflow-x-auto p-8 font-sans text-black" style={{ maxWidth: '1000px', minHeight: '600px' }}>

                {/* Header Information */}
                <div className="flex justify-end mb-8 text-sm font-bold tracking-tight">
                    <div className="grid grid-cols-[100px_10px_1fr] gap-x-1">
                        <div>No Sertifikat</div>
                        <div>:</div>
                        <div>{certificate.no_certificate || '-'}</div>

                        <div>No Order</div>
                        <div>:</div>
                        <div>{certificate.no_order || '-'}</div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center font-bold text-lg mb-6">
                    <span className="border-b-2 border-black inline-block tracking-wide uppercase">
                        PERHITUNGAN KETIDAKPASTIAN {sensorNameDisplay}
                    </span>
                </div>

                {/* Set Point Indicator */}
                <div className="flex gap-4 mb-1 text-[15px]">
                    <div>SET POINT RATA-RATA ALAT YANG DIKALIBRASI</div>
                    <div>{formatDec(globalUutAvg, 2)} {unitUut}</div>
                </div>

                {/* Main Table */}
                <table className="w-full text-center border-collapse border border-black text-[12px] tabular-nums" style={{ lineHeight: '1.2' }}>
                    <thead>
                        <tr>
                            <th className="border border-black font-normal py-1 px-1">Uncert source/<br />Komponen</th>
                            <th className="border border-black font-normal py-1 px-1">Unit/<br />Satuan</th>
                            <th className="border border-black font-normal py-1 px-1">Distribusi</th>
                            <th className="border border-black font-normal py-1 px-1">Symbol</th>
                            <th className="border border-black font-normal py-1 px-1">U atau a</th>
                            <th className="border border-black font-normal py-1 px-1">Cov. Factor/<br />Pembagi</th>
                            <th className="border border-black font-normal py-1 px-1">Deg. of freedom/<br />vi</th>
                            <th className="border border-black font-normal py-1 px-1">Std. Uncert/<br />ui</th>
                            <th className="border border-black font-normal py-1 px-1">Sens. Coeff/<br />ci</th>
                            <th className="border border-black font-normal py-1 px-1 w-[70px]">c<sub>i</sub>.u<sub>i</sub></th>
                            <th className="border border-black font-normal py-1 px-1 w-[80px]">(c<sub>i</sub>.u<sub>i</sub>)²</th>
                            <th className="border border-black font-normal py-1 px-1 w-[80px]">(c<sub>i</sub>.u<sub>i</sub>)⁴/v<sub>i</sub></th>
                        </tr>
                    </thead>
                    <tbody>
                        {components.map((c, i) => (
                            <tr key={i}>
                                <td className="border border-black px-2 py-0.5 text-left">{c.name}</td>
                                <td className="border border-black px-1 py-0.5">{c.unit}</td>
                                <td className="border border-black px-2 py-0.5 text-left">{c.distribution}</td>
                                <td className="border border-black px-1 py-0.5">{renderSymbol(c.symbol)}</td>
                                <td className="border border-black px-2 py-0.5">{formatDec(c.u_a, 4)}</td>
                                <td className="border border-black px-2 py-0.5">{formatDec(c.cov_factor, 3)}</td>
                                <td className="border border-black px-2 py-0.5">{c.deg_freedom}</td>
                                <td className="border border-black px-2 py-0.5">{formatSci(c.std_uncertainty)}</td>
                                <td className="border border-black px-2 py-0.5">{c.sens_coeff}</td>
                                <td className="border border-black px-2 py-0.5">{formatSci(c.ci_ui)}</td>
                                <td className="border border-black px-2 py-0.5">{formatSci(c.ci_ui_sq)}</td>
                                <td className="border border-black px-2 py-0.5">{formatSci(c.ci_ui_quad_vi)}</td>
                            </tr>
                        ))}

                        {/* Summary Rows */}
                        <tr>
                            <td colSpan={9} className="border-0 border-r border-black"></td>
                            <td className="border border-black px-1 py-0.5 text-left font-normal" style={{ fontSize: '11px' }}>Sums</td>
                            <td className="border border-black px-1 py-0.5">{formatSci(result.sums.ci_ui_sq)}</td>
                            <td className="border border-black px-1 py-0.5">{formatSci(result.sums.ci_ui_quad_vi)}</td>
                        </tr>
                        <tr>
                            <td colSpan={9} className="border-0 border-r border-black"></td>
                            <td className="border border-black px-1 py-0.5 text-left font-normal" style={{ fontSize: '11px' }}>Comb. uncert, uc</td>
                            <td colSpan={2} className="border border-black px-1 py-0.5 text-center">{formatSci(result.comb_uncert_uc)}</td>
                        </tr>
                        <tr>
                            <td colSpan={9} className="border-0 border-r border-black"></td>
                            <td className="border border-black px-1 py-0.5 text-left font-normal" style={{ fontSize: '11px' }}>Eff. Deg of freedom, veff</td>
                            <td colSpan={2} className="border border-black px-1 py-0.5 text-center">{formatSci(result.eff_deg_freedom_veff)}</td>
                        </tr>
                        <tr>
                            <td colSpan={9} className="border-0 border-r border-black"></td>
                            <td className="border border-black px-1 py-0.5 text-left font-normal" style={{ fontSize: '11px' }}>Cov. Factor for 95% CL</td>
                            <td colSpan={2} className="border border-black px-1 py-0.5 text-center">{formatSci(result.cov_factor_95)}</td>
                        </tr>
                        <tr>
                            <td colSpan={9} className="border-0 border-r border-black"></td>
                            <td className="border border-black px-1 py-0.5 text-left font-normal" style={{ fontSize: '11px' }}>Expanded uncertainty, U95</td>
                            <td colSpan={2} className="border border-black px-1 py-0.5 text-right pr-4 font-bold">
                                <span className="border-b-[1.5px] border-black inline-block">{formatDec(result.expanded_uncert_u95, 3)}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

