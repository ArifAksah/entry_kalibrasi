'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import bmkgLogo from '../../../bmkg.png' // Pastikan path logo ini benar

// --- TIPE DATA KOMPREHENSIF ---
// Saya gabungkan tipe dari ViewCertificatePage.tsx Anda ke sini
// agar kita memiliki akses ke cert.results, verifikator, dll.

type KV = { key: string; value: string }
type TableRow = { key: string; unit: string; value: string }
type TableSection = { title: string; rows: TableRow[] }
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
  station_address?: string | null
  results?: ResultItem[] // Menambahkan results di sini
  version?: number
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
    <div className="font-bold text-xs">{indo}</div>
    <div className="text-[10px] italic text-gray-600">{eng}</div>
  </div>
)

// --- Komponen QR Code dengan Logo BMKG Kecil di Tengah ---
const QRCodeWithBMKGLogo: React.FC<{ 
  value: string;
  size: number;
  logoSize?: number;
  className?: string;
}> = ({ value, size, logoSize = 16, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <QRCode
        value={value}
        size={size}
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        viewBox={`0 0 ${size} ${size}`}
      />
      {/* Logo BMKG di tengah QR code */}
      <div 
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
      >
        <Image 
          src={bmkgLogo} 
          alt="BMKG" 
          width={logoSize} 
          height={logoSize}
          className="w-full h-full object-contain"
        />
      </div>
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

  // Menggunakan useMemo untuk data turunan
  const station = useMemo(() => stations.find(s => s.id === (cert?.station ?? -1)) || null, [stations, cert])
  const resolvedStationAddress = useMemo(() => (cert?.station_address ?? null) || (station?.address ?? null), [cert, station])
  const instrument = useMemo(() => instruments.find(i => i.id === (cert?.instrument ?? -1)) || null, [instruments, cert])
  const authorized = useMemo(() => personel.find(p => p.id === (cert?.authorized_by ?? '')) || null, [personel, cert])
  const verifikator1 = useMemo(() => personel.find(p => p.id === (cert?.verifikator_1 ?? '')) || null, [personel, cert])
  const verifikator2 = useMemo(() => personel.find(p => p.id === (cert?.verifikator_2 ?? '')) || null, [personel, cert])

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
      const name = sd.name || sd.type || `Sensor ${i + 1}`
      const manufacturer = sd.manufacturer || '-'
      const type = sd.type || '-'
      const serial = sd.serial_number || '-'
      return `${i + 1}. ${name} : ${manufacturer} / ${type} / ${serial}`
    })
    return `terdiri dari beberapa sensor yaitu:\n` + lines.join('\n')
  }, [results])

  // Generate QR code data
  const qrCodeData = useMemo(() => {
    if (!cert) return ''
    
    const qrData = {
      certificateNumber: cert.no_certificate,
      orderNumber: cert.no_order,
      issueDate: cert.issue_date,
      instrumentName: instrument?.name || '',
      manufacturer: instrument?.manufacturer || '',
      serialNumber: instrument?.serial_number || '',
      stationName: station?.name || '',
      authorizedBy: authorized?.name || '',
      verifikator1: verifikator1?.name || '',
      verifikator2: verifikator2?.name || '',
      version: cert.version || 1
    }
    
    return JSON.stringify(qrData)
  }, [cert, instrument, station, authorized, verifikator1, verifikator2])

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
        const [cRes, pRes] = await Promise.all([
          fetch(`/api/certificates/${id}`),
          fetch('/api/personel'),
        ])
        const c = await cRes.json()
        const p = await pRes.json()
        
        if (!cRes.ok) throw new Error(c?.error || 'Failed to load certificate')
        setCert(c)
        
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
        } catch {}

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
        } catch {}

        // Tunggu sebentar agar data ter-render, lalu panggil print dialog
        setTimeout(() => window.print(), 500) // Kasih waktu 500ms
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8 text-gray-600 text-center text-lg">Memuat data sertifikat untuk dicetak...</div>
  if (error || !cert) return <div className="p-8 text-red-600 text-center text-lg">Gagal memuat data: {error || 'Sertifikat tidak ditemukan'}</div>

  // --- STYLING UNTUK PRINT ---
  // Ini adalah bagian penting untuk membuat layout A4
  // Kita menggunakan <style> agar bisa mengatur @page dan print media queries
  const A4Style = `
    @import url('https://fonts.googleapis.com/css2?family=Arial:wght@400;700&display=swap');
    
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background-color: #fff;
    }
    
    .print-container {
      font-family: 'Arial', sans-serif;
      background: white;
      color: #000;
    }
    
    .page-container {
      width: 210mm;
      min-height: 296mm; /* Sedikit lebih kecil dari 297mm untuk menghindari overflow */
      padding: 20mm; /* Padding standar dokumen */
      padding-bottom: 40mm; /* Ruang untuk footer static */
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
      page-break-after: always;
    }
    
    /* Footer khusus untuk halaman 1 saja */
    .page-1-footer {
      position: fixed !important;
      bottom: 10mm !important;
      left: 20mm !important;
      right: 20mm !important;
      z-index: 1000 !important;
    }
    
    
    .page-container:last-child {
      page-break-after: avoid;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .print-container {
        margin: 0;
        padding: 0;
      }
      .page-container {
        margin: 0;
        padding: 20mm; /* Pastikan padding sama */
        padding-bottom: 40mm; /* Ruang untuk footer static */
        border: none !important;
        box-shadow: none !important;
      }
      
      /* Footer halaman 1 tetap static di mode print */
      .page-1-footer {
        position: fixed !important;
        bottom: 10mm !important;
        left: 20mm !important;
        right: 20mm !important;
        z-index: 1000 !important;
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
      table.repeatable-page-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
      thead.print-repeat-header { display: table-header-group; }
      tbody.print-content { display: table-row-group; }
    }
  `

  return (
    <div className="print-container bg-gray-100 print:bg-white text-black">
      <style>{A4Style}</style>

      {/* Tombol Kontrol (Hilang saat print) */}
      <div className="no-print p-4 bg-white shadow-lg sticky top-0 z-50 flex justify-center items-center gap-4">
        <p className="text-gray-700">Pratinjau Cetak Disiapkan.</p>
        <button onClick={() => router.back()} className="px-4 py-2 border rounded-lg text-sm font-medium">Kembali</button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Cetak Ulang</button>
      </div>
      
      {/* --- HALAMAN 1 --- */}
      <div className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0 relative">
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
        <header className="flex flex-row items-center justify-between border-b-4 border-black pb-2">
          <div className="w-[80px]">
            <Image src={bmkgLogo} alt="BMKG" width={80} height={80} priority />
          </div>
          <div className="text-center leading-tight">
            <h1 className="text-base font-bold">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
            <h2 className="text-base font-bold">LABORATORIUM KALIBRASI BMKG</h2>
          </div>
          <div className="w-[80px]"></div> {/* Spacer agar center */}
        </header>

        {/* Judul Sertifikat */}
        <div className="text-center my-6">
          <h1 className="text-xl font-bold tracking-wide">SERTIFIKAT KALIBRASI</h1>
          <h2 className="text-base italic text-gray-700">CALIBRATION CERTIFICATE</h2>
          <div className="text-sm font-semibold mt-2">{cert.no_certificate}</div>
        </div>

        {/* Identitas Alat */}
        <div className="mb-4">
          <h3 className="text-sm font-bold">IDENTITAS ALAT</h3>
          <h4 className="text-xs italic text-gray-700 mb-1">Instrument Details</h4>
          <table className="w-full text-xs">
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
          <h3 className="text-sm font-bold">IDENTITAS PEMILIK</h3>
          <h4 className="text-xs italic text-gray-700 mb-1">Owner Identification</h4>
          <table className="w-full text-xs">
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

        {/* Pengesahan - di sebelah kanan */}
        <div className="mt-8 flex justify-end">
          <div className="text-xs max-w-sm">
            <div className="mb-2">
              <div className="font-semibold">Sertifikat ini terdiri atas 3 halaman</div>
              <div className="text-[10px] italic text-gray-700">This certificate comprises of pages</div>
            </div>
            
            <div className="mb-4">
              <div className="font-semibold">Diterbitkan tanggal {new Date(cert.issue_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] italic text-gray-700">Date of issue</div>
            </div>
            
            <div className="mb-4">
              <div className="font-semibold">Kepala Pusat Instrumentasi,</div>
              <div className="font-semibold">Kalibrasi dan Rekayasa</div>
            </div>

            
            <div className="flex justify-center mb-2">
              <div className="w-20 h-20 border-2 border-black flex items-center justify-center bg-white qr-code-container">
                <QRCodeWithBMKGLogo
                  value={qrCodeData}
                  size={64}
                  logoSize={20}
                />
              </div>
            </div>
            
            <div className="text-center font-bold underline">
              {authorized?.name || '-'}
            </div>
          </div>
          </div>
        </div>

        {/* Footer Halaman 1 */}
        <footer className="page-1-footer text-xs">
          <div className="text-center text-[10px] text-gray-700">
            Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara
          </div>
          <div className="flex justify-between items-end mt-2">
            <span className="font-semibold">F/IKK 7.8.1</span>
            <div className="text-center text-[10px] text-gray-700 leading-tight">
              Jl. Angkasa I No. 02 Kemayoran Jakarta Pusat
              <br />
              Tlp. 021-4246321 Ext. 5125; Fax: 021-6545626; P.O. Box 3540 Jkt; Website: http://www.bmkg.go.id
            </div>
            <span className="font-semibold">Edisi/Revisi: 11/0</span>
          </div>
        </footer>
      </div>
      
      {/* --- HALAMAN 2..N: satu halaman per sensor --- */}
      {results.length === 0 ? (
        <div className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0">
          <table className="repeatable-page-table">
            <thead className="print-repeat-header">
              <tr>
                <td>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="w-[80px] align-top">
                          <Image src={bmkgLogo} alt="BMKG" width={80} height={80} priority />
                        </td>
                        <td className="align-top"></td>
                        <td className="align-top">
                          <table className="text-xs table-fixed ml-auto mr-0">
                            <tbody>
                              <tr>
                                <td className="w-[55%] text-right font-bold leading-tight">
                                  <div>No. Sertifikat</div>
                                  <div className="italic font-normal">Certificate Number</div>
                                </td>
                                <td className="w-[5%] px-1">:</td>
                                <td className="w-[40%]">{cert.no_certificate}</td>
                              </tr>
                              <tr>
                                <td className="text-right font-bold leading-tight">
                                  <div>No. Order</div>
                                  <div className="italic font-normal">Order Number</div>
                                </td>
                                <td className="px-1">:</td>
                                <td>{cert.no_order}</td>
                              </tr>
                              <tr>
                                <td className="text-right font-bold leading-tight">
                                  <div>Halaman</div>
                                  <div className="italic font-normal">Page</div>
                                </td>
                                <td className="px-1">:</td>
                                <td>2 dari {totalPrintedPages}</td>
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
          </table>
        </div>
      ) : (
        results.map((res: any, idx: number) => (
          <div key={idx} className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0">
            <table className="repeatable-page-table">
              <thead className="print-repeat-header">
                <tr>
                  <td>
                    <table className="w-full text-xs">
                      <tbody>
                        <tr>
                          <td className="w-[80px] align-top">
                            <Image src={bmkgLogo} alt="BMKG" width={80} height={80} priority />
                          </td>
                          <td className="align-top"></td>
                          <td className="align-top">
                            <table className="text-xs table-fixed ml-auto mr-0">
                              <tbody>
                                <tr>
                                  <td className="w-[55%] text-right font-bold leading-tight">
                                    <div>No. Sertifikat</div>
                                    <div className="italic font-normal">Certificate Number</div>
                                  </td>
                                  <td className="w-[5%] px-1">:</td>
                                  <td className="w-[40%]">{cert.no_certificate}</td>
                                </tr>
                                <tr>
                                  <td className="text-right font-bold leading-tight">
                                    <div>No. Order</div>
                                    <div className="italic font-normal">Order Number</div>
                                  </td>
                                  <td className="px-1">:</td>
                                  <td>{cert.no_order}</td>
                                </tr>
                                <tr>
                                  <td className="text-right font-bold leading-tight">
                                    <div>Halaman</div>
                                    <div className="italic font-normal">Page</div>
                                  </td>
                                  <td className="px-1">:</td>
                                  <td>{idx + 2} dari {totalPrintedPages}</td>
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
            
            {/* Konten per sensor */}
              <tbody className="print-content">
                <tr>
                  <td>
            <div className="text-xs">
              <section>
                {/* Header per Sensor: Detail Sensor & Environment */}
                <div className="grid grid-cols-1">
                  {(() => {
                    const name = res?.sensorDetails?.name || res?.sensorDetails?.type || '-'
                    const manufacturer = res?.sensorDetails?.manufacturer || '-'
                    const type = res?.sensorDetails?.type || '-'
                    const serial = res?.sensorDetails?.serial_number || '-'
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
                    const envRows: Array<{ label: string; labelEng: string; value: React.ReactNode }> = (res?.environment || []).map((env: any) => {
                      const key = String(env?.key || '')
                      const lower = key.toLowerCase()
                      const label = lower.includes('suhu')
                        ? 'Suhu / '
                        : lower.includes('kelembaban')
                          ? 'Kelembaban / '
                          : `${key} `
                      const eng = lower.includes('suhu') ? 'Temperature' : lower.includes('kelembaban') ? 'Relative Humidity' : ''
                      return { label, labelEng: eng, value: env?.value || '-' }
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
                          {/* Environment as parameter-as-header table */}
                          {envRows.length > 0 && (
                            <tr>
                              <td className="w-[45%]" />
                              <td className="w-[5%]" />
                              <td className="align-top" colSpan={2}>
                                <div className="text-sm font-bold mb-1">Kondisi Kalibrasi / <span className="italic">Calibration Conditions</span></div>
                                <table className="w-full text-[10px] border-[2px] border-black border-collapse text-center">
                                  <thead>
                                    <tr className="font-bold">
                                      {envRows.map((er, idx) => (
                                        <td key={idx} className="p-1 border border-black text-left">
                                          {er.label}<span className="italic">{er.labelEng}</span>
                                        </td>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {envRows.map((er, idx) => (
                                        <td key={idx} className="p-1 border border-black text-left">{er.value}</td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
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
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-bold text-center">HASIL KALIBRASI / <span className="italic">CALIBRATION RESULT</span></h3>
                    {res.table.map((sec: any, sIdx: number) => {
                      const rows = Array.isArray(sec?.rows) ? sec.rows : []
                      // Parameter-as-header mode: setiap key jadi header kolom, baris berikutnya adalah value
                      const paramHeaderMode = rows.length > 0 && rows.every((r: any) => r && ('key' in r) && ('value' in r))
                      return (
                        <div key={sIdx} className="mt-3 avoid-break">
                          <div className="text-xs font-bold mb-1">{sec?.title || `Tabel ${sIdx + 1}`}</div>
                          {paramHeaderMode ? (
                            <table className="w-full text-[10px] border-[2px] border-black border-collapse text-center">
                              <thead>
                                <tr className="font-bold">
                                  {rows.map((r: any, i: number) => {
                                    const unit = r?.unit ?? r?.satuan
                                    const label = `${r?.key || '-'}` + (unit ? ` ${unit}` : '')
                                    return (
                                      <td key={i} className="p-1 border border-black">{label}</td>
                                    )
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {rows.map((r: any, i: number) => (
                                    <td key={i} className="p-1 border border-black">{r?.value ?? '-'}</td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          ) : null}
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
                      <table className="w-full text-xs mt-2">
                        <tbody>
                          {(nf.others || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)) && (
                            <tr>
                              <td className="w-[35%] align-top text-left pr-2 py-0">
                                <div className="font-bold leading-tight">Standar Kalibrasi</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Calibration Standard</div>
                              </td>
                              <td className="w-[5%] align-top py-0">:</td>
                              <td className="w-[60%] align-top whitespace-pre-line py-0">{nf.others || '-'}</td>
                            </tr>
                          )}
                          {nf.traceable_to_si_through && (
                            <tr>
                              <td className="align-top text-left pr-2 py-0">
                                <div className="font-bold leading-tight">Tertelusur ke SI melalui</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Traceable to SI through</div>
                              </td>
                              <td className="align-top py-0">:</td>
                              <td className="align-top whitespace-pre-line py-0">{nf.traceable_to_si_through}</td>
                            </tr>
                          )}
                          {nf.calibration_methode && (
                            <tr>
                              <td className="align-top text-left pr-2 py-0">
                                <div className="font-bold leading-tight">Metode Kalibrasi</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Calibration Methode</div>
                              </td>
                              <td className="align-top py-0">:</td>
                              <td className="align-top whitespace-pre-line py-0">{nf.calibration_methode}</td>
                            </tr>
                          )}
                          {nf.reference_document && (
                            <tr>
                              <td className="align-top text-left pr-2 py-0">
                                <div className="font-bold leading-tight">Dokumen Acuan</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Reference Document</div>
                              </td>
                              <td className="align-top py-0">:</td>
                              <td className="align-top whitespace-pre-line py-0">{nf.reference_document}</td>
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
                                <div className="font-bold leading-tight">Diverifikasi Oleh</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Verified by</div>
                              </td>
                              <td className="w-[5%] align-top py-0">:</td>
                              <td className="w-[60%] align-top whitespace-pre-line py-0">{verifikator1?.name || '-'}</td>
                            </tr>
                            <tr>
                              <td className="align-top text-left pr-2 py-0">
                                <div className="font-bold leading-tight">Divalidasi Oleh</div>
                                <div className="italic text-[10px] text-gray-700 leading-tight">Validated by</div>
                              </td>
                              <td className="align-top py-0">:</td>
                              <td className="align-top whitespace-pre-line py-0">{verifikator2?.name || '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
                {/* End of Certificate on the last sensor page (always show on last page) */}
                {idx === results.length - 1 && (
                  <p className="text-center font-bold text-sm mt-8">
                    --- Akhir dari Sertifikat / <span className="italic">End of Certificate</span> ---
                  </p>
                )}

              </section>
            </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}

      
    </div>
  )
}

export default PrintCertificatePage