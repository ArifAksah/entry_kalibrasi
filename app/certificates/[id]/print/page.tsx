'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import QRCodeStyling from 'qr-code-styling'
import QRCode from 'react-qr-code'
import bmkgLogo from '../../../bmkg.png' // Pastikan path logo ini benar

// --- TIPE DATA KOMPREHENSIF ---
// Saya gabungkan tipe dari ViewCertificatePage.tsx Anda ke sini
// agar kita memiliki akses ke cert.results, verifikator, dll.

type KV = { key: string; value: string }
type TableRow = { key: string; unit: string; value: string; extraValues?: string[] }
type TableSection = { title: string; headers?: string[]; rows: TableRow[] }
type ResultItem = {
  sensorId: number | null
  startDate: string
  endDate: string
  place: string
  environment: KV[]
  table: TableSection[] // Catatan: Tipe ini mungkin perlu disesuaikan untuk Tabel 1
  notesForm: {
    traceable_to_si_through: string;
    reference_document: string;
    calibration_methode: string;
    others: string;
    standardInstruments: number[]
  }
  sensorDetails?: any
}

type Cert = {
  id: number
  no_certificate: string
  no_order: string
  no_identification: string
  issue_date: string
  station: number | null
  instrument: number | null
  authorized_by: string | null
  verifikator_1?: string | null
  verifikator_2?: string | null
  verifikator_3?: string | null
  station_address?: string | null
  results?: ResultItem[] // Menambahkan results di sini
  version?: number
  public_id?: string // Added for public verification
}

type Station = {
  id: number
  name: string
  station_id: string
  address?: string | null
  type?: string | null
  // ... (sisa properti Station)
}
type Instrument = {
  id: number
  name: string
  manufacturer: string
  type: string
  serial_number: string
  others?: string | null
  station_id?: number | null
  memiliki_lebih_satu?: boolean
  created_at?: string
  station?: { id: number; name: string } | null
}
type Personel = { id: string; name: string | null }

// --- Komponen Label Helper ---
// Untuk meniru format label di PDF (Indo bold + English italic)
const PdfLabel: React.FC<{ indo: string; eng: string; className?: string }> = ({ indo, eng, className = '' }) => (
  <div className={`leading-tight ${className}`}>
    <div className="cert-text-id">{indo}</div>
    <div className="cert-text-en">{eng}</div>
  </div>
)

// --- Komponen QR Code dengan styling (modules/finder) dan logo BMKG di tengah ---
const QRCodeWithBMKGLogo: React.FC<{
  value: string;
  size: number;
  logoSize?: number;
  className?: string;
  fgColor?: string; // warna modul (merah/hitam)
  onRendered?: () => void; // Callback ketika QR code selesai di-render
}> = ({ value, size, logoSize = 16, className = '', fgColor = '#000000', onRendered }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)
  const renderedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Reset rendered flag when value or color changes
    renderedRef.current = false

    const renderQR = () => {
      if (!containerRef.current) return

      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling({
          width: size,
          height: size,
          type: 'canvas',
          data: value || ' ',
          backgroundOptions: { color: '#FFFFFF' },
          dotsOptions: { color: fgColor || '#000000', type: 'square' },
          cornersSquareOptions: { color: '#000000', type: 'square' },
          cornersDotOptions: { color: '#000000' },
          image: bmkgLogo.src,
          imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: logoSize / size },
          margin: 6,
        })
        qrRef.current.append(containerRef.current)
      } else {
        qrRef.current.update({
          width: size,
          height: size,
          data: value || ' ',
          type: 'canvas',
          dotsOptions: { color: fgColor || '#000000', type: 'square' },
          cornersSquareOptions: { color: '#000000', type: 'square' },
          cornersDotOptions: { color: '#000000' },
          image: bmkgLogo.src,
          imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: logoSize / size },
          margin: 6,
        })
      }

      // Wait for canvas/SVG to be rendered in DOM
      // Use multiple strategies to ensure QR code is ready
      let retryCount = 0
      const maxRetries = 20 // Max 20 retries = 1000ms

      const checkRendered = () => {
        if (!containerRef.current) {
          if (retryCount < maxRetries) {
            retryCount++
            setTimeout(checkRendered, 50)
          } else {
            // Force callback after max retries
            renderedRef.current = true
            if (onRendered) onRendered()
          }
          return
        }

        // Check if canvas or SVG exists in container
        const hasCanvas = containerRef.current.querySelector('canvas')
        const hasSvg = containerRef.current.querySelector('svg')

        if ((hasCanvas || hasSvg) && !renderedRef.current) {
          renderedRef.current = true
          // Give a small delay to ensure canvas is fully painted
          setTimeout(() => {
            if (onRendered) onRendered()
          }, 100)
        } else if (!hasCanvas && !hasSvg) {
          // Retry if not yet rendered
          if (retryCount < maxRetries) {
            retryCount++
            setTimeout(checkRendered, 50)
          } else {
            // Force callback after max retries (fallback)
            renderedRef.current = true
            if (onRendered) onRendered()
          }
        }
      }

      // Start checking after a short delay to allow append/update to complete
      setTimeout(checkRendered, 150)
    }

    renderQR()
  }, [value, size, fgColor, logoSize, onRendered])

  return <div className={className} ref={containerRef} />
}

const FooterQRCode: React.FC<{
  value: string;
  size?: number;
  fgColor?: string;
  onRendered?: () => void;
}> = ({ value, size = 52, fgColor = '#000000', onRendered }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => onRendered?.(), 0)
    return () => window.clearTimeout(timer)
  }, [value, fgColor, onRendered])

  return (
    <div className="footer-qr-rendered" style={{ width: size, height: size, position: 'relative', background: '#fff' }}>
      <QRCode value={value || ' '} size={size} bgColor="#FFFFFF" fgColor={fgColor} level="H" />
      <img
        src={bmkgLogo.src}
        alt=""
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: Math.round(size * 0.28),
          height: Math.round(size * 0.28),
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          padding: 2,
        }}
      />
    </div>
  )
}

const PrintCertificatePage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cert, setCert] = useState<Cert | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [instrumentNames, setInstrumentNames] = useState<any[]>([])
  const [isSigned, setIsSigned] = useState<boolean>(false)
  const [verificationLoaded, setVerificationLoaded] = useState<boolean>(false)
  const hasPrintedRef = useRef<boolean>(false)
  const qrRenderedCountRef = useRef<number>(0)
  const expectedQRCodesRef = useRef<number>(0)
  const [allRawData, setAllRawData] = useState<any[]>([])

  const computeEnvCondition = useCallback((type: 'suhu' | 'kelembaban', sensorRawData: any[]): string => {
    const keywords = type === 'suhu'
      ? ['suhu', 'temp', 'termometer', 'temperature', 'thermo']
      : ['kelembab', 'hum', 'hygro', 'rh'];

    const matchedRows = sensorRawData.filter(r => {
      const name = (r.sheet_name || '').toLowerCase();
      return keywords.some(k => name.includes(k));
    });

    if (matchedRows.length === 0) return '-';

    const values = matchedRows
      .map(r => r.std_corrected ?? (r.standard_data + (r.std_correction ?? 0)))
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return '-';

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const mean = (minV + maxV) / 2;
    const halfRange = maxV - mean;

    const unit = type === 'suhu' ? '°C' : '%';
    return `(${mean.toFixed(1)} ± ${halfRange.toFixed(1)}) ${unit}`;
  }, []);


  // Helper to resolve canonical sensor name
  const resolveSensorName = useCallback((res: any, fallbackIndex: number) => {
    const sd = res?.sensorDetails || {}
    const sensorRecord = sensors.find((s: any) => s.id === res?.sensorId)
    let canonicalName = undefined
    if (sensorRecord?.sensor_name_id) {
      canonicalName = instrumentNames.find((n: any) => n.id === sensorRecord.sensor_name_id)?.name
    }
    // Priority: canonical name from instrument_names table > sensorDetails.name fallback
    return canonicalName || sensorRecord?.name || sd.name || sd.type || `Sensor ${fallbackIndex + 1}`
  }, [sensors, instrumentNames])

  // Menggunakan useMemo untuk data turunan
  const station = useMemo(() => stations.find(s => s.id === (cert?.station ?? -1)) || null, [stations, cert])
  const resolvedStationAddress = useMemo(() => (cert?.station_address ?? null) || (station?.address ?? null), [cert, station])
  const instrument = useMemo(() => instruments.find(i => i.id === (cert?.instrument ?? -1)) || null, [instruments, cert])
  const authorized = useMemo(() => personel.find(p => p.id === (cert?.authorized_by ?? '')) || null, [personel, cert])
  const verifikator1 = useMemo(() => personel.find(p => p.id === (cert?.verifikator_1 ?? '')) || null, [personel, cert])
  const verifikator2 = useMemo(() => personel.find(p => p.id === (cert?.verifikator_2 ?? '')) || null, [personel, cert])
  const verifikator3 = useMemo(() => personel.find(p => p.id === (cert?.verifikator_3 ?? '')) || null, [personel, cert])

  // Data hasil kalibrasi (normalize ke array)
  const results = useMemo(() => {
    const r: any = (cert as any)?.results
    if (!r) return []
    try {
      return typeof r === 'string' ? JSON.parse(r) : r
    } catch {
      return []
    }
  }, [cert])
  const resultData = useMemo(() => (results && results.length > 0 ? results[0] : null), [results])

  // Ringkasan sensor untuk field "Lain-lain / Others" di halaman 1
  const sensorsSummary = useMemo(() => {
    if (!results || results.length === 0) return ''
    const lines = results.map((res: any, i: number) => {
      const sd = res?.sensorDetails || {}
      const name = resolveSensorName(res, i)
      const manufacturer = sd.manufacturer || '-'
      const type = sd.type || '-'
      const serial = sd.serial_number || '-'
      return `${i + 1}. ${name} : ${manufacturer} / ${type} / ${serial}`
    })
    return `terdiri dari beberapa sensor yaitu:\n` + lines.join('\n')
  }, [results])

  // Generate QR code URL to public verification page
  const qrCodeData = useMemo(() => {
    if (!cert) return ''

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    // Use public_id if available for secure verification
    if (cert.public_id) {
      return `${baseUrl}/verify/${cert.public_id}`
    }

    // Fallback to certificate number if public_id is missing (legacy)
    if (cert.no_certificate) {
      return `${baseUrl}/verify/${encodeURIComponent(cert.no_certificate)}`
    }

    return ''
  }, [cert])

  // Total pages: 1 (cover) + max(1, N per sensor). No separate closing page.
  const totalPrintedPages = useMemo(() => 1 + Math.max(1, results?.length ?? 0), [results])

  useEffect(() => {
    const id = Number(params.id)
    if (!id) {
      setError('Invalid certificate id')
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        // Fetch certificate dan personel
        const [cRes, pRes, sRes, inRes] = await Promise.all([
          fetch(`/api/certificates/${id}`),
          fetch('/api/personel'),
          fetch('/api/sensors'),
          fetch('/api/instrument-names'),
        ])
        const c = await cRes.json()
        const p = await pRes.json()

        if (sRes.ok) {
          const sData = await sRes.json()
          setSensors(Array.isArray(sData) ? sData : (sData?.data ?? []))
        }

        if (inRes.ok) {
          const inData = await inRes.json()
          setInstrumentNames(Array.isArray(inData) ? inData : (inData?.data ?? []))
        }

        if (!cRes.ok) throw new Error(c?.error || 'Failed to load certificate')
        setCert(c)

        if (c?.results) {
          try {
            const parsedResults = typeof c.results === 'string' ? JSON.parse(c.results) : c.results;
            const sessionIds = parsedResults.map((r: any) => r.session_id).filter(Boolean);
            if (sessionIds.length > 0) {
              const rawDataPromises = sessionIds.map((sid: string) =>
                fetch(`/api/raw-data?session_id=${sid}`).then(res => res.ok ? res.json() : { data: [] })
              );
              const allRawDataResp = await Promise.all(rawDataPromises);
              const mergedRawData = allRawDataResp.flatMap(resp => resp.data || []);
              setAllRawData(mergedRawData);
            }
          } catch (e) {
            console.error("Failed to fetch raw data for print", e);
          }
        }

        const personelData = Array.isArray(p) ? p : []
        setPersonel(personelData)

        // Fetch instruments dengan pagination lengkap
        try {
          const first = await fetch('/api/instruments?page=1&pageSize=100')
          if (first.ok) {
            const fj = await first.json()
            const firstData = Array.isArray(fj) ? fj : (fj?.data ?? [])
            const totalPages = (Array.isArray(fj) ? 1 : (fj?.totalPages ?? 1)) as number
            if (totalPages <= 1) {
              setInstruments(firstData)
            } else {
              const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(p => fetch(`/api/instruments?page=${p}&pageSize=100`).then(r => r.ok ? r.json() : { data: [] })))
              const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
              setInstruments([...firstData, ...restData])
            }
          }
        } catch { }

        // Fetch stations (logika Anda sudah benar)
        try {
          const first = await fetch('/api/stations?page=1&pageSize=100')
          if (first.ok) {
            const fj = await first.json()
            const firstData = Array.isArray(fj) ? fj : (fj?.data ?? [])
            const totalPages = (Array.isArray(fj) ? 1 : (fj?.totalPages ?? 1)) as number
            if (totalPages <= 1) {
              setStations(firstData)
            } else {
              const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(p => fetch(`/api/stations?page=${p}&pageSize=100`).then(r => r.ok ? r.json() : { data: [] })))
              const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
              setStations([...firstData, ...restData])
            }
          }
        } catch { }

      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  // Cek status verifikasi Level 3 untuk warna QR (merah jika belum, hitam jika sudah)
  const checkVerificationStatus = async () => {
    try {
      if (!cert?.id) return

      // If we are in simulation mode (signed=true), don't fetch from API
      // This prevents the API result (which might still be pending) from overwriting our forced state
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('signed') === 'true') {
        console.log('📝 [Print] Skipping verification check due to signed=true parameter')
        setVerificationLoaded(true)
        return
      }

      // Use certificate ID for API call to ensure uniqueness
      const res = await fetch(`/api/verify-certificate?id=${cert.id}`)
      if (res.ok) {
        const data = await res.json()
        console.log('🔍 [Print] verify-certificate response:', data)
        console.log('🔍 [Print] data.valid:', data?.valid)
        console.log('🔍 [Print] data.verification:', data?.verification)
        // QR hitam jika Level 3 approved (valid true) - tanpa pembatasan versi
        setIsSigned(!!data?.valid)
        console.log('🎨 [Print] QR color will be:', !!data?.valid ? 'BLACK (#000000)' : 'RED (#B91C1C)')
      }
    } catch (err) {
      console.error('❌ [Print] verify-certificate error:', err)
      // abaikan error; pada simulasi pun jangan paksa hitam agar tidak salah status
    } finally {
      setVerificationLoaded(true)
    }
  }

  useEffect(() => {
    checkVerificationStatus()
  }, [cert?.id])

  // Listen for storage events to refresh QR status when signing happens
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'certificate_signed' && e.newValue) {
        const signedData = JSON.parse(e.newValue)
        if (signedData.certificateId === cert?.id) {
          console.log('🔔 [Print] Certificate was signed, refreshing QR status...')
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
  }, [cert?.id])

  // Calculate expected QR codes: 1 for cover + 1 for each result page footer (or 1 for empty page footer)
  useEffect(() => {
    if (!cert || !results) return
    const coverQR = qrCodeData ? 1 : 0
    // Each result page has 1 QR in footer; empty page also has 1 QR in footer
    const resultPageQRs = qrCodeData ? Math.max(1, results.length) : 0
    expectedQRCodesRef.current = coverQR + resultPageQRs
    qrRenderedCountRef.current = 0 // Reset counter when results change
  }, [cert, results, qrCodeData])

  // Callback ketika QR code selesai di-render
  const handleQRRendered = useCallback(() => {
    qrRenderedCountRef.current += 1
    console.log(`[Print] QR code rendered: ${qrRenderedCountRef.current}/${expectedQRCodesRef.current}`)
  }, [])

  // Check if download or PDF parameter is present
  const [isDownloadMode, setIsDownloadMode] = useState(false)
  const [isPdfMode, setIsPdfMode] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setIsDownloadMode(urlParams.get('download') === 'true')
    setIsPdfMode(urlParams.get('pdf') === 'true')

    // Check for signed simulation parameter
    if (urlParams.get('signed') === 'true') {
      console.log('📝 [Print] Simulation mode: Forcing signed status (BLACK QR)')
      setIsSigned(true)
      // Mark verification as loaded since we're forcing it
      setVerificationLoaded(true)
    }
  }, [])

  // Panggil print hanya setelah data, verifikasi, dan semua QR code siap
  // Auto-print jika ada parameter download=true
  useEffect(() => {
    if (loading) return
    if (!cert) return
    if (!verificationLoaded) return
    if (hasPrintedRef.current) return

    // Only auto-print if download mode is enabled
    if (!isDownloadMode) return

    // If no QR codes expected, print immediately
    if (expectedQRCodesRef.current === 0) {
      hasPrintedRef.current = true
      const t = setTimeout(() => {
        window.print()
      }, 500)
      return () => clearTimeout(t)
    }

    // Wait for all QR codes to be rendered
    const checkAllQRRendered = () => {
      if (qrRenderedCountRef.current >= expectedQRCodesRef.current) {
        hasPrintedRef.current = true
        console.log('[Print] All QR codes rendered, calling window.print()')
        // Give extra time to ensure canvas is fully painted
        setTimeout(() => {
          window.print()
        }, 500)
      } else {
        // Retry after a short delay
        setTimeout(checkAllQRRendered, 100)
      }
    }

    // Start checking after initial render delay
    const t = setTimeout(() => {
      checkAllQRRendered()
    }, 1000)

    return () => clearTimeout(t)
  }, [loading, cert, verificationLoaded, handleQRRendered, isDownloadMode])

  if (loading) return <div className="p-8 text-gray-600 text-center text-lg">Memuat data sertifikat untuk dicetak...</div>
  if (error || !cert) return <div className="p-8 text-red-600 text-center text-lg">Gagal memuat data: {error || 'Sertifikat tidak ditemukan'}</div>

  // --- STYLING UNTUK PRINT ---
  // Ini adalah bagian penting untuk membuat layout A4
  // Kita menggunakan <style> agar bisa mengatur @page dan print media queries
  const A4Style = `
    @import url('https://fonts.googleapis.com/css2?family=Arial:wght@400;700&display=swap');
    
    /* Global reset for all list styles */
    * {
      list-style: none !important;
      list-style-type: none !important;
      list-style-position: outside !important;
      list-style-image: none !important;
    }
    
    *::marker {
      display: none !important;
      content: none !important;
      color: transparent !important;
      font-size: 0 !important;
    }
    
    ul, ol, li {
      list-style: none !important;
      list-style-type: none !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
      text-indent: 0 !important;
    }
    
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background-color: #fff;
      list-style: none !important;
    }
    
    .print-container {
      font-family: 'Arial', sans-serif;
      background: white;
      color: #000;
      list-style: none !important;
    }

    .print-container,
    .print-container * {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
      color: #000 !important;
    }

    .cert-title-id {
      font-size: 20px !important;
      line-height: 1.15 !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      color: #000 !important;
    }

    .cert-title-en {
      font-size: 7px !important;
      line-height: 1.2 !important;
      font-weight: 700 !important;
      font-style: italic !important;
      color: #000 !important;
    }

    .cert-text-id,
    .cert-info-text,
    .cert-info-text td {
      font-size: 11px !important;
      line-height: 1.25 !important;
      font-weight: 700 !important;
      color: #000 !important;
    }

    .cert-text-en {
      font-size: 7px !important;
      line-height: 1.15 !important;
      font-weight: 700 !important;
      font-style: italic !important;
      color: #000 !important;
    }
    
    .page-container {
      width: 210mm;
      /* Jangan pakai min-height tetap agar tidak melebihi tinggi A4 saat ditambah padding */
      min-height: auto;
      padding: 5mm; /* Batas tepi kerja sesuai rujukan */
      padding-bottom: 35mm; /* Ruang untuk footer static (halaman cover) */
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
      /* Jangan paksa page break di semua container; kita atur manual di elemen tertentu */
    }
    
    /* Halaman hasil kalibrasi (dengan QR footer) butuh padding konsisten */
    .page-container.results-page {
      padding: 0 5mm 25mm 5mm;
      min-height: 297mm;
      box-sizing: border-box;
      position: relative;
    }
    /* Remove default cell padding from thead, handle spacing inside */
    .page-container.results-page thead.print-repeat-header > tr > td {
      padding: 5mm 0 0 0 !important;
    }
    /* Minimal top padding for tbody content */
    .page-container.results-page tbody.print-content > tr > td {
      padding-top: 2mm !important;
    }
    
    /* Footer khusus untuk halaman 1 saja */
    .page-1-footer {
      position: absolute !important;
      bottom: 5mm !important;
      left: 5mm !important;
      right: 5mm !important;
      z-index: 1000 !important;
      list-style-type: none !important;
      list-style: none !important;
      list-style-position: outside !important;
    }
    
    /* Prevent any unwanted circles or bullets in footer */
    .page-1-footer,
    .page-1-footer * {
      list-style-type: none !important;
      list-style: none !important;
      list-style-position: outside !important;
      list-style-image: none !important;
      background: transparent !important;
      background-image: none !important;
      outline: none !important;
      text-indent: 0 !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
    }
    
    .page-1-footer *::marker {
      display: none !important;
      content: none !important;
      color: transparent !important;
    }
    
    .page-1-footer *::before,
    .page-1-footer *::after {
      content: none !important;
      display: none !important;
      background: transparent !important;
      background-image: none !important;
      width: 0 !important;
      height: 0 !important;
      visibility: hidden !important;
    }
    
    /* Ensure no unwanted shapes appear */
    .page-1-footer span,
    .page-1-footer div {
      position: relative !important;
      display: inline-block !important;
    }
    
    .page-1-footer span::before,
    .page-1-footer span::after,
    .page-1-footer div::before,
    .page-1-footer div::after,
    .page-1-footer span::marker,
    .page-1-footer div::marker {
      content: none !important;
      display: none !important;
      visibility: hidden !important;
    }
    
    /* QR code kecil di footer halaman 2+ (TIDAK di halaman cover) */
    /* Default: sembunyikan semua QR code kecil */
    .footer-qr-small {
      display: none !important;
      visibility: hidden !important;
    }
    
    /* Show QR code kecil HANYA di halaman hasil kalibrasi (halaman 2+) */
    /* Gunakan absolute positioning dengan page-container yang memiliki min-height A4 */
    .page-container.results-page {
      position: relative !important;
      min-height: 297mm !important; /* Tinggi A4 */
    }
    
    /* Hanya tampilkan di page-container dengan class results-page */
    /* QR code akan selalu di footer karena parent memiliki min-height penuh */
    .page-container.results-page .footer-qr-small.results-page-qr {
      position: absolute !important;
      bottom: 4mm !important;
      left: 4mm !important;
      width: 100px !important;
      height: 100px !important;
      z-index: 999 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* PASTIKAN tidak muncul di halaman cover - halaman cover TIDAK punya class .results-page */
    .page-container:not(.results-page) .footer-qr-small,
    .page-container:first-of-type .footer-qr-small,
    .page-container:not(.results-page) .results-page-qr {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }

    .bsre-result-footer {
      display: grid;
      grid-template-columns: 16mm minmax(0, 1fr);
      column-gap: 10mm;
      align-items: start;
      width: 100%;
      padding-top: 2mm;
      color: #000;
    }

    .bsre-footer-qr {
      width: 16mm;
      height: 16mm;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: #fff;
      transform: translateY(-4mm);
    }

    .bsre-footer-qr .qr-code-container {
      width: 52px !important;
      height: 52px !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      overflow: visible !important;
    }

    .bsre-footer-qr .qr-code-container canvas,
    .bsre-footer-qr .qr-code-container svg {
      display: block !important;
      width: 52px !important;
      height: 52px !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .bsre-footer-qr .footer-qr-rendered,
    .bsre-footer-qr .footer-qr-rendered svg,
    .bsre-footer-qr .footer-qr-rendered img {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .bsre-footer-content {
      padding-top: 2mm;
      min-width: 0;
    }

    .bsre-footer-line {
      border-top: 1px solid #000;
      width: 100%;
      height: 0;
      margin: 0 0 1mm;
    }

    .bsre-footer-page {
      text-align: center;
      font-size: 11px;
      line-height: 1;
      margin-bottom: 2mm;
      font-weight: 400;
    }

    .bsre-footer-text {
      text-align: center;
      font-size: 10px;
      line-height: 1.25;
      font-weight: 400;
      color: #000;
    }
    
    /* Hapus aturan last-child; break diatur manual dengan kelas */
    
    @page {
      size: A4;
      margin: 0;
    }
    
    @media print {
      /* Global reset for all list styles in print mode */
      * {
        list-style: none !important;
        list-style-type: none !important;
        list-style-position: outside !important;
        list-style-image: none !important;
      }
      
      *::marker {
        display: none !important;
        content: none !important;
        color: transparent !important;
        font-size: 0 !important;
      }
      
      ul, ol, li {
        list-style: none !important;
        list-style-type: none !important;
        padding-left: 0 !important;
        margin-left: 0 !important;
        text-indent: 0 !important;
      }
      
      body {
        margin: 0;
        padding: 0;
        list-style: none !important;
      }
      .print-container {
        margin: 0;
        padding: 0;
        list-style: none !important;
      }
      .page-container {
        margin: 0;
        padding: 5mm; /* Batas tepi kerja sesuai rujukan */
        padding-bottom: 25mm; /* Ruang footer halaman cover */
        border: none !important;
        box-shadow: none !important;
        page-break-after: auto; /* Jangan paksa break di akhir container */
        break-after: auto;
      }
      
      /* Halaman hasil kalibrasi (dengan QR footer) butuh padding lebih untuk QR code */
      .page-container.results-page {
        min-height: 297mm !important;
        height: 297mm !important;
        padding: 0 5mm 25mm 5mm !important;
        box-sizing: border-box !important;
        position: relative !important;
      }
      /* Table must fill full height so tfoot sits at page bottom */
      .page-container.results-page table.repeatable-page-table {
        height: 100% !important;
      }
      /* thead td handles top margin itself */
      .page-container.results-page thead.print-repeat-header > tr > td {
        padding: 5mm 0 0 0 !important;
      }
      /* Remove top padding from first tbody cell */
      .page-container.results-page tbody.print-content > tr > td {
        padding-top: 2mm !important;
      }
      
      .page-container.cover-page {
        height: 297mm !important; /* Force exact physical A4 height explicitly on print */
        max-height: 297mm !important;
        position: relative !important;
      }
      
      /* Hindari page break setelah container terakhir */
      .page-container:last-of-type {
        page-break-after: avoid;
        break-after: avoid;
      }
      
      /* Footer halaman 1 tetap static di mode print, jangan gunakan fixed karena akan duplikat di semua halaman */
      .page-1-footer {
        position: absolute !important;
        bottom: 5mm !important;
        left: 5mm !important;
        right: 5mm !important;
        z-index: 1000 !important;
        background-color: white !important; /* Tutupi elemen fixed di belakangnya */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding-top: 20px !important; /* Make white mask taller */
        padding-bottom: 20px !important;
        margin-bottom: -10px !important;
        list-style-type: none !important;
        list-style: none !important;
        list-style-position: outside !important;
      }
      
      /* Prevent any unwanted circles or bullets in footer */
      .page-1-footer,
      .page-1-footer * {
        list-style-type: none !important;
        list-style: none !important;
        list-style-position: outside !important;
        list-style-image: none !important;
        background: transparent !important;
        background-image: none !important;
        outline: none !important;
        text-indent: 0 !important;
        padding-left: 0 !important;
        margin-left: 0 !important;
      }
      
      .page-1-footer *::marker {
        display: none !important;
        content: none !important;
        color: transparent !important;
      }
      
      .page-1-footer *::before,
      .page-1-footer *::after {
        content: none !important;
        display: none !important;
        background: transparent !important;
        background-image: none !important;
        width: 0 !important;
        height: 0 !important;
        visibility: hidden !important;
      }
      
      /* Ensure no unwanted shapes appear */
      .page-1-footer span,
      .page-1-footer div {
        position: relative !important;
        display: inline-block !important;
      }
      
      .page-1-footer span::before,
      .page-1-footer span::after,
      .page-1-footer div::before,
      .page-1-footer div::after,
      .page-1-footer span::marker,
      .page-1-footer div::marker {
        content: none !important;
        display: none !important;
        visibility: hidden !important;
      }
      
      /* QR code kecil di footer halaman 2+ (TIDAK di halaman cover) */
      /* Default: sembunyikan semua QR code kecil */
      .footer-qr-small {
        display: none !important;
        visibility: hidden !important;
      }
      
      /* Show QR code kecil HANYA di halaman hasil kalibrasi (halaman 2+) */
      /* Gunakan absolute positioning dengan page-container yang memiliki min-height A4 */
      .page-container.results-page {
        position: relative !important;
        min-height: 297mm !important; /* Tinggi A4 */
      }
      
      /* Hanya tampilkan di page-container dengan class results-page */
      /* QR code akan selalu di footer karena parent memiliki min-height penuh */
      .page-container.results-page .footer-qr-small.results-page-qr {
        position: absolute !important;
        bottom: 4mm !important;
        left: 4mm !important;
        width: 100px !important;
        height: 100px !important;
        z-index: 999 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* PASTIKAN tidak muncul di halaman cover - halaman cover TIDAK punya class .results-page */
      .page-container:not(.results-page) .footer-qr-small,
      .page-container:first-of-type .footer-qr-small,
      .page-container:not(.results-page) .results-page-qr {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
      
      .no-print {
        display: none !important;
      }
      /* QR Code styling for print */
      .qr-code-container {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .qr-code-container svg {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Logo di QR code styling */
      .qr-code-container img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Watermark styling */
      .watermark {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
      }
      .watermark img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
      }
      .watermark div {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
      }
      /* Avoid content splitting across pages */
      .avoid-break {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      /* Force start new printed page after a block */
      .break-after-page {
        page-break-after: always;
        break-after: page;
      }
      /* Ensure watermark is visible */
      .watermark {
        visibility: visible !important;
        opacity: 0.3 !important;
      }
      /* Repeating header via real table elements */
      table.repeatable-page-table { 
        width: 100%; 
        table-layout: fixed; 
        border-collapse: collapse;
        border-spacing: 0;
      }
      thead.print-repeat-header { display: table-header-group; }
      thead.print-repeat-header tr { margin: 0; padding: 0; }
      thead.print-repeat-header tr td { margin: 0; }
      
      /* tfoot as table-footer-group so footer appears after tbody content on each page */
      tfoot.print-repeat-footer { 
        display: table-footer-group !important;
        background-color: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Ensure tfoot content is visible (not hidden) */
      tfoot.print-repeat-footer .footer-content-wrapper {
        visibility: visible !important;
      }
      
      tbody.print-content { display: table-row-group; }
    }
    
    @media screen {
      /* ─── tfoot di screen mode ───────────────────────────────────────────────────
         PENTING: Jangan gunakan position:absolute + display:block di sini.
         position:absolute menyebabkan tfoot "bocor" ke halaman berikutnya saat
         Playwright generate PDF — bahkan ketika emulateMedia('print') sudah di-set.
         Solusinya: biarkan tfoot tetap sebagai table-footer-group juga di screen.
         Tampilan screen dijaga dengan padding-bottom pada container.
      ────────────────────────────────────────────────────────────────────────────── */
      tfoot.print-repeat-footer {
        display: table-footer-group;
        position: static;
        bottom: auto;
        left: auto;
        width: auto;
      }
      
      tfoot.print-repeat-footer > tr, 
      tfoot.print-repeat-footer > tr > td {
        display: table-row;
        width: auto;
      }
      tfoot.print-repeat-footer > tr > td {
        display: table-cell;
      }
      /* Fix table spacing on screen */
      table.repeatable-page-table {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
        height: 100% !important;
      }
      thead.print-repeat-header > tr > td {
        padding: 5mm 0 0 0 !important;
      }
      tbody.print-content > tr > td {
        padding-top: 2mm !important;
      }
      .page-container.results-page {
        padding-bottom: 25mm !important; 
        min-height: 297mm !important;
      }
    }
  `

  return (
    <div className="print-container bg-gray-100 print:bg-white text-black" suppressHydrationWarning>
      <style>{A4Style}</style>

      {/* Tombol Kontrol (Hilang saat print dan PDF mode) */}
      {!isPdfMode && (
        <div className="no-print p-4 bg-white shadow-lg sticky top-0 z-50 flex justify-center items-center gap-4">
          <p className="text-gray-700">Pratinjau Cetak Disiapkan.</p>
          <button onClick={() => router.back()} className="px-4 py-2 border rounded-lg text-sm font-medium">Kembali</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Cetak Ulang</button>
        </div>
      )}

      {/* --- HALAMAN 1 (COVER) --- */}
      <div className="page-container cover-page break-after-page bg-white shadow-lg my-4 print:shadow-none print:my-0 relative">
        {/* Watermark Logo BMKG */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 watermark"
          style={{
            backgroundImage: `url(${bmkgLogo.src})`,
            backgroundSize: '700px 700px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: 0.3
          }}
        >
        </div>

        {/* Konten halaman dengan z-index lebih tinggi */}
        <div className="relative z-10">
          {/* Header Halaman 1 */}
          <header className="flex flex-row items-center justify-between border-b-[3px] border-double border-black pb-2">
            <div className="flex items-start w-[100px]">
              <Image src={bmkgLogo} alt="BMKG" width={100} height={100} priority />
            </div>
            <div className="text-center leading-tight">
              <h1 className="text-base font-bold">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
              <h2 className="text-base font-bold">LABORATORIUM KALIBRASI BMKG</h2>
            </div>
            <div className="w-[100px]"></div> {/* Spacer agar center */}
          </header>

          {/* Judul Sertifikat */}
          <div className="text-center my-6">
            <h1 className="cert-title-id">SERTIFIKAT KALIBRASI</h1>
            <h2 className="cert-title-en">CALIBRATION CERTIFICATE</h2>
            <div className="cert-info-text mt-2">{cert.no_certificate}</div>
          </div>

          {/* Identitas Alat */}
          <div className="mb-4">
            <h3 className="cert-text-id">IDENTITAS ALAT</h3>
            <h4 className="cert-text-en mb-1">Instrument Details</h4>
            <table className="w-full cert-info-text">
              <tbody>
                <tr>
                  <td className="w-[30%] align-top"><PdfLabel indo="Nama Alat" eng="Instrument Name" /></td>
                  <td className="w-[5%] align-top">:</td>
                  <td className="w-[65%] align-top font-semibold">{instrument?.name || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Merek Pabrik" eng="Manufacturer" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-semibold">{instrument?.manufacturer || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Tipe / Nomor Seri" eng="Type / Serial Number" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-semibold">{instrument?.type || '-'} / {instrument?.serial_number || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Lain-lain" eng="Others" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-semibold whitespace-pre-line">{sensorsSummary || instrument?.others || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Identitas Pemilik */}
          <div className="mb-4">
            <h3 className="cert-text-id underline leading-tight mb-0">IDENTITAS PEMILIK</h3>
            <h4 className="cert-text-en leading-tight mb-1">Owner's Identification</h4>
            <table className="w-full cert-info-text">
              <tbody>
                <tr>
                  <td className="w-[30%] align-top"><PdfLabel indo="Nama" eng="Designation" /></td>
                  <td className="w-[5%] align-top">:</td>
                  <td className="w-[65%] align-top font-semibold whitespace-pre-line">{station?.name || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Alamat" eng="Address" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-semibold">{resolvedStationAddress || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pengesahan */}
          <div className="mb-8">
            <h3 className="cert-text-id underline leading-tight mb-0">PENGESAHAN</h3>
            <h4 className="cert-text-en mb-2 leading-tight">Authorization</h4>
            <table className="w-full cert-info-text">
              <tbody>
                <tr>
                  <td className="w-[30%] align-top"><PdfLabel indo="Pejabat Pengesahan" eng="Authorizing officer" /></td>
                  <td className="w-[5%] align-top">:</td>
                  <td className="w-[65%] align-top font-bold">Direktur Instrumentasi dan Kalibrasi BMKG</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Nama" eng="Name" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-bold">{authorized?.name || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Tanggal Pengesahan" eng="Date of issue" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-bold">
                    {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="align-top"><PdfLabel indo="Jumlah halaman" eng="Total number of pages" /></td>
                  <td className="align-top">:</td>
                  <td className="align-top font-bold">{totalPrintedPages}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Halaman 1 */}
        <footer className="page-1-footer" style={{ listStyle: 'none', listStyleType: 'none', listStylePosition: 'outside' }}>
          <table className="w-full text-black" style={{ borderCollapse: 'collapse', border: 'none', marginBottom: '4px' }}>
            <tbody>
              <tr>
                <td className="align-middle text-right pr-4" style={{ width: '15%' }}>
                  {qrCodeData ? (
                    <div className="inline-block w-[100px] h-[100px] bg-white qr-code-container" style={{ listStyle: 'none', display: 'inline-block' }}>
                      <QRCodeWithBMKGLogo
                        key={`qr-${isSigned ? 'signed' : 'unsigned'}`}
                        value={qrCodeData}
                        size={100}
                        logoSize={28}
                        fgColor={isSigned ? '#000000' : '#B91C1C'}
                        onRendered={handleQRRendered}
                      />
                    </div>
                  ) : (
                    <div className="inline-block w-[100px] h-[100px] bg-transparent" style={{ display: 'inline-block' }}></div>
                  )}
                </td>
                <td className="align-middle" style={{ width: '85%', textAlign: 'justify', lineHeight: '1.3' }}>
                  <div style={{ textJustify: 'inter-word', paddingBottom: '4px', display: 'block' }} className="text-xs font-bold leading-relaxed">
                    Dokumen ini telah ditandatangani secara elektronik menggunakan Sertifikat Elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), BSSN dan tidak memerlukan tanda tangan atau cap. Dokumen asli dapat diperoleh dengan memindai kode QR di samping ini.
                  </div>
                  <div style={{ textJustify: 'inter-word', display: 'block' }} className="italic text-[10px] font-bold text-gray-800 leading-relaxed">
                    This document is digitally signed. No signature or seal is required. The original document can be obtained by scanning the QR on the left.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <hr className="my-1 border-t-[3px] border-double border-black" style={{ borderTop: '3px double black', borderColor: '#000' }} />
          <table className="w-full text-black mt-1" style={{ borderCollapse: 'collapse', border: 'none' }}>
            <tbody>
              <tr>
                <td className="align-top text-left text-[10px] font-bold" style={{ width: '25%' }}>F/IKK 7.8.1</td>
                <td className="align-top text-center text-[10px] font-bold text-gray-800" style={{ width: '50%', lineHeight: '1.4' }}>
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

      {/* --- HALAMAN 2..N: satu halaman per sensor --- */}
      {results.length === 0 ? (
        <div className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0">
          <table className="repeatable-page-table" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
            <thead className="print-repeat-header">
              <tr>
                <td>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="w-[100px] align-top">
                          <Image src={bmkgLogo} alt="BMKG" width={100} height={100} priority />
                        </td>
                        <td className="align-top"></td>
                        <td className="align-top">
                          <table className="w-[360px] text-xs table-fixed ml-auto mr-0">
                            <tbody>
                              <tr>
                                <td className="w-[48%] text-left font-bold leading-tight align-top">
                                  No. Sertifikat / <span className="italic">Certificate</span><br />
                                  <span className="italic">Number</span>
                                </td>
                                <td className="w-[4%] px-1 align-top">:</td>
                                <td className="w-[48%] align-top font-bold">{cert.no_certificate}</td>
                              </tr>
                              <tr>
                                <td className="text-left font-bold leading-tight align-top">
                                  No. Order / <br />
                                  <span className="italic">Order Number</span>
                                </td>
                                <td className="px-1 align-top">:</td>
                                <td className="align-top font-bold">{cert.no_order}</td>
                              </tr>
                              <tr>
                                <td className="text-left font-bold leading-tight align-top">
                                  Halaman / <br />
                                  <span className="italic">Page</span>
                                </td>
                                <td className="px-1 align-top">:</td>
                                <td className="align-top font-bold">2 dari {totalPrintedPages}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </thead>
            <tbody className="print-content">
              <tr>
                <td>
                  <div className="text-xs text-center text-gray-600">Tidak ada data hasil kalibrasi</div>
                  <p className="text-center font-bold text-sm mt-8">
                    --- Akhir dari Sertifikat / <span className="italic">End of Certificate</span> ---
                  </p>
                </td>
              </tr>
            </tbody>
            <tfoot className="print-repeat-footer">
              <tr>
                <td>
                  <div className="w-full pb-2 px-1">
                    <table className="w-full text-black" style={{ borderCollapse: 'collapse', border: 'none' }}>
                      <tbody>
                        <tr>
                          <td className="align-bottom text-left" style={{ width: '25%' }}>
                            <div className="flex flex-col items-start gap-1">
                              {qrCodeData ? (
                                <div className="w-[40px] h-[40px]">
                                  <FooterQRCode
                                    value={qrCodeData}
                                    fgColor={isSigned ? '#000000' : '#B91C1C'}
                                    onRendered={handleQRRendered}
                                    size={40}
                                  />
                                </div>
                              ) : (
                                <div className="w-[40px] h-[40px]"></div>
                              )}
                              <div className="text-[10px] font-bold mt-1">F/IKK 7.8.2</div>
                            </div>
                          </td>
                          <td className="align-bottom text-center text-[10px] font-medium pb-[1px]" style={{ width: '50%', lineHeight: '1.4' }}>
                            Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara
                          </td>
                          <td className="align-bottom text-right text-[10px] font-bold pb-[1px]" style={{ width: '25%' }}>
                            Edisi/Revisi : 11/1
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        results.map((res: any, idx: number) => (
          <div key={idx} className={`page-container results-page bg-white shadow-lg my-4 print:shadow-none print:my-0 ${idx !== results.length - 1 ? 'break-after-page' : ''}`}>
            <table className="repeatable-page-table" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
              <thead className="print-repeat-header">
                <tr>
                  <td>
                    <table className="w-full text-xs">
                      <tbody>
                        <tr>
                          <td className="w-[100px] align-top">
                            <Image src={bmkgLogo} alt="BMKG" width={100} height={100} priority />
                          </td>
                          <td className="align-top"></td>
                          <td className="align-top">
                            <table className="w-[360px] text-xs table-fixed ml-auto mr-0">
                              <tbody>
                                <tr>
                                  <td className="w-[48%] text-left font-bold leading-tight align-top">
                                    No. Sertifikat / <span className="italic">Certificate</span><br />
                                    <span className="italic">Number</span>
                                  </td>
                                  <td className="w-[4%] px-1 align-top">:</td>
                                  <td className="w-[48%] align-top font-bold">{cert.no_certificate}</td>
                                </tr>
                                <tr>
                                  <td className="text-left font-bold leading-tight align-top">
                                    No. Order / <br />
                                    <span className="italic">Order Number</span>
                                  </td>
                                  <td className="px-1 align-top">:</td>
                                  <td className="align-top font-bold">{cert.no_order}</td>
                                </tr>
                                <tr>
                                  <td className="text-left font-bold leading-tight align-top">
                                    Halaman / <br />
                                    <span className="italic">Page</span>
                                  </td>
                                  <td className="px-1 align-top">:</td>
                                  <td className="align-top font-bold">{idx + 2} dari {totalPrintedPages}</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Separator removed as requested */}
                  </td>
                </tr>
              </thead>

              {/* Konten per sensor */}
              <tbody className="print-content">
                <tr>
                  <td>
                    <div className="text-xs">
                      <section>
                        {/* Header per Sensor: Detail Sensor & Environment */}
                        <div className="grid grid-cols-1">
                          {(() => {
                            const name = resolveSensorName(res, idx) || '-'
                            const manufacturer = res?.sensorDetails?.manufacturer || '-'
                            const type = res?.sensorDetails?.type || '-'
                            const serial = res?.sensorDetails?.serial_number || '-'
                            const start = res?.startDate ? new Date(res.startDate).toISOString().slice(0, 10) : '-'
                            const end = res?.endDate ? new Date(res.endDate).toISOString().slice(0, 10) : '-'
                            const place = res?.place || '-'
                            const sensorInfo: Array<{ label: string; labelEng: string; value: React.ReactNode; topGap?: boolean; bold?: boolean }> = [
                              { label: 'Nama Sensor / ', labelEng: 'Sensor Name', value: name, bold: true },
                              { label: 'Merek Sensor / ', labelEng: 'Manufacturer', value: manufacturer, bold: true },
                              { label: 'Tipe & No. Seri / ', labelEng: 'Type & Serial Number', value: `${type} / ${serial}`, bold: true },
                              { label: 'Tanggal Masuk / ', labelEng: 'Date of Entry', value: start, topGap: true },
                              { label: 'Tanggal Kalibrasi / ', labelEng: 'Calibration Date', value: end },
                              { label: 'Tempat Kalibrasi / ', labelEng: 'Calibration Place', value: place },
                            ]
                            const sensorSessionId = res?.session_id;
                            const sensorRawData = sensorSessionId ? allRawData.filter(rd => rd.session_id === sensorSessionId) : [];
                            const rawSuhu = computeEnvCondition('suhu', sensorRawData);
                            const rawHum = computeEnvCondition('kelembaban', sensorRawData);

                            let envList = Array.isArray(res?.environment) ? [...res.environment] : [];

                            // Ensure Suhu and Kelembaban exist in envList if they have raw values
                            if (envList.length === 0) {
                              if (rawSuhu !== '-') envList.push({ key: 'Suhu', value: '-' });
                              if (rawHum !== '-') envList.push({ key: 'Kelembaban', value: '-' });
                            } else {
                              const hasSuhu = envList.some(e => e.key.toLowerCase().includes('suhu'));
                              const hasHum = envList.some(e => e.key.toLowerCase().includes('kelembaban') || e.key.toLowerCase().includes('rh'));
                              if (!hasSuhu && rawSuhu !== '-') envList.push({ key: 'Suhu', value: '-' });
                              if (!hasHum && rawHum !== '-') envList.push({ key: 'Kelembaban', value: '-' });
                            }

                            const envRows: Array<{ label: string; labelEng: string; value: React.ReactNode }> = envList.map((env: any) => {
                              const key = String(env?.key || '')
                              const lower = key.toLowerCase()
                              const isSuhu = lower.includes('suhu')
                              const isHum = lower.includes('kelembaban') || lower.includes('rh')

                              const label = isSuhu
                                ? 'Suhu / '
                                : isHum
                                  ? 'Kelembaban / '
                                  : `${key} `
                              const eng = isSuhu ? 'Temperature' : isHum ? 'Relative Humidity' : ''

                              let finalValue = env?.value || '-'

                              // Override with computed QC data if available
                              if (isSuhu && rawSuhu !== '-') {
                                finalValue = rawSuhu
                              } else if (isHum && rawHum !== '-') {
                                finalValue = rawHum
                              }

                              return { label, labelEng: eng, value: finalValue }
                            })

                            return (
                              <table className="w-full text-xs avoid-break">
                                <tbody>
                                  {sensorInfo.map((row, i) => (
                                    <tr key={`info-${i}`}>
                                      <td className={`w-[45%] align-top font-semibold ${row.topGap ? 'pt-2' : ''}`}>
                                        {row.label}<span className="italic">{row.labelEng}</span>
                                      </td>
                                      <td className={`w-[5%] align-top ${row.topGap ? 'pt-2' : ''}`}>:</td>
                                      <td className={`${row.topGap ? 'pt-2' : ''}`} colSpan={2}>
                                        <span className={row.bold ? 'font-semibold' : undefined}>{row.value}</span>
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Environment as label-value lines (no table) */}
                                  {envRows.length > 0 && (
                                    <tr>
                                      <td className="w-[45%]" />
                                      <td className="w-[5%]" />
                                      <td className="align-top" colSpan={2}>
                                        <div className="text-sm font-bold mb-1">Kondisi Lingkungan / <span className="italic">Environment condition</span></div>
                                        <div className="space-y-1">
                                          {envRows.map((er, idx) => (
                                            <div key={idx} className="grid grid-cols-[45%_5%_1fr] text-[10px]">
                                              <div className="font-semibold">
                                                {er.label}<span className="italic">{er.labelEng}</span>
                                              </div>
                                              <div>:</div>
                                              <div>{er.value}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            )
                          })()}
                        </div>

                        {/* Hasil Kalibrasi per Sensor */}
                        {Array.isArray(res?.table) && res.table.length > 0 && (
                          <div className="mt-6 space-y-3 w-[85%] mx-auto">
                            <div className="text-[12px] font-bold text-center mb-1">Hasil Kalibrasi / <span className="italic font-normal">Calibration Result</span></div>
                            {res.table.map((sec: any, sIdx: number) => {
                              const rows = Array.isArray(sec?.rows) ? sec.rows : []
                              const isDuplicateTitle = sec?.title?.toLowerCase().includes('hasil kalibrasi') || sec?.title?.toLowerCase().includes('calibration result');
                              return (
                                <div key={sIdx} className="mt-3 avoid-break">
                                  {sec?.title && sec.title.trim() !== '' && !isDuplicateTitle && <div className="text-xs font-bold mb-1 text-center">{sec.title}</div>}
                                  {(!sec?.title || sec.title.trim() === '') && <div className="text-xs font-bold mb-1 text-center">{`Tabel ${sIdx + 1}`}</div>}
                                  <table className="w-full text-xs border-[2px] border-black text-center border-collapse">
                                    <thead>
                                      <tr className="font-bold">
                                        {/* Use explicit headers if available, otherwise fallback to Key/Unit/Value logic */}
                                        {sec.headers ? (
                                          sec.headers.map((h: string, i: number) => {
                                            const unit = res?.unitUut || res?.sensorDetails?.range_capacity_unit || res?.sensorDetails?.unit || res?.sensorDetails?.graduating_unit;
                                            // Extract base header string without HTML tags if any, but since it's string just append
                                            return (
                                              <td key={i} className="p-1 border border-black text-center">
                                                {h}<br />{unit ? `(${unit})` : ''}
                                              </td>
                                            );
                                          })
                                        ) : (
                                          // Fallback for old data without headers
                                          rows.length > 0 && (
                                            <>
                                              <td className="p-1 border border-black text-center">Parameter</td>
                                              <td className="p-1 border border-black text-center">Unit</td>
                                              <td className="p-1 border border-black text-center">Nilai</td>
                                            </>
                                          )
                                        )}
                                      </tr>
                                      {/* Baris Unit Tambahan dihapus as requested */}
                                    </thead>
                                    <tbody>
                                      {rows.map((row: any, rIdx: number) => (
                                        <tr key={rIdx}>
                                          {/* If headers exist, map based on standard + extra values */}
                                          {sec.headers ? (
                                            <>
                                              <td className="p-1 border border-black text-center">{row.key || '-'}</td>
                                              <td className="p-1 border border-black text-center">{row.unit || '-'}</td>
                                              <td className="p-1 border border-black text-center">{row.value || '-'}</td>
                                              {Array.isArray(row.extraValues) && row.extraValues.map((v: string, vi: number) => (
                                                <td key={`extra-${vi}`} className="p-1 border border-black text-center">{v || '-'}</td>
                                              ))}
                                            </>
                                          ) : (
                                            // Fallback
                                            <>
                                              <td className="p-1 border border-black text-center">{row.key || '-'}</td>
                                              <td className="p-1 border border-black text-center">{row.unit || '-'}</td>
                                              <td className="p-1 border border-black text-center">{row.value || '-'}</td>
                                            </>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Images per sensor only for Geofisika - placed right after calibration table */}
                        {station?.type?.toString().trim().toLowerCase() === 'geofisika' && Array.isArray(res?.images) && (res.images as any[]).length > 0 && (
                          <div className="mt-4 avoid-break break-after-page">
                            <h4 className="text-xs font-semibold mb-2 text-center">Gambar</h4>
                            <div className="flex flex-wrap gap-3 justify-center">
                              {(res.images as any[]).map((img: any, i: number) => {
                                const src = typeof img === 'string' ? img : (img?.url || '')
                                if (!src) return null
                                return (
                                  <figure key={i} className="m-0 p-0 text-center">
                                    <img src={src} alt={`Gambar Sensor ${i + 1}`} className="block m-0 p-0 h-auto w-auto max-w-[400px] max-h-[400px]" />
                                    {img?.caption ? (
                                      <figcaption className="text-[10px] mt-0 text-center text-gray-700 leading-tight m-0 p-0">{img.caption}</figcaption>
                                    ) : null}
                                  </figure>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Catatan per Sensor */}
                        {(() => {
                          const nf = res?.notesForm || null
                          if (!nf) return null
                          const hasAny = nf.traceable_to_si_through || nf.reference_document || nf.calibration_methode || nf.others || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)
                          if (!hasAny) return null
                          return (
                            <div className="mt-6 avoid-break">
                              <div className="text-sm font-bold underline leading-tight mb-0">Catatan / <span className="italic">Notes :</span></div>
                              <table className="w-full text-xs mt-1">
                                <tbody>
                                  {(nf.others || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)) && (
                                    <tr>
                                      <td className="w-[40%] align-top text-left pr-2 py-0">
                                        <div className="font-bold leading-tight">Standar Kalibrasi <span className="italic text-[10px] text-gray-900">/ Calibration Standard</span></div>
                                      </td>
                                      <td className="w-[5%] align-top py-0">:</td>
                                      <td className="w-[55%] align-top whitespace-pre-line py-0">
                                        {(() => {
                                          const parts = []
                                          // Removed nf.others from Standar Kalibrasi

                                          if (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0) {
                                            const standards = nf.standardInstruments.map((sid: number) => {
                                              const s = sensors.find((sensor: any) => sensor.id === sid)
                                              if (!s) return null
                                              // Format: Name - SN (if available)
                                              const name = s.name || s.type || 'Sensor'
                                              const sn = s.serial_number ? `SN ${s.serial_number}` : ''
                                              return sn ? `${name} — ${sn}` : name
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
                                  {nf.others && (
                                    <tr>
                                      <td className="align-top text-left pr-2 py-0">
                                        <div className="font-bold leading-tight">Catatan Lainnya <span className="italic text-[10px] text-gray-900">/ Other Notes</span></div>
                                      </td>
                                      <td className="align-top py-0">:</td>
                                      <td className="align-top whitespace-pre-line py-0">{nf.others}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>

                              {/* Paragraf penjelasan (bilingual) */}
                              <div className="mt-0 space-y-0 text-xs leading-tight">
                                <div>
                                  <div className="font-bold m-0">Penunjukan nilai sebenarnya didapat dari penunjukan alat ditambah koreksi.</div>
                                  <div className="text-[10px] italic text-gray-700 m-0">The true value is determined from the instrument reading added by its correction.</div>
                                </div>
                                <div>
                                  <div className="font-bold m-0">Sertifikat ini hanya berlaku untuk peralatan dengan identitas yang dinyatakan di atas.</div>
                                  <div className="text-[10px] italic text-gray-700 m-0">This certificate only applies to equipment with the identity stated above.</div>
                                </div>
                                <div>
                                  <div className="font-bold m-0">Ketidakpastian pengukuran dinyatakan pada tingkat kepercayaan tidak kurang dari 95 % dengan faktor cakupan k = 2,01</div>
                                  <div className="text-[10px] italic text-gray-700 m-0">Uncertainty of measurement is expressed at a confidence level of no less than 95 % with coverage factor k = 2.01</div>
                                </div>
                              </div>
                              {/* Verifikasi/Validasi di akhir catatan */}
                              <div className="mt-2">
                                <table className="w-full text-xs">
                                  <tbody>
                                    <tr>
                                      <td className="w-[35%] align-top text-left pr-2 py-0">
                                        <span className="font-bold leading-tight">Diverifikasi Oleh</span>
                                        <span className="italic text-[10px] text-gray-700 leading-tight"> / Verified by</span>
                                      </td>
                                      <td className="w-[5%] align-top py-0">:</td>
                                      <td className="w-[60%] align-top py-0">
                                        {[verifikator1?.name, verifikator2?.name, verifikator3?.name].filter(Boolean).length > 0
                                          ? [verifikator1?.name, verifikator2?.name, verifikator3?.name].filter(Boolean).map((name, idx2) => (
                                            <div key={idx2}>{idx2 + 1}. {name}</div>
                                          ))
                                          : <div>-</div>
                                        }
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <div className="w-full border-t-[3px] border-double border-black mt-2"></div>
                              </div>
                            </div>
                          )
                        })()}
                        {/* End of Certificate on the last sensor page (always show on last page) */}
                        {/* Positioned directly following the content */}
                        {idx === results.length - 1 && (
                          <div className="mt-2 mb-4">
                            <p className="text-center font-bold text-sm m-0">
                              --- Akhir dari Sertifikat / <span className="italic">End of Certificate</span> ---
                            </p>
                          </div>
                        )}

                      </section>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot className="print-repeat-footer">
                <tr>
                  <td>
                    <div className="w-full pb-2 px-1">
                      <table className="w-full text-black" style={{ borderCollapse: 'collapse', border: 'none' }}>
                        <tbody>
                          <tr>
                            <td className="align-bottom text-left" style={{ width: '25%' }}>
                              <div className="flex flex-col items-start gap-1">
                                {qrCodeData ? (
                                  <div className="w-[40px] h-[40px]">
                                    <FooterQRCode
                                      value={qrCodeData}
                                      fgColor={isSigned ? '#000000' : '#B91C1C'}
                                      onRendered={handleQRRendered}
                                      size={40}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-[40px] h-[40px]"></div>
                                )}
                                <div className="text-[10px] font-bold mt-1">F/IKK 7.8.2</div>
                              </div>
                            </td>
                            <td className="align-bottom text-center text-[10px] font-medium pb-[1px]" style={{ width: '50%', lineHeight: '1.4' }}>
                              Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara
                            </td>
                            <td className="align-bottom text-right text-[10px] font-bold pb-[1px]" style={{ width: '25%' }}>
                              Edisi/Revisi : 11/1
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))
      )}


    </div>
  )
}

export default PrintCertificatePage
