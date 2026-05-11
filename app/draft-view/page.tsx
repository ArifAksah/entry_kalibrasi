'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import QRCodeStyling from 'qr-code-styling'
import bmkgLogo from '../bmkg.png'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import { useAuth } from '../../contexts/AuthContext'
import { useCertificates } from '../../hooks/useCertificates'
import { Certificate, Station, Instrument, Personel } from '../../lib/supabase'
import { useAlert } from '../../hooks/useAlert'
import { supabase } from '../../lib/supabase'
import QCDataModal from '../../components/features/QCDataModal'
import { isDefaultNotesOthersValue, normalizeRichTextValue, richTextContentClassName } from '../../lib/rich-text'
import { firstLegacyResult, resultsToLegacyView } from '../../lib/validators/certificate-results-render-adapter'
import { formatLatexUnit } from '../../lib/qc-utils'
import qcCacheService from '../../lib/qc-cache-service'

const RichTextCell: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => (
  <div
    className={`${richTextContentClassName} whitespace-normal ${className}`}
    dangerouslySetInnerHTML={{ __html: normalizeRichTextValue(value) }}
  />
)

const isOthersEnabled = (notesForm: { others?: string | null; others_enabled?: boolean | null } | null | undefined) =>
  typeof notesForm?.others_enabled === 'boolean'
    ? notesForm.others_enabled
    : Boolean(notesForm?.others)

// Modal Kirim Naskah Component
const KirimNaskahModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  certificate: Certificate | null
  verifikator1: Personel | null
  verifikator2: Personel | null
  verifikator3: Personel | null
  assignor: Personel | null
  confirmDisabled?: boolean
}> = ({ isOpen, onClose, onConfirm, certificate, verifikator1, verifikator2, verifikator3, assignor, confirmDisabled = false }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Kirim Naskah</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Anda akan mengirim Naskah ini dengan nomor <span className="font-semibold">{certificate?.no_certificate}</span> kepada verifikator:
          </p>

          {/* Recipients */}
          <div className="space-y-4 mb-6">
            {/* Verifikator 1 */}
            {verifikator1 && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Kepada:</p>
                  <p className="text-sm text-gray-900">{verifikator1.name} - Verifikator 1</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Unit Kerja:</p>
                  <p className="text-sm text-gray-900">Direktorat Data dan Komputasi BMKG</p>
                </div>
              </div>
            )}

            {/* Verifikator 2 */}
            {verifikator2 && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Kepada:</p>
                  <p className="text-sm text-gray-900">{verifikator2.name} - Verifikator 2</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Unit Kerja:</p>
                  <p className="text-sm text-gray-900">Direktorat Data dan Komputasi BMKG</p>
                </div>
              </div>
            )}

            {/* Verifikator 3 */}
            {verifikator3 && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Kepada:</p>
                  <p className="text-sm text-gray-900">{verifikator3.name} - Verifikator 3</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Unit Kerja:</p>
                  <p className="text-sm text-gray-900">Direktorat Data dan Komputasi BMKG</p>
                </div>
              </div>
            )}

            {/* Assignor */}
            {assignor && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Kepada:</p>
                  <p className="text-sm text-gray-900">{assignor.name} - Assignor</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Unit Kerja:</p>
                  <p className="text-sm text-gray-900">Direktorat Data dan Komputasi BMKG</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`flex-1 text-white px-4 py-2 rounded-lg transition-colors font-medium ${confirmDisabled ? 'bg-green-400 cursor-not-allowed opacity-60' : 'bg-green-600 hover:bg-green-700'}`}
            >
              YA KIRIM
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              TUTUP
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Table Renderer Component
const TableRenderer: React.FC<{ data: any; title?: string }> = ({ data, title }) => {
  if (!data) return null

  // Handle different data structures
  let tableData: any[] = []
  let tableTitle = title || ''

  // Check if data has rows property (new format)
  if (data.rows && Array.isArray(data.rows)) {
    tableData = data.rows
    tableTitle = data.title || title || ''
  }
  // Check if data is direct array (old format)
  else if (Array.isArray(data)) {
    tableData = data
    tableTitle = title || ''
  }
  // Check if data is single object with rows
  else if (typeof data === 'object' && data.rows) {
    tableData = Array.isArray(data.rows) ? data.rows : [data.rows]
    tableTitle = data.title || title || ''
  }
  else {
    return null
  }

  if (tableData.length === 0) return null

  // Check if data has consistent structure
  const firstRow = tableData[0]
  const hasKeyValueUnit = firstRow && firstRow.key && firstRow.value && firstRow.unit

  if (hasKeyValueUnit) {
    // Format: [{key, value, unit}, ...]
    return (
      <div className="mb-4">
        {tableTitle && <h5 className="text-sm font-semibold text-gray-700 mb-2">{tableTitle}</h5>}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                  Parameter
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                  Nilai
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                  Satuan
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row: any, index: number) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-200">
                    {row.key || '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-200">
                    {row.value || '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-200">
                    {row.unit || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  } else if (typeof firstRow === 'object' && firstRow !== null) {
    // Format: [{col1: val1, col2: val2}, ...]
    const columns = Object.keys(firstRow)
    return (
      <div className="mb-4">
        {tableTitle && <h5 className="text-sm font-semibold text-gray-700 mb-2">{tableTitle}</h5>}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col, index) => (
                  <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row: any, index: number) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="px-3 py-2 text-sm text-gray-900 border-b border-gray-200">
                      {typeof row[col] === 'object' ? JSON.stringify(row[col]) : (row[col] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  } else {
    // Format: [primitive1, primitive2, ...]
    return (
      <div className="mb-4">
        {tableTitle && <h5 className="text-sm font-semibold text-gray-700 mb-2">{tableTitle}</h5>}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="space-y-1">
            {tableData.map((item: any, index: number) => (
              <div key={index} className="text-sm text-gray-900">
                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

// Certificate Preview Component
const CertificatePreview: React.FC<{
  certificate: Certificate
  stations: Station[]
  instruments: Instrument[]
  personel: Personel[]
}> = ({ certificate, stations, instruments, personel }) => {
  // Deterministic date formatter to avoid SSR/CSR locale mismatch
  const formatDateIndo = (ymd: string | null | undefined) => {
    if (!ymd) return '-'
    const [y, m, d] = ymd.split('-')
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const idx = Math.max(1, Math.min(12, parseInt(m || '1', 10))) - 1
    return `${d?.padStart(2, '0') ?? '--'} ${months[idx]} ${y ?? '----'}`
  }
  const station = stations.find(s => s.id === certificate.station)
  const instrument = instruments.find(i => i.id === certificate.instrument)
  const authorized = personel.find(p => p.id === certificate.authorized_by)
  const verifikator1 = personel.find(p => p.id === certificate.verifikator_1)
  const verifikator2 = personel.find(p => p.id === certificate.verifikator_2)
  const verifikator3 = personel.find(p => p.id === certificate.verifikator_3)
  const assignor = personel.find(p => p.id === certificate.assignor)

  // Parse results data (handle both string and object)
  const results = (() => {
    return resultsToLegacyView(certificate.results)
  })()

  const totalPrintedPages = results.length + 2

  // Raw data for computing environmental conditions from imported Excel
  const [allRawData, setAllRawData] = useState<any[]>([])

  const computeEnvCondition = useCallback((type: 'suhu' | 'kelembaban', sensorRawData: any[]): string => {
    const matchedRows = sensorRawData.filter(r => {
      const rawUnit = String(r.unit_std || r.unit_uut || '');
      const unit = formatLatexUnit(rawUnit).toLowerCase().trim();
      const name = (r.sheet_name || r.name || r.category || '').toLowerCase();

      if (type === 'suhu') {
        const unitIsTemp = unit && (unit.includes('°c') || unit.includes('c') || unit.includes('celcius') || unit.includes('celsius'));
        const nameIsTemp = ['suhu', 'temp', 'termometer', 'temperature', 'thermo'].some(k => name.includes(k));
        return unitIsTemp || (nameIsTemp && !unit);
      }

      const unitIsHum = unit && (unit.includes('%') || unit.includes('rh') || unit.includes('r.h') || unit.includes('kelembaban') || unit.includes('humidity') || unit.includes('hum'));
      const nameIsHum = ['kelembab', 'lembab', 'humidity', 'hum', 'hygro', 'rh', 'r.h'].some(k => name.includes(k));
      return unitIsHum || (nameIsHum && !unit);
    });

    if (matchedRows.length === 0) return '-';

    const values = matchedRows
      .map(r => {
        if (r.std_corrected != null) return Number(r.std_corrected);
        const sd = Number(r.standard_data);
        const sc = Number(r.std_correction ?? 0);
        if (!isNaN(sd)) return sd + sc;
        return NaN;
      })
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return '-';

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const mean = (minV + maxV) / 2;
    const halfRange = maxV - mean;

    const unit = type === 'suhu' ? '°C' : '%';
    return `(${mean.toFixed(1)} ± ${halfRange.toFixed(1)}) ${unit}`;
  }, []);

  // Fetch raw data from imported Excel for environmental condition computation
  useEffect(() => {
    if (!results || results.length === 0) return;
    const sessionIds = Array.from(new Set(results.map((r: any) => r.session_id).filter(Boolean)));
    if (sessionIds.length === 0) return;

    const fetchRawData = async () => {
      try {
        const rawDataPromises = sessionIds.map((sid: string) =>
          fetch(`/api/raw-data?session_id=${sid}`).then(res => res.ok ? res.json() : { data: [] })
        );
        const allRawDataResp = await Promise.all(rawDataPromises);
        const mergedRawData = allRawDataResp.flatMap(resp => resp.data || []);
        setAllRawData(mergedRawData);

        // Pre-warm QC cache for each session that has raw data
        sessionIds.forEach((sid: string) => {
          qcCacheService.triggerComputation(sid)
        })
      } catch (e) {
        console.error("Failed to fetch raw data for draft-view env conditions", e);
      }
    };
    fetchRawData();
  }, [results])

  // QR verification URL and signing status
  const qrUrl = useMemo(() => {
    const identifier = (certificate as any).public_id
    if (!identifier) return ''
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/verify/${encodeURIComponent(identifier)}`
  }, [certificate])
  const [isSigned, setIsSigned] = useState<boolean>(false)

  const checkVerificationStatus = async () => {
    try {
      if (!certificate.id) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      // Use certificate ID for API call to ensure uniqueness
      const res = await fetch(`/api/verify-certificate?id=${certificate.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        console.log('🔍 [Draft] verify-certificate response:', data)
        console.log('🔍 [Draft] data.valid:', data?.valid)
        console.log('🔍 [Draft] data.verification:', data?.verification)
        // QR hitam jika Level 3 approved (valid true) - tanpa pembatasan versi
        setIsSigned(!!data?.valid)
        console.log('🎨 [Draft] QR color will be:', !!data?.valid ? 'BLACK (#000000)' : 'RED (#B91C1C)')
      }
    } catch (err) {
      console.error('❌ [Draft] verify-certificate error:', err)
      // no fallback to avoid turning black on 'sent'
    }
  }

  useEffect(() => {
    checkVerificationStatus()
  }, [certificate.id])

  // Listen for storage events to refresh QR status when signing happens
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'certificate_signed' && e.newValue) {
        const signedData = JSON.parse(e.newValue)
        if (signedData.certificateId === certificate.id) {
          console.log('🔔 [Draft] Certificate was signed, refreshing QR status...')
          checkVerificationStatus()
          // Clear the flag
          localStorage.removeItem('certificate_signed')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also check periodically (every 5 seconds) in case we miss the event
    const interval = setInterval(checkVerificationStatus, 5000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [certificate.id])

  // Styled QR component
  const QRCodeBox: React.FC<{ value: string; size?: number; logoSize?: number; fgColor?: string }> = ({ value, size = 120, logoSize = 36, fgColor = '#000000' }) => {
    const ref = useRef<HTMLDivElement | null>(null)
    const qr = useRef<QRCodeStyling | null>(null)
    useEffect(() => {
      if (!ref.current) return
      const mock = (process.env.NEXT_PUBLIC_BSRE_MOCK || '').toString().toLowerCase() === 'true'
      const config = {
        width: size,
        height: size,
        type: mock ? 'canvas' : 'svg',
        data: value || ' ',
        backgroundOptions: { color: '#FFFFFF' },
        dotsOptions: { color: fgColor, type: 'square' },
        cornersSquareOptions: { color: '#000000', type: 'square' },
        cornersDotOptions: { color: '#000000' },
        image: bmkgLogo.src,
        imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: logoSize / size },
        margin: 6,
      } as any
      if (!qr.current) {
        qr.current = new QRCodeStyling(config)
        qr.current.append(ref.current)
      } else {
        qr.current.update(config)
      }
    }, [value, size, logoSize, fgColor])
    return <div className="w-[120px] h-[120px]" ref={ref} />
  }

  const sensorsSummary = (() => {
    const r: any[] = results
    if (!r.length) return instrument?.others || '-'
    const lines = r.map((res: any, i: number) => {
      const sd = res?.sensorDetails || {}
      const nm = sd?.name || sd?.type || `Sensor ${i + 1}`
      const mf = sd?.manufacturer || '-'
      const tp = sd?.type || '-'
      const sn = sd?.serial_number || '-'
      return `${i + 1}. ${nm} : ${mf} / ${tp} / ${sn}`
    })
    return `terdiri dari beberapa sensor yaitu:\n` + lines.join('\n')
  })()

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative" suppressHydrationWarning>
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30"
        style={{
          backgroundImage: `url(${bmkgLogo.src})`,
          backgroundSize: '700px 700px',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 5%'
        }}
      />
      {/* Removed large BMKG text watermark overlay */}
      <div className="relative z-10">
        {/* Certificate Header (mirror print) */}
        <div className="mb-8">
          <header className="flex flex-row items-center justify-between border-b-4 border-black pb-2">
            <div className="w-[100px] flex items-center justify-center">
              <img src={bmkgLogo.src} alt="BMKG" className="h-[100px] w-[100px] object-contain" />
            </div>
            <div className="text-center leading-tight">
              <h1 className="text-base font-bold text-gray-900">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
              <h2 className="text-base font-bold text-gray-900">LABORATORIUM KALIBRASI BMKG</h2>
            </div>
            <div className="w-[100px]" />
          </header>

          {/* Certificate Title */}
          <div className="text-center my-6">
            <h1 className="text-xl font-bold tracking-wide text-gray-900">SERTIFIKAT KALIBRASI</h1>
            <h2 className="text-base italic text-gray-700">CALIBRATION CERTIFICATE</h2>
            <div className="text-sm font-semibold mt-2 text-gray-900">{certificate.no_certificate || '-'}</div>
          </div>
          <div className="mt-6">
            {/* Left column: Identitas Alat & Pemilik */}
            <div>
              {/* Identitas Alat */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-900">IDENTITAS ALAT</h3>
                <h4 className="text-xs italic text-gray-600 mb-2">Instrument Details</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="w-[32%] align-top pr-2">
                        <div className="font-semibold">Nama Alat</div>
                        <div className="text-[10px] italic text-gray-600">Instrument Name</div>
                      </td>
                      <td className="w-[3%] align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold">{instrument?.name || '-'}</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-2">
                        <div className="font-semibold">Merek Pabrik</div>
                        <div className="text-[10px] italic text-gray-600">Manufacturer</div>
                      </td>
                      <td className="align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold">{instrument?.manufacturer || '-'}</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-2">
                        <div className="font-semibold">Tipe / Nomor Seri</div>
                        <div className="text-[10px] italic text-gray-600">Type / Serial Number</div>
                      </td>
                      <td className="align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold">{(instrument?.type || '-') + ' / ' + (instrument?.serial_number || '-')}</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-2">
                        <div className="font-semibold">Lain-lain</div>
                        <div className="text-[10px] italic text-gray-600">Others</div>
                      </td>
                      <td className="align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold whitespace-pre-line">{sensorsSummary}</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Identitas Pemilik */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 underline leading-tight mb-0">IDENTITAS PEMILIK</h3>
                <h4 className="text-xs italic text-gray-600 leading-tight mb-1">Owner's Identification</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="w-[32%] align-top pr-2">
                        <div className="font-semibold">Nama</div>
                        <div className="text-[10px] italic text-gray-600">Designation</div>
                      </td>
                      <td className="w-[3%] align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold">{station?.name || '-'}</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-2">
                        <div className="font-semibold">Alamat</div>
                        <div className="text-[10px] italic text-gray-600">Address</div>
                      </td>
                      <td className="align-top">:</td>
                      <td className="align-top">
                        <div className="inline-flex items-start w-full">
                          <div className="flex-1 font-semibold">{certificate.station_address || '-'}</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* PENGESAHAN */}
            <div className="mt-6 mb-8">
              <h3 className="text-sm font-bold text-gray-900 underline leading-tight mb-0">PENGESAHAN</h3>
              <h4 className="text-[11px] italic text-gray-700 font-bold mb-2 leading-tight">Authorization</h4>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-[32%] align-top pr-2">
                      <div className="font-semibold">Pejabat Pengesahan</div>
                      <div className="text-[10px] italic text-gray-600">Authorizing officer</div>
                    </td>
                    <td className="w-[3%] align-top">:</td>
                    <td className="align-top">
                      <div className="inline-flex items-start w-full">
                        <div className="flex-1 font-bold">Direktur Instrumentasi dan Kalibrasi BMKG</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="align-top pr-2">
                      <div className="font-semibold">Nama</div>
                      <div className="text-[10px] italic text-gray-600">Name</div>
                    </td>
                    <td className="align-top">:</td>
                    <td className="align-top">
                      <div className="inline-flex items-start w-full">
                        <div className="flex-1 font-bold">{authorized?.name || '-'}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="align-top pr-2">
                      <div className="font-semibold">Tanggal Pengesahan</div>
                      <div className="text-[10px] italic text-gray-600">Date of issue</div>
                    </td>
                    <td className="align-top">:</td>
                    <td className="align-top">
                      <div className="inline-flex items-start w-full">
                        <div className="flex-1 font-bold">{certificate.issue_date ? formatDateIndo(certificate.issue_date) : '-'}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="align-top pr-2">
                      <div className="font-semibold">Jumlah halaman</div>
                      <div className="text-[10px] italic text-gray-600">Total number of pages</div>
                    </td>
                    <td className="align-top">:</td>
                    <td className="align-top">
                      <div className="inline-flex items-start w-full">
                        <div className="flex-1 font-bold">{totalPrintedPages}</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Certificate Details removed in favor of left/right sections matching mockup */}

        {/* Station Address section removed to match print layout */}

        {/* Calibration Results: per-page like print - Halaman 2+ */}
        {results && results.length > 0 && qrUrl && (
          <>
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Hasil Kalibrasi</h3>
              <div className="space-y-6">
                {results.map((res: any, index: number) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-5 relative">
                    {/* QR Code kecil di setiap halaman hasil kalibrasi - SELALU muncul di semua status */}
                    {/* Warna: Merah (#B91C1C) jika belum approved level 3, Hitam (#000000) jika sudah approved level 3 */}
                    <div className="absolute bottom-0 left-1 z-50 bg-white border-2 border-gray-300 rounded-lg p-1 shadow-lg">
                      <QRCodeBox
                        key={`qr-footer-${isSigned ? 'signed' : 'unsigned'}-${index}`}
                        value={qrUrl}
                        size={70}
                        logoSize={21}
                        fgColor={isSigned ? '#000000' : '#B91C1C'}
                      />
                    </div>
                    {/* Header per halaman sensor */}
                    <header className="flex justify-between items-start text-xs mb-4">
                      <div className="w-[100px]">
                        <img src={bmkgLogo.src} alt="BMKG" className="h-[100px] w-[100px] object-contain" />
                      </div>
                      <div className="flex-1 flex justify-end items-start">
                        <table className="w-[360px] text-xs table-fixed ml-auto mr-0">
                          <tbody>
                            <tr>
                              <td className="w-[48%] text-left font-bold leading-tight align-top">
                                No. Sertifikat / <span className="italic">Certificate</span><br />
                                <span className="italic">Number</span>
                              </td>
                              <td className="w-[4%] px-1 align-top">:</td>
                              <td className="w-[48%] align-top font-bold">{certificate.no_certificate}</td>
                            </tr>
                            <tr>
                              <td className="text-left font-bold leading-tight align-top">
                                No. Order / <br />
                                <span className="italic">Order Number</span>
                              </td>
                              <td className="px-1 align-top">:</td>
                              <td className="align-top font-bold">{certificate.no_order}</td>
                            </tr>
                            <tr>
                              <td className="text-left font-bold leading-tight align-top">
                                Halaman / <br />
                                <span className="italic">Page</span>
                              </td>
                              <td className="px-1 align-top">:</td>
                              <td className="align-top font-bold">{index + 2} dari {totalPrintedPages}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </header>

                    {/* Sensor Details + Environment (mirror print) */}
                    {(() => {
                      const sd = res?.sensorDetails || {}
                      const name = sd?.name || sd?.type || '-'
                      const manufacturer = sd?.manufacturer || '-'
                      const type = sd?.type || '-'
                      const serial = sd?.serial_number || '-'
                      const start = res?.startDate ? new Date(res.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
                      const end = res?.endDate ? new Date(res.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
                      const place = res?.place || '-'
                      const sensorInfo: Array<{ label: string; labelEng: string; value: React.ReactNode; topGap?: boolean; bold?: boolean }> = [
                        { label: 'Nama Sensor / ', labelEng: 'Sensor Name', value: name, bold: true },
                        { label: 'Merek Sensor / ', labelEng: 'Manufacturer', value: manufacturer, bold: true },
                        { label: 'Tipe & No. Seri / ', labelEng: 'Type & Serial Number', value: `${type} / ${serial}`, bold: true },
                        { label: 'Tanggal Masuk / ', labelEng: 'Date of Entry', value: start, topGap: true },
                        { label: 'Tanggal Kalibrasi / ', labelEng: 'Calibration Date', value: end },
                        { label: 'Tempat Kalibrasi / ', labelEng: 'Calibration Place', value: place },
                      ]
                      const envRows: Array<{ label: string; labelEng: string; value: React.ReactNode }> = (() => {
                        // Get raw data for this sensor's session
                        const sensorSessionId = res?.session_id;
                        const sensorRawData = sensorSessionId ? allRawData.filter((rd: any) => String(rd.session_id || '') === String(sensorSessionId)) : [];
                        const rawSuhu = computeEnvCondition('suhu', sensorRawData);
                        const rawHum = computeEnvCondition('kelembaban', sensorRawData);

                        let envList = Array.isArray(res?.environment) ? [...res.environment] : [];

                        // Ensure Suhu and Kelembaban exist in envList if they have raw values
                        if (envList.length === 0) {
                          if (rawSuhu !== '-') envList.push({ key: 'Suhu', value: '-' });
                          if (rawHum !== '-') envList.push({ key: 'Kelembaban', value: '-' });
                        } else {
                          const hasSuhu = envList.some((e: any) => e.key.toLowerCase().includes('suhu'));
                          const hasHum = envList.some((e: any) => e.key.toLowerCase().includes('kelembaban') || e.key.toLowerCase().includes('rh'));
                          if (!hasSuhu && rawSuhu !== '-') envList.push({ key: 'Suhu', value: '-' });
                          if (!hasHum && rawHum !== '-') envList.push({ key: 'Kelembaban', value: '-' });
                        }

                        return envList.map((env: any) => {
                          const key = String(env?.key || '')
                          const lower = key.toLowerCase()
                          const isSuhu = lower.includes('suhu')
                          const isHum = lower.includes('kelembaban') || lower.includes('rh')

                          const label = isSuhu ? 'Suhu / ' : isHum ? 'Kelembaban / ' : `${key} `
                          const eng = isSuhu ? 'Temperature' : isHum ? 'Relative Humidity' : ''

                          let finalValue: React.ReactNode = env?.value || '-'

                          // Override with computed value from raw Excel data if available
                          if (isSuhu && rawSuhu !== '-') {
                            finalValue = rawSuhu
                          } else if (isHum && rawHum !== '-') {
                            finalValue = rawHum
                          }

                          return { label, labelEng: eng, value: finalValue }
                        })
                      })()
                      return (
                        <table className="w-full text-sm">
                          <tbody>
                            {sensorInfo.map((row, i) => (
                              <tr key={`sinfo-${i}`}>
                                <td className={`w-[45%] align-top font-semibold ${row.topGap ? 'pt-2' : ''}`}>
                                  {row.label}<span className="italic">{row.labelEng}</span>
                                </td>
                                <td className={`w-[5%] align-top ${row.topGap ? 'pt-2' : ''}`}>:</td>
                                <td className={`${row.topGap ? 'pt-2' : ''}`} colSpan={2}>
                                  <span className={row.bold ? 'font-semibold' : undefined}>{row.value}</span>
                                </td>
                              </tr>
                            ))}
                            {envRows.length > 0 && (
                              <tr>
                                <td />
                                <td />
                                <td className="text-sm font-bold" colSpan={2}>Kondisi Lingkungan / <span className="italic">Environment</span></td>
                              </tr>
                            )}
                            {envRows.map((row, i) => (
                              <tr key={`env-${i}`}>
                                <td />
                                <td />
                                <td className="align-top font-semibold">{row.label}<span className="italic">{row.labelEng}</span></td>
                                <td className="align-top">: {row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    })()}

                    {/* Calibration Result Tables (mirror print) */}
                    {Array.isArray(res?.table) && res.table.length > 0 && (
                      <div className="mt-6 space-y-3 w-[85%] mx-auto">
                        <div className="text-[12px] font-bold text-center mb-1">Hasil Kalibrasi / <span className="italic font-normal">Calibration Result</span></div>
                        {res.table.map((sec: any, sIdx: number) => {
                          const rows = Array.isArray(sec?.rows) ? sec.rows : []
                          const isDuplicateTitle = sec?.title?.toLowerCase().includes('hasil kalibrasi') || sec?.title?.toLowerCase().includes('calibration result');
                          return (
                            <div key={sIdx} className="mt-2">
                              {sec?.title && sec.title.trim() !== '' && !isDuplicateTitle && <div className="text-xs font-bold mb-1 text-center">{sec.title}</div>}
                              {(!sec?.title || sec.title.trim() === '') && <div className="text-xs font-bold mb-1 text-center">{`Tabel ${sIdx + 1}`}</div>}
                              <table className="w-full text-xs border-[2px] border-black text-center border-collapse">
                                <thead>
                                  <tr className="font-bold">
                                    {/* Use explicit headers if available, otherwise fallback to Key/Unit/Value logic */}
                                    {sec.headers ? (
                                      sec.headers.map((h: string, i: number) => (
                                        <td key={i} className="p-1 border border-black">{h}</td>
                                      ))
                                    ) : (
                                      // Fallback for old data without headers
                                      rows.length > 0 && (
                                        <>
                                          <td className="p-1 border border-black">Parameter</td>
                                          <td className="p-1 border border-black">Unit</td>
                                          <td className="p-1 border border-black">Nilai</td>
                                        </>
                                      )
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row: any, rIdx: number) => {
                                    const isBlank = (val: any) => !val || String(val).trim() === '' || String(val).trim() === '-';
                                    const isFirstEmptyRow = rIdx === 0 && isBlank(row.key) && isBlank(row.unit) && isBlank(row.value);
                                    let unitDisplay = res?.unitUut || '-';
                                    return (
                                      <tr key={rIdx}>
                                        {/* If headers exist, map based on standard + extra values */}
                                        {sec.headers ? (
                                          <>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.key || '-')}</td>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.unit || '-')}</td>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.value || '-')}</td>
                                            {Array.isArray(row.extraValues) && row.extraValues.map((v: string, vi: number) => (
                                              <td key={`extra-${vi}`} className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (v || '-')}</td>
                                            ))}
                                          </>
                                        ) : (
                                          // Fallback
                                          <>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.key || '-')}</td>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.unit || '-')}</td>
                                            <td className="p-1 border border-black text-center">{isFirstEmptyRow ? unitDisplay : (row.value || '-')}</td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Images per sensor only for Geofisika (duplicated style from View page) */}
                    {Array.isArray((res as any).images) && (res as any).images.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold mb-2 text-center">Gambar</h5>
                        <div className="flex flex-wrap gap-3 justify-center">
                          {(res as any).images.map((img: any, i: number) => {
                            const src = typeof img === 'string' ? img : (img?.url || '')
                            if (!src) return null
                            return (
                              <figure key={i} className="m-0 text-center">
                                <img src={src} alt={`Gambar Sensor ${i + 1}`} className="block w-[240px] h-[160px] object-contain bg-white" />
                                {img?.caption ? (
                                  <figcaption className="text-[11px] text-gray-600 mt-1 leading-tight">{img.caption}</figcaption>
                                ) : null}
                              </figure>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Notes per sensor (mirror print) */}
                    {(() => {
                      const nf = res?.notesForm || null
                      if (!nf) return null
                      const othersEnabled = isOthersEnabled(nf)
                      const shouldAlwaysShowDefaultOthers = isDefaultNotesOthersValue(nf.others)
                      const showOthers = Boolean(nf.others) && (shouldAlwaysShowDefaultOthers || othersEnabled)
                      const hasAny = nf.traceable_to_si_through || nf.reference_document || nf.calibration_methode || showOthers || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)
                      if (!hasAny) return null
                      return (
                        <div className="mt-6">
                          <div className="text-sm font-bold underline leading-tight mb-0">Catatan / <span className="italic">Notes :</span></div>
                          <table className="w-full text-xs mt-1">
                            <tbody>
                              {Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0 && (
                                <tr>
                                  <td className="w-[40%] align-top text-left pr-2 py-0">
                                    <div className="font-bold leading-tight">Standar Kalibrasi <span className="italic text-[10px] text-gray-900">/ Calibration Standard</span></div>
                                  </td>
                                  <td className="w-[5%] align-top py-0">:</td>
                                  <td className="w-[55%] align-top whitespace-pre-line py-0">
                                    {(() => {
                                      const parts = []

                                      if (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0) {
                                        const standards = nf.standardInstruments.map((sid: number) => {
                                          const s = instruments.find((instrument: any) => instrument.id === sid) as any
                                          if (!s) return null

                                          const name = s.name || s.type || 'Sensor'
                                          const sn = s.serial_number ? `SN ${s.serial_number}` : ''
                                          return sn ? `${name} - ${sn}` : name
                                        }).filter(Boolean)

                                        if (standards.length > 0) {
                                          parts.push(standards.join('\n'))
                                        }
                                      }

                                      return parts.join('\n') || '-'
                                    })()}
                                  </td>
                                </tr>
                              )}
                              {nf.traceable_to_si_through && (
                                <tr>
                                  <td className="align-top text-left pr-2 py-0">
                                    <div className="font-bold leading-tight">Tertelusur Ke SI melalui <span className="italic text-[10px] text-gray-900">/ Traceable to SI through</span></div>
                                  </td>
                                  <td className="align-top py-0">:</td>
                                  <td className="align-top whitespace-pre-line py-0">{nf.traceable_to_si_through}</td>
                                </tr>
                              )}
                              {nf.calibration_methode && (
                                <tr>
                                  <td className="align-top text-left pr-2 py-0">
                                    <div className="font-bold leading-tight">Metode Kalibrasi <span className="italic text-[10px] text-gray-900">/ Calibration Methode</span></div>
                                  </td>
                                  <td className="align-top py-0">:</td>
                                  <td className="align-top whitespace-pre-line py-0">{nf.calibration_methode}</td>
                                </tr>
                              )}
                              {nf.reference_document && (
                                <tr>
                                  <td className="align-top text-left pr-2 py-0">
                                    <div className="font-bold leading-tight">Dokumen Acuan <span className="italic text-[10px] text-gray-900">/ Reference Document</span></div>
                                  </td>
                                  <td className="align-top py-0">:</td>
                                  <td className="align-top whitespace-pre-line py-0">{nf.reference_document}</td>
                                </tr>
                              )}
                              {showOthers && (
                                <tr>
                                  <td colSpan={3} className="align-top py-1">
                                    <RichTextCell value={nf.others} className="leading-tight text-[11px] [&_p]:m-0 [&_p+*]:mt-0.5 [&_ul]:mt-0 [&_ol]:mt-0 [&_li]:my-0" />
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}

                    {/* Images */}
                    {station?.type?.toString().trim().toLowerCase() === 'geofisika' && res.images && res.images.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold mb-2">Gambar</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {res.images.map((image: string, imageIndex: number) => (
                            <div key={imageIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                              <img src={image} alt={`Calibration image ${imageIndex + 1}`} className="w-full h-32 object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Verification Info */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Verifikasi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900">Verifikator 1</h4>
              <p className="text-blue-700">{verifikator1?.name || 'Belum ditentukan'}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900">Verifikator 2</h4>
              <p className="text-green-700">{verifikator2?.name || 'Belum ditentukan'}</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-900">Assignor</h4>
              <p className="text-purple-700">{assignor?.name || 'Belum ditentukan'}</p>
            </div>
          </div>
        </div>

        <footer className="mt-6 text-xs">
          <table className="w-full text-black" style={{ borderCollapse: 'collapse', border: 'none', marginBottom: '4px' }}>
            <tbody>
              <tr>
                <td className="align-middle text-right pr-4" style={{ width: '15%' }}>
                    {qrUrl ? (
                      <div className="inline-block w-[70px] h-[70px] bg-white border border-gray-200" style={{ listStyle: 'none', display: 'inline-block' }}>
                        <QRCodeBox
                          key={`qr-${isSigned ? 'signed' : 'unsigned'}`}
                          value={qrUrl}
                          size={70}
                          logoSize={20}
                          fgColor={isSigned ? '#000000' : '#B91C1C'}
                        />
                      </div>
                    ) : (
                        <div className="inline-block w-[70px] h-[70px] bg-transparent" style={{ display: 'inline-block' }}></div>
                    )}
                </td>
                <td className="align-middle" style={{ width: '85%', textAlign: 'justify', lineHeight: '1.2' }}>
                  <div style={{ textJustify: 'inter-word', paddingBottom: '2px', display: 'block' }} className="text-[10px] font-bold">
                    Dokumen ini telah ditandatangani secara elektronik menggunakan Sertifikat Elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), BSSN dan tidak memerlukan tanda tangan atau cap. Dokumen asli dapat diperoleh dengan memindai kode QR di samping ini.
                  </div>
                  <div style={{ textJustify: 'inter-word', display: 'block' }} className="italic text-[9px] font-bold text-gray-800">
                    This document is digitally signed. No signature or seal is required. The original document can be obtained by scanning the QR on the left.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <hr className="my-1" style={{ borderTop: '2px solid black', borderColor: '#000' }} />
          <table className="w-full text-black mt-1" style={{ borderCollapse: 'collapse', border: 'none' }}>
            <tbody>
              <tr>
                <td className="align-top text-left text-[10px] font-bold" style={{ width: '25%' }}>F/IKK 7.8.1</td>
                <td className="align-top text-center text-[9px] font-bold text-gray-800" style={{ width: '50%', lineHeight: '1.2' }}>
                  JL. Angkasa I No. 02 Kemayoran Jakarta Pusat
                  <br />
                  Tlp. 021-4246321-ext 5125; P.O. Box 3540 Jkt; Website : http://www.bmkg.go.id
                </td>
                <td className="align-top text-right text-[10px] font-bold" style={{ width: '25%' }}>Edisi/Revisi : 11/1</td>
              </tr>
            </tbody>
          </table>
        </footer>
      </div>
    </div>
  )
}

// Draft View Component
const DraftView: React.FC<{
  certificate: Certificate
  stations: Station[]
  instruments: Instrument[]
  instrumentNames: any[]
  personel: Personel[]
  onSendToVerifiers: (certificateId: number) => Promise<void>
  onBack?: () => void
  onUpdateCertificate?: (certificateId: number, updates: Partial<Certificate>) => Promise<void>
}> = ({ certificate, stations, instruments, instrumentNames, personel, onSendToVerifiers, onBack, onUpdateCertificate }) => {
  const [showModal, setShowModal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedVerifikator1, setSelectedVerifikator1] = useState(certificate.verifikator_1 || '')
  const [selectedVerifikator2, setSelectedVerifikator2] = useState(certificate.verifikator_2 || '')
  const [selectedVerifikator3, setSelectedVerifikator3] = useState(certificate.verifikator_3 || '')
  const [showQCModal, setShowQCModal] = useState(false)

  const station = stations.find(s => s.id === certificate.station)
  const instrument = instruments.find(i => i.id === certificate.instrument)
  const verifikator1 = personel.find(p => p.id === certificate.verifikator_1)
  const verifikator2 = personel.find(p => p.id === certificate.verifikator_2)
  const verifikator3 = personel.find(p => p.id === certificate.verifikator_3)
  const assignor = personel.find(p => p.id === certificate.assignor)

  const handleSendKonsep = async () => {
    if (isSending || hasSent) return
    // Check if all required fields are assigned
    if (!certificate.verifikator_1 || !certificate.verifikator_2) {
      alert('Harap assign Verifikator 1 dan Verifikator 2 terlebih dahulu!')
      return
    }

    setIsSending(true)
    try {
      await onSendToVerifiers(certificate.id)
      setShowModal(false)
      // Permanently disable after successful send until page navigation
      setHasSent(true)
    } catch (error) {
      console.error('Error sending to verifiers:', error)
      setIsSending(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      // Default behavior - go back to certificates page
      window.location.href = '/certificates'
    }
  }

  const handleSaveAssignments = async () => {
    if (!onUpdateCertificate) return

    try {
      // Send complete certificate data including required fields
      await onUpdateCertificate(certificate.id, {
        no_certificate: certificate.no_certificate,
        no_order: certificate.no_order,
        no_identification: certificate.no_identification,
        issue_date: certificate.issue_date,
        station: certificate.station,
        instrument: certificate.instrument,
        station_address: certificate.station_address,
        results: certificate.results,
        verifikator_1: selectedVerifikator1 || null,
        verifikator_2: selectedVerifikator2 || null,
        verifikator_3: selectedVerifikator3 || null
      })
      setIsEditing(false)

      // Update local state to reflect changes
      certificate.verifikator_1 = selectedVerifikator1 || null
      certificate.verifikator_2 = selectedVerifikator2 || null
      certificate.verifikator_3 = selectedVerifikator3 || null
    } catch (error) {
      console.error('Error updating certificate:', error)
      // Don't close editing mode if there's an error
    }
  }

  // --- Prasyarat untuk KIRIM KONSEP ---
  // Button dikunci sampai semua item di bawah "OK"; banner checklist akan
  // menampilkan step yang kurang beserta tombol shortcut untuk menyelesaikannya.
  const hasVerifikators = !!(certificate.verifikator_1 && certificate.verifikator_2 && certificate.verifikator_3)
  const hasComputedQC   = !!certificate.calibration_computed_at
  const isReadyToSend   = hasVerifikators && hasComputedQC
  // Legacy usage: beberapa bagian kode lain mengecek "assign verifikator".
  const hasBasicAssignments = !!(certificate.verifikator_1 && certificate.verifikator_2)

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Header dengan tombol Kirim Konsep */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Detail Log Sertifikat Kalibrasi</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-600">Status: Draft</p>
            {(certificate as any).calibration_kind && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${(certificate as any).calibration_kind === 'LC' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                {(certificate as any).calibration_kind}
              </span>
            )}
            {(certificate as any).results_frozen_at && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border bg-amber-50 text-amber-700 border-amber-200" title={`Dibekukan: ${new Date((certificate as any).results_frozen_at).toLocaleString('id-ID')}`}>
                🔒 Hasil Dibekukan
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {showPreview ? 'HIDE PREVIEW' : 'PREVIEW'}
          </button> */}

          <button
            onClick={() => {
              const sessionId = firstLegacyResult(certificate.results)?.session_id ?? null;

              if (sessionId) {
                setShowQCModal(true);
              } else {
                alert("Data QC tidak tersedia untuk sertifikat ini. Pastikan sertifikat dibuat/diupdate dengan data mentah baru.");
              }
            }}
            disabled={!!(certificate as any).results_frozen_at}
            title={(certificate as any).results_frozen_at ? 'Hasil kalibrasi sudah dibekukan — tidak bisa diedit ulang' : undefined}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            QC CHECK
          </button>

          {!hasVerifikators && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              ASSIGN VERIFIKATOR
            </button>
          )}
          <button
            onClick={() => { if (!(isSending || hasSent)) setShowModal(true) }}
            disabled={isSending || hasSent || !isReadyToSend}
            title={
              hasSent ? 'Naskah sudah terkirim ke Verifikator' :
              !hasVerifikators ? 'Tentukan dulu Verifikator 1, 2, dan 3 sebelum kirim konsep' :
              !hasComputedQC  ? 'Buka QC CHECK dan klik "Hitung & Input ke Tabel Sertifikat" terlebih dahulu' :
              'Kirim konsep ke verifikator'
            }
            className={`flex items-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${isReadyToSend && !(isSending || hasSent)
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-400 cursor-not-allowed'
              }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {isSending ? 'MENGIRIM...' : hasSent ? 'TERKIRIM' : 'KIRIM KONSEP'}
          </button>
          <button
            onClick={handleBack}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            KEMBALI
          </button>
        </div>
      </div>

      <QCDataModal
        isOpen={showQCModal}
        onClose={() => setShowQCModal(false)}
        title={certificate.no_certificate}
        sessionId={
          firstLegacyResult(certificate.results)?.session_id ?? undefined
        }
        certificateId={String(certificate.id)}
        certificateInstrumentId={certificate.instrument || undefined}
        instruments={instruments}
        sensors={
          // Extract sensors from instruments if available
          instruments.find(i => i.id === certificate.instrument)?.sensor || []
        }
        instrumentNames={instrumentNames}
        certificateStatus={certificate.status}
        onCalculateSaved={async (updates) => {
          if (!onUpdateCertificate) return
          // Merge hasil hitung ke results[] existing berdasarkan sensorId.
          // Struktur results: array of {sensorId, table, ...} per sensor.
          const prev = resultsToLegacyView(certificate.results)
          updates.forEach((u) => {
            const idx = prev.findIndex((r: any) => String(r.sensorId ?? r.sensor_id) === String(u.sensorId))
            if (idx >= 0) {
              prev[idx] = { ...prev[idx], table: u.table }
            } else {
              prev.push({
                sensorId: typeof u.sensorId === 'number' ? u.sensorId : null,
                table: u.table,
              } as any)
            }
          })
          try {
            await onUpdateCertificate(certificate.id, {
              no_certificate:    certificate.no_certificate,
              no_order:          certificate.no_order,
              no_identification: certificate.no_identification,
              issue_date:        certificate.issue_date,
              station:           certificate.station,
              instrument:        certificate.instrument,
              station_address:   certificate.station_address,
              verifikator_1:     certificate.verifikator_1 ?? null,
              verifikator_2:     certificate.verifikator_2 ?? null,
              verifikator_3:     certificate.verifikator_3 ?? null,
              results:           prev,
              // Tandai: user sudah menjalankan "Hitung & Input Tabel ke Sertifikat".
              // Ini yang akan unlock tombol KIRIM KONSEP di header.
              calibration_computed_at: new Date().toISOString(),
            })
            // Sync local state supaya UI button re-evaluasi tanpa tunggu reload.
            ;(certificate as any).results = prev
            ;(certificate as any).calibration_computed_at = new Date().toISOString()
          } catch (err) {
            console.error('Gagal menyimpan hasil QC ke sertifikat:', err)
          }
        }}
      />

      {/* Checklist prasyarat KIRIM KONSEP.
          - Tampil HANYA saat masih ada item yang belum tuntas (!isReadyToSend)
            agar tidak menambah noise saat semua sudah siap.
          - Tiap item yang belum tuntas punya tombol shortcut supaya user
            tidak perlu menebak aksi selanjutnya. */}
      {!isReadyToSend ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.73 4a2 2 0 00-3.46 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Belum bisa kirim konsep — selesaikan langkah berikut:</p>
              <ul className="mt-2 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {hasVerifikators ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">!</span>
                  )}
                  <span className={hasVerifikators ? 'text-gray-700 line-through' : 'text-gray-800 font-medium'}>
                    Tentukan Verifikator 1, 2, dan 3
                  </span>
                  {!hasVerifikators && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="ml-2 inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                    >
                      Assign sekarang →
                    </button>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  {hasComputedQC ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">!</span>
                  )}
                  <span className={hasComputedQC ? 'text-gray-700 line-through' : 'text-gray-800 font-medium'}>
                    Hitung &amp; Input Tabel ke Sertifikat di QC Check Data
                  </span>
                  {!hasComputedQC && (
                    <button
                      onClick={() => {
                        const sessionId = firstLegacyResult(certificate.results)?.session_id ?? null
                        if (sessionId) {
                          setShowQCModal(true)
                        } else {
                          alert('Data QC tidak tersedia untuk sertifikat ini. Pastikan sertifikat dibuat/diupdate dengan data mentah baru.')
                        }
                      }}
                      className="ml-2 inline-flex items-center text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
                    >
                      Buka QC Check →
                    </button>
                  )}
                </li>
              </ul>
              {hasComputedQC && (
                <p className="mt-2 text-[11px] text-gray-500 italic">
                  Tabel sertifikat terakhir dihitung pada {new Date(certificate.calibration_computed_at!).toLocaleString('id-ID')}.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-900">Siap dikirim</p>
              <p className="text-xs text-green-700">
                Semua prasyarat terpenuhi. Klik <span className="font-semibold">KIRIM KONSEP</span> di kanan atas untuk melanjutkan ke verifikator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Nomor Referensi:</span>
            <span className="text-gray-900">{certificate.no_certificate || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Nomor Order:</span>
            <span className="text-gray-900">{certificate.no_order || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Nomor Identifikasi:</span>
            <span className="text-gray-900">{certificate.no_identification || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Tanggal Terbit:</span>
            <span className="text-gray-900">
              {new Date(certificate.issue_date).toLocaleDateString('id-ID')}
            </span>
          </div>
        </div>

        {/* Station & Instrument Info */}
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Stasiun:</span>
            <span className="text-gray-900">{station?.name || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Instrumen:</span>
            <span className="text-gray-900">{instrument?.name || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Verifikator 1:</span>
            <span className="text-gray-900">{verifikator1?.name || 'Belum ditentukan'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Verifikator 2:</span>
            <span className="text-gray-900">{verifikator2?.name || 'Belum ditentukan'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium text-gray-600">Verifikator 3:</span>
            <span className="text-gray-900">{verifikator3?.name || 'Belum ditentukan'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium text-gray-600">Assignor:</span>
            <span className="text-gray-900">{assignor?.name || 'Belum ditentukan'}</span>
          </div>
        </div>
      </div>

      {/* Assignment Form */}
      {isEditing && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Assign Verifikator</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verifikator 1</label>
              <select
                value={selectedVerifikator1}
                onChange={(e) => setSelectedVerifikator1(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Verifikator 1</option>
                {personel.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verifikator 2</label>
              <select
                value={selectedVerifikator2}
                onChange={(e) => setSelectedVerifikator2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Verifikator 2</option>
                {personel.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verifikator 3</label>
              <select
                value={selectedVerifikator3}
                onChange={(e) => setSelectedVerifikator3(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Verifikator 3</option>
                {personel.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAssignments}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {showPreview && (
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Sertifikat</h3>
            <p className="text-sm text-gray-600">Tampilan sertifikat seperti yang akan dilihat verifikator</p>
          </div>

          <CertificatePreview
            certificate={certificate}
            stations={stations}
            instruments={instruments}
            personel={personel}
          />
        </div>
      )}

      {/* Modal */}
      <KirimNaskahModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleSendKonsep}
        certificate={certificate}
        verifikator1={verifikator1 || null}
        verifikator2={verifikator2 || null}
        verifikator3={verifikator3 || null}
        assignor={assignor || null}
        confirmDisabled={isSending || hasSent}
      />
    </div>
  )
}

// Main Draft View Page Component
const DraftViewPage: React.FC = () => {
  const router = useRouter()
  const { user } = useAuth()
  const { certificates, loading, error } = useCertificates()
  const { showAlert } = useAlert()
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrumentNames, setInstrumentNames] = useState<any[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])
  const [selectedCertificateId, setSelectedCertificateId] = useState<number | null>(null)

  // Get certificate ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const certificateId = urlParams.get('certificate')
    if (certificateId) {
      setSelectedCertificateId(parseInt(certificateId))
    }
  }, [])

  // Load additional data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [stationsRes, instrumentsRes, personelRes, instrNamesRes] = await Promise.all([
          fetch('/api/stations?page=1&pageSize=100'),
          fetch('/api/instruments?page=1&pageSize=100'),
          fetch('/api/personel'),
          fetch('/api/instrument-names')
        ])

        const stationsData = await stationsRes.json()
        const instrumentsData = await instrumentsRes.json()
        const personelData = await personelRes.json()
        const instrNamesData = await instrNamesRes.json()

        setStations(Array.isArray(stationsData) ? stationsData : (stationsData?.data ?? []))
        setInstruments(Array.isArray(instrumentsData) ? instrumentsData : (instrumentsData?.data ?? []))
        setPersonel(Array.isArray(personelData) ? personelData : [])
        setInstrumentNames(Array.isArray(instrNamesData) ? instrNamesData : (instrNamesData?.data ?? []))
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

  const handleSendToVerifiers = async (certificateId: number) => {
    try {
      if (!user?.id) {
        throw new Error('User ID is required')
      }

      const response = await fetch(`/api/certificates/${certificateId}/send-to-verifiers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sent_by: user.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send to verifiers')
      }

      showAlert({ type: 'success', message: 'Sertifikat berhasil dikirim ke verifikator!' })

      // Redirect back to certificates page after successful send
      router.push('/certificates')
    } catch (error) {
      console.error('Error sending to verifiers:', error)
      showAlert({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengirim ke verifikator' })
      throw error
    }
  }

  const handleUpdateCertificate = async (certificateId: number, updates: Partial<Certificate>) => {
    try {
      // Get session from Supabase client
      const { data: { session } } = await supabase.auth.getSession()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add authorization header if session exists
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(`/api/certificates/${certificateId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        let errorMessage = 'Failed to update certificate'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Try to parse response as JSON
      let responseData
      try {
        responseData = await response.json()
      } catch (jsonError) {
        // If response is not JSON, just return success
        responseData = { success: true }
      }

      showAlert({ type: 'success', message: 'Sertifikat berhasil diperbarui!' })
      return responseData
    } catch (error) {
      console.error('Error updating certificate:', error)
      showAlert({ type: 'error', message: error instanceof Error ? error.message : 'Gagal memperbarui sertifikat' })
      throw error
    }
  }

  const handleBack = () => {
    // If came from specific certificate, go back to certificates page
    if (selectedCertificateId) {
      router.push('/certificates')
    } else {
      // If viewing all drafts, go back to certificates page
      router.push('/certificates')
    }
  }

  // Filter draft certificates
  const draftCertificates = certificates.filter(cert => cert.status === 'draft')

  // If specific certificate is selected, show only that one
  const certificatesToShow = selectedCertificateId
    ? draftCertificates.filter(cert => cert.id === selectedCertificateId)
    : draftCertificates

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading draft certificates...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]" suppressHydrationWarning>
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Draft View</h1>
              <p className="text-gray-600">Kelola sertifikat dalam status draft sebelum dikirim ke verifikator</p>
            </div>

            {certificatesToShow.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📄</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {selectedCertificateId ? 'Sertifikat tidak ditemukan' : 'Tidak ada draft sertifikat'}
                </h3>
                <p className="text-gray-600">
                  {selectedCertificateId
                    ? 'Sertifikat yang dipilih tidak ada atau bukan dalam status draft.'
                    : 'Semua sertifikat sudah dikirim atau belum ada yang dibuat.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {certificatesToShow.map((certificate) => (
                  <DraftView
                    key={certificate.id}
                    certificate={certificate}
                    stations={stations}
                    instruments={instruments}
                    instrumentNames={instrumentNames}
                    personel={personel}
                    onSendToVerifiers={handleSendToVerifiers}
                    onBack={handleBack}
                    onUpdateCertificate={handleUpdateCertificate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default DraftViewPage
