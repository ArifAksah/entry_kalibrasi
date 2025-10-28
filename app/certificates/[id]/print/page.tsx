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

  // Data hasil kalibrasi (kita asumsikan hanya ada 1 result item untuk UI ini)
  const resultData = useMemo(() => (cert?.results && cert.results.length > 0 ? cert.results[0] : null), [cert])

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
      /* Ensure watermark is visible */
      .watermark {
        visibility: visible !important;
        opacity: 0.3 !important;
      }
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
                <td className="align-top font-semibold">{instrument?.others || '-'}</td>
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
      
      {/* --- HALAMAN 2 --- */}
      <div className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0">
        {/* Header Halaman 2 */}
        <header className="flex justify-between items-start text-xs mb-4">
          <div className="w-[60px]">
            <Image src={bmkgLogo} alt="BMKG" width={60} height={60} priority />
            <span className="font-bold text-center block">BMKG</span>
          </div>
          <div className="flex-1 flex justify-between items-start">
            <table className="text-xs">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2">No. Sertifikat / <span className="italic">Certificate Number</span></td>
                  <td>: {cert.no_certificate}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">No. Order / <span className="italic">Order Number</span></td>
                  <td>: {cert.no_order}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Halaman / <span className="italic">Page</span></td>
                  <td>: 2 dari 3</td>
                </tr>
              </tbody>
            </table>
            <div className="w-16 h-16 border border-black flex items-center justify-center bg-white qr-code-container">
              <QRCodeWithBMKGLogo
                value={qrCodeData}
                size={60}
                logoSize={22}
              />
            </div>
          </div>
        </header>
        
        {/* Konten Halaman 2 */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          {/* Kolom Kiri: Info Alat & Kalibrasi */}
          <div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-[45%] align-top font-semibold">Nama Alat / <span className="italic">Instrument Name</span></td>
                  <td className="w-[5%] align-top">:</td>
                  <td className="w-[50%] align-top">{instrument?.name || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top font-semibold">Merk Alat / <span className="italic">Manufacturer</span></td>
                  <td className="align-top">:</td>
                  <td className="align-top">{instrument?.manufacturer || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top font-semibold">Tipe & No. Seri / <span className="italic">Type & Serial Number</span></td>
                  <td className="align-top">:</td>
                  <td className="align-top">{instrument?.type || '-'} / {instrument?.serial_number || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top font-semibold pt-2">Tanggal Masuk / <span className="italic">Registered Date</span></td>
                  <td className="align-top pt-2">:</td>
                  <td className="align-top pt-2">{resultData?.startDate ? new Date(resultData.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td>
                </tr>
                <tr>
                  <td className="align-top font-semibold">Tanggal Kalibrasi / <span className="italic">Calibration Date</span></td>
                  <td className="align-top">:</td>
                  <td className="align-top">{resultData?.endDate ? new Date(resultData.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td>
                </tr>
                <tr>
                  <td className="align-top font-semibold">Tempat Kalibrasi / <span className="italic">Calibration Place</span></td>
                  <td className="align-top">:</td>
                  <td className="align-top whitespace-pre-line">{resultData?.place || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Kolom Kanan: Kondisi Ruang */}
          <div>
            <h3 className="text-sm font-bold">Kondisi Ruang / <span className="italic">Environment</span></h3>
            <table className="w-full text-xs mt-2 border-2 border-black">
              <tbody>
                <tr>
                  <td className="w-[50%] p-1 border border-black font-semibold">Suhu Ruang / <span className="italic">Room Temperature</span></td>
                  <td className="w-[50%] p-1 border border-black">{resultData?.environment.find(e => e.key.includes("Suhu"))?.value || '-'}</td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-semibold">Kelembaban / <span className="italic">Relative Humidity</span></td>
                  <td className="p-1 border border-black">{resultData?.environment.find(e => e.key.includes("Kelembaban"))?.value || '-'}</td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-semibold">Nilai konstanta g / <span className="italic">g constant value</span></td>
                  <td className="p-1 border border-black">{resultData?.environment.find(e => e.key.includes("g"))?.value || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Hasil Kalibrasi & Tabel 1 */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-center">HASIL KALIBRASI / <span className="italic">CALIBRATION RESULT</span></h3>
          <p className="text-xs font-bold text-center mt-2">Tabel 1: Nilai Tegangan Pada Akselerograf Digital</p>
          
          {/* --- TABEL 1 --- */}
          {/* CATATAN: Struktur tabel ini sangat spesifik. 
            Struktur data 'cert.results[0].table' Anda mungkin tidak cocok.
            Saya akan meniru layout PDF dan Anda harus memetakan data Anda ke sini.
            Saya akan menggunakan data hardcode dari PDF sebagai placeholder.
          */}
          <table className="w-full text-xs mt-2 border-2 border-black text-center">
            <thead className="font-bold bg-gray-100">
              <tr>
                <td className="p-1 border border-black" rowSpan={2}>Komponen</td>
                <td className="p-1 border border-black" rowSpan={2}></td>
                <td className="p-1 border border-black">Sensitivitas</td>
                <td className="p-1 border border-black" rowSpan={2}>Unc</td>
              </tr>
              <tr>
                <td className="p-1 border border-black">(V/(m/s²))</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-1 border border-black font-semibold" rowSpan={2}>UD</td>
                <td className="p-1 border border-black font-semibold text-left pl-2">(Z)</td>
                <td className="p-1 border border-black">0.0013</td>
                <td className="p-1 border border-black">0.00000009</td>
              </tr>
              <tr>
                <td className="p-1 border border-black font-semibold text-left pl-2">(-Z)</td>
                <td className="p-1 border border-black">-0.51</td>
                <td className="p-1 border border-black">0.00000042</td>
              </tr>
              <tr>
                <td className="p-1 border border-black font-semibold" rowSpan={2}>NS</td>
                <td className="p-1 border border-black font-semibold text-left pl-2">(Y)</td>
                <td className="p-1 border border-black">0.51</td>
                <td className="p-1 border border-black">0.00000007</td>
              </tr>
              <tr>
                <td className="p-1 border border-black font-semibold text-left pl-2">(-Y)</td>
                <td className="p-1 border border-black">-0.51</td>
                <td className="p-1 border border-black">0.00000058</td>
              </tr>
              <tr>
                <td className="p-1 border border-black font-semibold" rowSpan={2}>EW</td>
                <td className="p-1 border border-black font-semibold text-left pl-2">(X)</td>
                <td className="p-1 border border-black">0.51</td>
                <td className="p-1 border border-black">0.00000018</td>
              </tr>
              <tr>
                <td className="p-1 border border-black font-semibold text-left pl-2">(-X)</td>
                <td className="p-1 border border-black">-0.51</td>
                <td className="p-1 border border-black">0.00000025</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* --- HALAMAN 3 --- */}
      <div className="page-container bg-white shadow-lg my-4 print:shadow-none print:my-0">
        {/* Header Halaman 3 */}
        <header className="flex justify-between items-start text-xs mb-4">
          <div className="w-[60px]">
            <Image src={bmkgLogo} alt="BMKG" width={60} height={60} priority />
            <span className="font-bold text-center block">BMKG</span>
          </div>
          <div className="flex-1 flex justify-between items-start">
            <table className="text-xs">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2">No. Sertifikat / <span className="italic">Certificate Number</span></td>
                  <td>: {cert.no_certificate}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">No. Order / <span className="italic">Order Number</span></td>
                  <td>: {cert.no_order}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Halaman / <span className="italic">Page</span></td>
                  <td>: 3 dari 3</td>
                </tr>
              </tbody>
            </table>
            <div className="w-16 h-16 border border-black flex items-center justify-center bg-white qr-code-container">
              <QRCodeWithBMKGLogo
                value={qrCodeData}
                size={60}
                logoSize={22}
              />
            </div>
          </div>
        </header>

        {/* Gambar Sinyal Kalibrasi */}
        <div className="mt-6">
          <div className="w-full h-64 border-2 border-black flex items-center justify-center text-gray-500">
            [Placeholder untuk Gambar 1. Sinyal Kalibrasi]
            {/* Anda bisa menggunakan <Image> di sini jika Anda memiliki URL untuk gambar tersebut 
              <Image src={resultData?.calibrationSignalImageUrl || '/placeholder.png'} layout="fill" objectFit="contain" alt="Sinyal Kalibrasi" />
            */}
          </div>
          <p className="text-center text-xs font-semibold mt-1">Gambar 1. Sinyal Kalibrasi</p>
        </div>

        {/* Catatan */}
        <div className="mt-6">
          <h3 className="text-sm font-bold">Catatan / <span className="italic">Notes:</span></h3>
          <table className="w-full text-xs mt-2">
            <tbody>
              <tr>
                <td className="w-[30%] align-top"><PdfLabel indo="Kalibrator" eng="Calibrator" /></td>
                <td className="w-[5%] align-top">:</td>
                <td className="w-[65%] align-top whitespace-pre-line">{resultData?.notesForm.standardInstruments.join('\n') || '1. Digital Inclinometer / Shenzen TOMTOP Technology\n2. Tilt Table Analog'}</td>
              </tr>
              <tr>
                <td className="align-top pt-2"><PdfLabel indo="Tertelusur Ke SI melalui" eng="Traceable to SI through" /></td>
                <td className="align-top pt-2">:</td>
                <td className="align-top pt-2">{resultData?.notesForm.traceable_to_si_through || 'Laboratorium Kalibrasi BMKG'}</td>
              </tr>
              <tr>
                <td className="align-top pt-2"><PdfLabel indo="Metode Kalibrasi" eng="Calibration Standard" /></td>
                <td className="align-top pt-2">:</td>
                <td className="align-top pt-2 whitespace-pre-line">{resultData?.notesForm.calibration_methode || 'Tilting, yaitu dengan memiringkan Unit Under Test (UUT)...'}</td>
              </tr>
              <tr>
                <td className="align-top pt-2"><PdfLabel indo="Dokumen Acuan" eng="Reference Document" /></td>
                <td className="align-top pt-2">:</td>
                <td className="align-top pt-2">{resultData?.notesForm.reference_document || 'Titan User Guide April 17, 2025'}</td>
              </tr>
              <tr className="text-[10px] text-gray-700">
                <td colSpan={3} className="pt-4">
                  Sertifikat ini hanya berlaku untuk peralatan dengan identitas yang dinyatakan di atas / <span className="italic">This certificate only applies to equipment with the identity stated above.</span>
                </td>
              </tr>
              <tr>
                <td className="align-top pt-4"><PdfLabel indo="Diverifikasi oleh" eng="Verified by" /></td>
                <td className="align-top pt-4">:</td>
                <td className="align-top pt-4 font-semibold">
                  1. {verifikator1?.name || '-'}<br/>
                  2. {verifikator2?.name || '-'}
                </td>
              </tr>
            </tbody>
          </table>
          
          <p className="text-center font-bold text-sm mt-8">
            --- Akhir dari Sertifikat / <span className="italic">End of Certificate</span> ---
          </p>
        </div>
        
      </div>
    </div>
  )
}

export default PrintCertificatePage