'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import bmkgLogo from '../../../bmkg.png'

type Cert = {
  id: number
  no_certificate: string
  no_order: string
  no_identification: string
  issue_date: string
  station: number | null
  instrument: number | null
  authorized_by: string | null
  station_address?: string | null
}

type Station = {
  id: number
  name: string
  station_id: string
  address?: string | null
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
type Personel = { id: string; name: string | null }

const PrintCertificatePage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cert, setCert] = useState<Cert | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])

  const station = useMemo(() => stations.find(s => s.id === (cert?.station ?? -1)) || null, [stations, cert])
  const resolvedStationAddress = useMemo(() => (cert?.station_address ?? null) || (station?.address ?? null), [cert, station])
  const instrument = useMemo(() => instruments.find(i => i.id === (cert?.instrument ?? -1)) || null, [instruments, cert])
  const authorized = useMemo(() => personel.find(p => p.id === (cert?.authorized_by ?? '')) || null, [personel, cert])

  useEffect(() => {
    const id = Number(params.id)
    if (!id) {
      setError('Invalid certificate id')
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const [cRes, iRes, pRes] = await Promise.all([
          fetch(`/api/certificates/${id}`),
          fetch('/api/instruments'),
          fetch('/api/personel'),
        ])
        const c = await cRes.json()
        const i = await iRes.json()
        const p = await pRes.json()
        if (!cRes.ok) throw new Error(c?.error || 'Failed to load certificate')
        setCert(c)
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
        } catch {}
        setInstruments(Array.isArray(i) ? i : [])
        setPersonel(Array.isArray(p) ? p : [])
        setTimeout(() => window.print(), 300)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>
  if (error || !cert) return <div className="p-8 text-red-600">{error || 'Not found'}</div>

  return (
    <div className="p-6 print:p-0 bg-white text-slate-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="relative max-w-[210mm] mx-auto border border-gray-300 p-8 print:border-0 overflow-hidden">
        {/* Watermark */}
        <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-10 print:opacity-10">
          <Image
            src={bmkgLogo}
            alt="BMKG Watermark"
            width={600}
            height={600}
            className="w-[80%] h-auto object-contain"
            priority
          />
        </div>
        {/* Header */}
        <div className="pb-2">
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <Image src={bmkgLogo} alt="BMKG" width={150} height={150} />
            </div>
            <div className="flex-1 text-center leading-tight">
              <h1 className="text-base font-extrabold uppercase tracking-wide text-black">
                BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA
              </h1>
              <h2 className="text-base font-extrabold uppercase tracking-wide text-black mt-1">
                LABORATORIUM KALIBRASI BMKG
              </h2>
            </div>
          </div>
          <div className="mt-2">
            <div className="border-t border-black" />
            <div className="border-t-2 border-black mt-1" />
          </div>
        </div>

        {/* Title Block below header */}
        <div className="text-center mt-4 mb-6">
          <h1 className="text-2xl font-extrabold tracking-wide">SERTIFIKAT KALIBRASI</h1>
          <div className="text-[11px] italic uppercase text-gray-700 -mt-0.5">CALIBRATION CERTIFICATE</div>
          <div className="text-sm font-semibold mt-1">{cert.no_certificate || '-'}</div>
        </div>

        {/* Identitas Alat */}
        <div className="mb-4">
          <div className="text-sm font-bold leading-4">IDENTITAS ALAT</div>
          <div className="text-[10px] italic text-gray-700 -mt-0.5 mb-2">Instrument Details</div>
          <table className="w-full table-fixed text-sm">
            <tbody>
              <tr>
                <td className="w-[42%] align-top pr-2">
                  <div className="font-semibold leading-4">Nama Alat</div>
                  <div className="text-[10px] italic text-gray-700 -mt-0.5">Instrument Name</div>
                </td>
                <td className="align-top">: {instrument?.name || '-'}</td>
              </tr>
              <tr>
                <td className="align-top pr-2">
                  <div className="font-semibold leading-4">Merek Pabrik</div>
                  <div className="text-[10px] italic text-gray-700 -mt-0.5">Manufacturer</div>
                </td>
                <td className="align-top">: {instrument?.manufacturer || '-'}</td>
              </tr>
              <tr>
                <td className="align-top pr-2">
                  <div className="font-semibold leading-4">Tipe / Nomor Seri</div>
                  <div className="text-[10px] italic text-gray-700 -mt-0.5">Type / Serial Number</div>
                </td>
                <td className="align-top">: {instrument?.type || '-'} / {instrument?.serial_number || '-'}</td>
              </tr>
              <tr>
                <td className="align-top pr-2">
                  <div className="font-semibold leading-4">Lain-lain</div>
                  <div className="text-[10px] italic text-gray-700 -mt-0.5">Others</div>
                </td>
                <td className="align-top">: {instrument?.others || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Station Block */}
        <h2 className="text-sm font-bold mb-1">DATA STASIUN</h2>
        <table className="w-full table-fixed border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="w-1/3 border p-2">Nama Stasiun</td>
              <td className="border p-2">{station ? `${station.name} (${station.station_id})` : '-'}</td>
            </tr>
            {resolvedStationAddress && (
              <tr>
                <td className="border p-2">Alamat</td>
                <td className="border p-2">{resolvedStationAddress}</td>
              </tr>
            )}
            {(station?.province || station?.regency || station?.region) && (
              <tr>
                <td className="border p-2">Wilayah</td>
                <td className="border p-2">{[station?.regency, station?.province, station?.region].filter(Boolean).join(', ')}</td>
              </tr>
            )}
            <tr>
              <td className="border p-2">Koordinat</td>
              <td className="border p-2">{typeof station?.latitude === 'number' && typeof station?.longitude === 'number' ? `${station.latitude}, ${station.longitude}` : '-'}</td>
            </tr>
            <tr>
              <td className="border p-2">Elevasi</td>
              <td className="border p-2">{typeof station?.elevation === 'number' ? `${station.elevation} m` : '-'}</td>
            </tr>
            {station?.time_zone && (
              <tr>
                <td className="border p-2">Zona Waktu</td>
                <td className="border p-2">{station.time_zone}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Instrument Block */}
        <h2 className="text-sm font-bold mb-1">DATA INSTRUMEN</h2>
        <table className="w-full table-fixed border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="w-1/3 border p-2">Nama Instrumen</td>
              <td className="border p-2">{instrument?.name || '-'}</td>
            </tr>
            <tr>
              <td className="border p-2">Pabrikan</td>
              <td className="border p-2">{instrument?.manufacturer || '-'}</td>
            </tr>
            <tr>
              <td className="border p-2">Tipe</td>
              <td className="border p-2">{instrument?.type || '-'}</td>
            </tr>
            <tr>
              <td className="border p-2">Serial Number</td>
              <td className="border p-2">{instrument?.serial_number || '-'}</td>
            </tr>
            {instrument?.others && (
              <tr>
                <td className="border p-2">Lainnya</td>
                <td className="border p-2">{instrument.others}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-10">
          <div>
            <p className="text-sm">Dikeluarkan oleh,</p>
            <div className="h-16" />
            <p className="font-semibold">{authorized?.name || '-'}</p>
            <p className="text-xs text-gray-600">Authorized</p>
          </div>
          <div className="text-right">
            <p className="text-sm">Cap / QR</p>
            <div className="w-24 h-24 border border-gray-300 rounded ml-auto" />
          </div>
        </div>

        {/* Controls (hidden on print) */}
        <div className="mt-8 flex items-center justify-end gap-3 print:hidden">
          <button onClick={() => router.back()} className="px-4 py-2 border rounded-lg">Back</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Print</button>
        </div>
      </div>

      {/* PAGE 2 - Layout mengikuti contoh PDF */}
      <div
        className="relative max-w-[210mm] mx-auto border border-gray-300 p-8 print:border-0 overflow-hidden"
        style={{ breakBefore: 'page', pageBreakBefore: 'always', minHeight: '297mm' as any }}
      >
        {/* Header (halaman 2+) */}
        <div className="pb-2">
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <Image src={bmkgLogo} alt="BMKG" width={64} height={64} />
              <span className="text-[10px] font-bold leading-4">BMKG</span>
            </div>
            <div className="flex-1 text-center leading-tight">
              <h1 className="text-base font-extrabold uppercase tracking-wide text-black">
                BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA
              </h1>
              <h2 className="text-base font-extrabold uppercase tracking-wide text-black mt-1">
                LABORATORIUM KALIBRASI BMKG
              </h2>
            </div>
          </div>
          <div className="mt-2">
            <div className="border-t border-black" />
            <div className="border-t-2 border-black mt-1" />
          </div>
        </div>

        {/* Konten Utama */}
        <div className="mt-6 grid grid-cols-5 gap-4">
          {/* Kolom kiri: Identitas Lokasi */}
          <div className="col-span-3">
            <div className="text-sm font-bold leading-4">IDENTITAS LOKASI</div>
            <div className="text-[10px] italic text-gray-700 -mt-0.5 mb-2">Location Identification</div>

            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="align-top w-[32%] pr-2">
                    <div className="font-semibold leading-4">Nama</div>
                    <div className="text-[10px] italic -mt-0.5">Designation</div>
                  </td>
                  <td className="align-top">: {station?.name || '-'}</td>
                </tr>
                <tr>
                  <td className="align-top pr-2">
                    <div className="font-semibold leading-4">Alamat</div>
                    <div className="text-[10px] italic -mt-0.5">Address</div>
                  </td>
                  <td className="align-top">: {resolvedStationAddress || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kolom kanan: Informasi terbit & tanda tangan */}
          <div className="col-span-2">
            <div className="text-sm font-semibold">Sertifikat ini terdiri atas beberapa halaman</div>
            <div className="text-[10px] italic -mt-0.5">This certificate comprises of pages</div>
            <div className="text-sm font-semibold mt-2">Diterbitkan tanggal {new Date(cert.issue_date).toLocaleDateString()}</div>
            <div className="text-[10px] italic -mt-0.5">Date of issue</div>

            <div className="mt-6 font-semibold text-sm">Kepala Pusat Instrumentasi,</div>
            <div className="font-semibold text-sm -mt-1">Kalibrasi dan Rekayasa</div>

            <div className="mt-3 flex items-center gap-4">
              <div className="w-16 h-16 border border-gray-400" />
              <div className="text-xs text-gray-600">QR/Cap</div>
            </div>

            <div className="h-10" />
            <div className="font-semibold">{authorized?.name || '-'}</div>
          </div>
        </div>

        {/* Footer info ringkas (alamat dsb.) */}
        <div className="absolute inset-x-0 bottom-6 text-center text-[10px] text-gray-700">
          <div className="mx-8 border-t border-gray-400 mb-2" />
          <div>Jl. Angkasa I No. 2 Kemayoran Jakarta Pusat • Telp. 021-4246321 ext 9344 • Fax 021-4246703/23 • P.O. Box 3540 Jkt • Website: bmkg.go.id</div>
        </div>
      </div>
    </div>
  )
}

export default PrintCertificatePage



