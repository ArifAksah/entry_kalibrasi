'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import bmkgLogo from '../../../bmkg.png'
import QRCode from 'react-qr-code'

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
  results?: any
  version?: number
}

type KV = { key: string; value: string }
type TableRow = { key: string; unit: string; value: string }
type TableSection = { title: string; rows: TableRow[] }
type ResultItem = {
  sensorId: number | null
  startDate: string
  endDate: string
  place: string
  environment: KV[]
  table: TableSection[]
  notesForm: { 
    traceable_to_si_through: string; 
    reference_document: string; 
    calibration_methode: string; 
    others: string;
    standardInstruments: number[]
  }
  sensorDetails?: any
}

type Station = {
  id: number
  name: string
  station_id: string
  address?: string | null
  type?: string | null
  latitude?: number | null
  longitude?: number | null
  elevation?: number | null
  time_zone?: string | null
  region?: string | null
  province?: string | null
  regency?: string | null
}

type Instrument = {
  id: number
  name?: string | null
  manufacturer?: string | null
  type?: string | null
  serial_number?: string | null
  others?: string | null
}

type Personel = { 
  id: string
  name: string | null 
}

const ViewCertificatePage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cert, setCert] = useState<Cert | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])

  const station = stations.find(s => s.id === (cert?.station ?? -1)) || null
  const resolvedStationAddress = (cert?.station_address ?? null) || (station?.address ?? null)
  const instrument = instruments.find(i => i.id === (cert?.instrument ?? -1)) || null
  const authorized = personel.find(p => p.id === (cert?.authorized_by ?? '')) || null
  const verifikator1 = personel.find(p => p.id === (cert?.verifikator_1 ?? '')) || null
  const verifikator2 = personel.find(p => p.id === (cert?.verifikator_2 ?? '')) || null

  const totalPrintedPages = (Array.isArray(cert?.results) ? cert.results.length : 0) + 2

  const sensorsSummary = (() => {
    const r: any[] = Array.isArray(cert?.results) ? (cert?.results as any[]) : []
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

  useEffect(() => {
    const id = Number(params.id)
    if (!id) {
      setError('Invalid certificate id')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        console.log('Loading certificate data for ID:', id)
        
        const [cRes, iRes, pRes] = await Promise.all([
          fetch(`/api/certificates/${id}`),
          fetch('/api/instruments?page=1&pageSize=100'),
          fetch('/api/personel'),
        ])
        
        const c = await cRes.json()
        const i = await iRes.json()
        const p = await pRes.json()
        
        console.log('Certificate data:', c)
        console.log('Instruments data:', i)
        console.log('Personel data:', p)
        
        if (!cRes.ok) throw new Error(c?.error || 'Failed to load certificate')
        
        // Ensure certificate data is properly set
        if (c && typeof c === 'object') {
          setCert(c)
          console.log('Certificate set:', c)
        } else {
          throw new Error('Invalid certificate data received')
        }
        
        // Handle instruments data properly
        const instrumentsData = Array.isArray(i) ? i : (i?.data ?? [])
        console.log('Processed instruments:', instrumentsData)
        setInstruments(instrumentsData)
        
        // Handle personel data properly
        const personelData = Array.isArray(p) ? p : []
        console.log('Processed personel:', personelData)
        setPersonel(personelData)
        
        // Fetch all stations across pages to ensure mapping available
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
        } catch (e) {
          console.error('Error loading stations:', e)
        }
        
      } catch (e) {
        console.error('Error loading data:', e)
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certificate...</p>
        </div>
      </div>
    )
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Certificate not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Image src={bmkgLogo} alt="BMKG" width={40} height={40} className="mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Certificate View</h1>
                <p className="text-sm text-gray-500">Sertifikat Kalibrasi - {cert.no_certificate}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/certificates/${cert.id}/print`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Certificate first page mirror of draft preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative">
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30"
            style={{
              backgroundImage: `url(${bmkgLogo.src})`,
              backgroundSize: '700px 700px',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center 5%'
            }}
          />
          <div className="relative z-10">
            {/* Header */}
            <div className="mb-8">
              <header className="flex flex-row items-center justify-between border-b-4 border-black pb-2">
                <div className="w-[80px] flex items-center justify-center">
                  <img src={bmkgLogo.src} alt="BMKG" className="h-20 w-20 object-contain" />
                </div>
                <div className="text-center leading-tight">
                  <h1 className="text-base font-bold text-gray-900">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
                  <h2 className="text-base font-bold text-gray-900">LABORATORIUM KALIBRASI BMKG</h2>
                </div>
                <div className="w-[80px]" />
              </header>

              {/* Title */}
              <div className="text-center my-6">
                <h1 className="text-xl font-bold tracking-wide text-gray-900">SERTIFIKAT KALIBRASI</h1>
                <h2 className="text-base italic text-gray-700">CALIBRATION CERTIFICATE</h2>
                <div className="text-sm font-semibold mt-2 text-gray-900">{cert.no_certificate || '-'}</div>
              </div>

              {/* Left sections */}
              <div className="mt-6">
                <div>
                  {/* Identitas Alat */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900">IDENTITAS ALAT</h3>
                    <h4 className="text-xs italic text-gray-600 mb-2">Instrument Details</h4>
                    <table className="w-full text-xs"><tbody>
                      <tr>
                        <td className="w-[32%] align-top pr-2">
                          <div className="font-semibold">Nama Alat</div>
                          <div className="text-[10px] italic text-gray-600">Instrument Name</div>
                        </td>
                        <td className="w-[3%] align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold">{instrument?.name || '-'}</div></div></td>
                      </tr>
                      <tr>
                        <td className="align-top pr-2">
                          <div className="font-semibold">Merek Pabrik</div>
                          <div className="text-[10px] italic text-gray-600">Manufacturer</div>
                        </td>
                        <td className="align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold">{instrument?.manufacturer || '-'}</div></div></td>
                      </tr>
                      <tr>
                        <td className="align-top pr-2">
                          <div className="font-semibold">Tipe / Nomor Seri</div>
                          <div className="text-[10px] italic text-gray-600">Type / Serial Number</div>
                        </td>
                        <td className="align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold">{(instrument?.type || '-') + ' / ' + (instrument?.serial_number || '-')}</div></div></td>
                      </tr>
                      <tr>
                        <td className="align-top pr-2">
                          <div className="font-semibold">Lain-lain</div>
                          <div className="text-[10px] italic text-gray-600">Others</div>
                        </td>
                        <td className="align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold whitespace-pre-line">{sensorsSummary}</div></div></td>
                      </tr>
                    </tbody></table>
                  </div>

                  {/* Identitas Pemilik */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">IDENTITAS PEMILIK</h3>
                    <h4 className="text-xs italic text-gray-600 mb-2">Owner Identification</h4>
                    <table className="w-full text-xs"><tbody>
                      <tr>
                        <td className="w-[32%] align-top pr-2">
                          <div className="font-semibold">Nama</div>
                          <div className="text-[10px] italic text-gray-600">Designation</div>
                        </td>
                        <td className="w-[3%] align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold">{station?.name || '-'}</div></div></td>
                      </tr>
                      <tr>
                        <td className="align-top pr-2">
                          <div className="font-semibold">Alamat</div>
                          <div className="text-[10px] italic text-gray-600">Address</div>
                        </td>
                        <td className="align-top">:</td>
                        <td className="align-top"><div className="inline-flex items-start w-full"><div className="flex-1 font-semibold">{resolvedStationAddress || '-'}</div></div></td>
                      </tr>
                    </tbody></table>
                  </div>
                </div>

                {/* Right aligned authorization with QR */}
                <div className="mt-6 flex justify-end">
                  <div className="text-xs w-[300px]">
                    <div className="mb-2">
                      <div className="font-semibold">Sertifikat ini terdiri atas {totalPrintedPages} halaman</div>
                      <div className="text-[10px] italic text-gray-700">This certificate comprises of pages</div>
                    </div>
                    <div className="mb-4">
                      <div className="font-semibold">Diterbitkan tanggal {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</div>
                      <div className="text-[10px] italic text-gray-700">Date of issue</div>
                    </div>
                    <div className="mb-4">
                      <div className="font-semibold">Kepala Pusat Instrumentasi,</div>
                      <div className="font-semibold">Kalibrasi dan Rekayasa</div>
                    </div>
                    <div className="flex justify-start mb-2">
                      <div className="w-20 h-20 border-2 border-black flex items-center justify-center bg-white relative">
                        <QRCode value={JSON.stringify({ certificateNumber: cert.no_certificate, orderNumber: cert.no_order, issueDate: cert.issue_date, instrumentName: instrument?.name || '', manufacturer: instrument?.manufacturer || '', serialNumber: instrument?.serial_number || '', stationName: station?.name || '', authorizedBy: authorized?.name || '', verifikator1: verifikator1?.name || '', verifikator2: verifikator2?.name || '', version: cert.version || 1 })} size={64} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
                        <img src={bmkgLogo.src} alt="BMKG" className="absolute w-5 h-5 object-contain" style={{ inset: '0', margin: 'auto' }} />
                      </div>
                    </div>
                    <div className="font-bold underline">{authorized?.name || '-'}</div>
                    <div className="text-xs font-semibold underline mt-1">Assignor</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Footer like print */}
            <footer className="mt-6 text-xs">
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
        </div>

        {/* Results Section (mirror print layout) */}
        {cert.results && Array.isArray(cert.results) && cert.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Hasil Kalibrasi
            </h3>
            <div className="space-y-6">
              {(cert.results as ResultItem[]).map((res: ResultItem, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-gray-800">Hasil Kalibrasi #{index + 1}</h4>
                    <span className="text-sm text-gray-500">Item {index + 1}</span>
                  </div>

                  {/* Sensor Details + Environment (unified 4-col) */}
                  {(() => {
                    const sd: any = res?.sensorDetails || {}
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
                    const envRows: Array<{ label: string; labelEng: string; value: React.ReactNode }> = (res?.environment || []).map((env: any) => {
                      const key = String(env?.key || '')
                      const lower = key.toLowerCase()
                      const label = lower.includes('suhu') ? 'Suhu / ' : lower.includes('kelembaban') ? 'Kelembaban / ' : `${key} `
                      const eng = lower.includes('suhu') ? 'Temperature' : lower.includes('kelembaban') ? 'Relative Humidity' : ''
                      return { label, labelEng: eng, value: env?.value || '-' }
                    })
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

                  {/* Calibration Result Tables (units appended) */}
                  {Array.isArray(res?.table) && res.table.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h5 className="text-sm font-bold text-center">HASIL KALIBRASI / <span className="italic">CALIBRATION RESULT</span></h5>
                      {res.table.map((sec: any, sIdx: number) => {
                        const rows = Array.isArray(sec?.rows) ? sec.rows : []
                        const useFourCol = rows.length >= 4 && rows.slice(0,4).every((r: any) => r && 'key' in r && 'unit' in r && 'value' in r)
                        return (
                          <div key={sIdx} className="mt-2">
                            <div className="text-xs font-bold mb-1">{sec?.title || `Tabel ${sIdx + 1}`}</div>
                            {useFourCol ? (
                              <table className="w-full text-xs border-[2px] border-black border-collapse text-center">
                                <thead>
                                  <tr className="font-bold">
                                    {rows.slice(0,4).map((r: any, i: number) => {
                                      const label = `${r?.key || '-'}` + (r?.unit ? ` ${r.unit}` : '')
                                      return (
                                        <td key={i} className="p-1 border border-black">{label}</td>
                                      )
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {rows.slice(0,4).map((r: any, i: number) => (
                                      <td key={i} className="p-1 border border-black text-left">{r?.value || '-'}</td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            ) : (
                              <table className="w-full text-xs border-[2px] border-black text-center border-collapse">
                                <thead>
                                  <tr className="font-bold">
                                    <td className="p-1 border border-black">Parameter</td>
                                    <td className="p-1 border border-black">Nilai</td>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row: any, rIdx: number) => {
                                    const label = `${row?.key || '-'}` + (row?.unit ? ` ${row.unit}` : '')
                                    return (
                                      <tr key={rIdx}>
                                        <td className="p-1 border border-black text-left">{label}</td>
                                        <td className="p-1 border border-black text-left">{row?.value || '-'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Images per sensor only for Geofisika */}
                  {station?.type?.toString().trim().toLowerCase() === 'geofisika' && Array.isArray((res as any).images) && (res as any).images.length > 0 && (
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

                  {/* Notes per sensor */}
                  {(() => {
                    const nf: any = res?.notesForm || null
                    if (!nf) return null
                    const hasAny = nf.traceable_to_si_through || nf.reference_document || nf.calibration_methode || nf.others || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)
                    if (!hasAny) return null
                    return (
                      <div className="mt-6">
                        <h5 className="text-sm font-bold">Catatan / <span className="italic">Notes</span> :</h5>
                        <table className="w-full text-xs mt-2">
                          <tbody>
                            {(nf.others || (Array.isArray(nf.standardInstruments) && nf.standardInstruments.length > 0)) && (
                              <tr>
                                <td className="w-[35%] align-top text-left pr-2">
                                  <div className="font-bold leading-tight">Standar Kalibrasi</div>
                                  <div className="italic text-[10px] text-gray-700 leading-tight">Calibration Standard</div>
                                </td>
                                <td className="w-[5%] align-top">:</td>
                                <td className="w-[60%] align-top whitespace-pre-line">{nf.others || '-'}</td>
                              </tr>
                            )}
                            {nf.traceable_to_si_through && (
                              <tr>
                                <td className="align-top text-left pr-2">
                                  <div className="font-bold leading-tight">Tertelusur ke SI melalui</div>
                                  <div className="italic text-[10px] text-gray-700 leading-tight">Traceable to SI through</div>
                                </td>
                                <td className="align-top">:</td>
                                <td className="align-top whitespace-pre-line">{nf.traceable_to_si_through}</td>
                              </tr>
                            )}
                            {nf.calibration_methode && (
                              <tr>
                                <td className="align-top text-left pr-2">
                                  <div className="font-bold leading-tight">Metode Kalibrasi</div>
                                  <div className="italic text-[10px] text-gray-700 leading-tight">Calibration Methode</div>
                                </td>
                                <td className="align-top">:</td>
                                <td className="align-top whitespace-pre-line">{nf.calibration_methode}</td>
                              </tr>
                            )}
                            {nf.reference_document && (
                              <tr>
                                <td className="align-top text-left pr-2">
                                  <div className="font-bold leading-tight">Dokumen Acuan</div>
                                  <div className="italic text-[10px] text-gray-700 leading-tight">Reference Document</div>
                                </td>
                                <td className="align-top">:</td>
                                <td className="align-top whitespace-pre-line">{nf.reference_document}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <div className="mt-2 space-y-1 text-xs">
                          <div>
                            <div className="font-bold">Penunjukan nilai sebenarnya didapat dari penunjukan alat ditambah koreksi.</div>
                            <div className="text-[10px] italic text-gray-700">The true value is determined from the instrument reading added by its correction.</div>
                          </div>
                          <div>
                            <div className="font-bold">Sertifikat ini hanya berlaku untuk peralatan dengan identitas yang dinyatakan di atas.</div>
                            <div className="text-[10px] italic text-gray-700">This certificate only applies to equipment with the identity stated above.</div>
                          </div>
                          <div>
                            <div className="font-bold">Ketidakpastian pengukuran dinyatakan pada tingkat kepercayaan tidak kurang dari 95 % dengan faktor cakupan k = 2,01</div>
                            <div className="text-[10px] italic text-gray-700">Uncertainty of measurement is expressed at a confidence level of no less than 95 % with coverage factor k = 2.01</div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewCertificatePage
