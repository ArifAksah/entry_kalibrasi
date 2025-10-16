'use client'

import React, { useEffect, useState } from 'react'
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
        {/* Certificate Header */}
        <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Image src={bmkgLogo} alt="BMKG" width={80} height={80} className="mr-4" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
                <h2 className="text-xl font-semibold text-gray-700">LABORATORIUM KALIBRASI BMKG</h2>
              </div>
            </div>
            <div className="border-t border-gray-300 my-4"></div>
            <h3 className="text-3xl font-bold text-gray-900 mb-2">SERTIFIKAT KALIBRASI</h3>
            <p className="text-sm italic text-gray-600 mb-4">CALIBRATION CERTIFICATE</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
              <p className="text-lg font-semibold text-blue-900">{cert.no_certificate}</p>
            </div>
          </div>
        </div>

        {/* Detailed Instrument Information */}
        {instrument && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Detail Lengkap Instrumen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <h6 className="text-sm font-semibold text-gray-700 mb-2">Informasi Dasar</h6>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID:</span>
                    <span className="font-medium text-gray-900">{instrument.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nama:</span>
                    <span className="font-medium text-gray-900">{instrument.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pabrikan:</span>
                    <span className="font-medium text-gray-900">{instrument.manufacturer || '-'}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <h6 className="text-sm font-semibold text-gray-700 mb-2">Spesifikasi Teknis</h6>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipe:</span>
                    <span className="font-medium text-gray-900">{instrument.type || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Serial Number:</span>
                    <span className="font-medium text-gray-900">{instrument.serial_number || '-'}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <h6 className="text-sm font-semibold text-gray-700 mb-2">Informasi Tambahan</h6>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lain-lain:</span>
                    <span className="font-medium text-gray-900">{instrument.others || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Certificate Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Instrument Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Identitas Alat
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Nama Alat:</span>
                <span className="text-gray-900">{instrument?.name || (cert?.instrument ? `Instrument ID: ${cert.instrument}` : '-')}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Merek Pabrik:</span>
                <span className="text-gray-900">{instrument?.manufacturer || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Tipe:</span>
                <span className="text-gray-900">{instrument?.type || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Serial Number:</span>
                <span className="text-gray-900">{instrument?.serial_number || '-'}</span>
              </div>
              {instrument?.others && (
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-600">Lain-lain:</span>
                  <span className="text-gray-900">{instrument.others}</span>
                </div>
              )}
            </div>
          </div>

          {/* Station Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Data Stasiun
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Nama Stasiun:</span>
                <span className="text-gray-900">{station ? `${station.name} (${station.station_id})` : '-'}</span>
              </div>
              {resolvedStationAddress && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-600">Alamat:</span>
                  <span className="text-gray-900">{resolvedStationAddress}</span>
                </div>
              )}
              {(station?.province || station?.regency || station?.region) && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-600">Wilayah:</span>
                  <span className="text-gray-900">{[station?.regency, station?.province, station?.region].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Koordinat:</span>
                <span className="text-gray-900">{typeof station?.latitude === 'number' && typeof station?.longitude === 'number' ? `${station.latitude}, ${station.longitude}` : '-'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium text-gray-600">Elevasi:</span>
                <span className="text-gray-900">{typeof station?.elevation === 'number' ? `${station.elevation} m` : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Informasi Sertifikat
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">No. Order:</span>
                <span className="text-gray-900">{cert.no_order || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">No. Identifikasi:</span>
                <span className="text-gray-900">{cert.no_identification || '-'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium text-gray-600">Tanggal Terbit:</span>
                <span className="text-gray-900">{new Date(cert.issue_date).toLocaleDateString('id-ID')}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Dikeluarkan oleh:</span>
                <span className="text-gray-900">{authorized?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Verifikator 1:</span>
                <span className="text-gray-900">{verifikator1?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Verifikator 2:</span>
                <span className="text-gray-900">{verifikator2?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-600">Versi:</span>
                <span className="text-gray-900">{cert.version || '1'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium text-gray-600">Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Aktif
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-center">
                <div className="w-24 h-24 border-2 border-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">QR Code / Cap</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section (if available) */}
        {cert.results && Array.isArray(cert.results) && cert.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Hasil Kalibrasi
            </h3>
            
            <div className="space-y-6">
              {cert.results.map((result: ResultItem, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-gray-800">
                      Hasil Kalibrasi #{index + 1}
                    </h4>
                    <span className="text-sm text-gray-500">Item {index + 1}</span>
                  </div>

                  {/* Sensor Details */}
                  {result.sensorDetails && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="text-sm font-semibold text-blue-900 mb-2">Detail Sensor</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nama:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.name || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pabrikan:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.manufacturer || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tipe:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.type || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Serial Number:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.serial_number || '-'}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Range/Kapasitas:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.range_capacity || '-'} {result.sensorDetails.range_capacity_unit || ''}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Graduating:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.graduating || '-'} {result.sensorDetails.graduating_unit || ''}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Diameter Corong:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.funnel_diameter || '-'} {result.sensorDetails.funnel_diameter_unit || ''}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Volume per Tip:</span>
                            <span className="font-medium text-gray-900">{result.sensorDetails.volume_per_tip || '-'} {result.sensorDetails.volume_per_tip_unit || ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Calibration Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Periode Kalibrasi</h6>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Mulai:</span>
                          <span className="text-gray-900">{result.startDate ? new Date(result.startDate).toLocaleDateString('id-ID') : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Selesai:</span>
                          <span className="text-gray-900">{result.endDate ? new Date(result.endDate).toLocaleDateString('id-ID') : '-'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Tempat Kalibrasi</h6>
                      <p className="text-sm text-gray-900">{result.place || '-'}</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Sensor ID</h6>
                      <p className="text-sm text-gray-900">{result.sensorId || '-'}</p>
                    </div>
                  </div>

                  {/* Environment Conditions */}
                  {result.environment && result.environment.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Kondisi Lingkungan</h6>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {result.environment.map((env, envIndex) => (
                            <div key={envIndex} className="flex justify-between text-sm">
                              <span className="text-gray-600">{env.key}:</span>
                              <span className="font-medium text-gray-900">{env.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Results Table */}
                  {result.table && result.table.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Tabel Hasil</h6>
                      <div className="space-y-3">
                        {result.table.map((section, tableIndex) => (
                          <div key={tableIndex} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <h7 className="text-sm font-semibold text-gray-800 mb-2">{section.title}</h7>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-300">
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700">Parameter</th>
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700">Unit</th>
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700">Nilai</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-b border-gray-200">
                                      <td className="py-1 px-2 text-gray-900">{row.key}</td>
                                      <td className="py-1 px-2 text-gray-600">{row.unit}</td>
                                      <td className="py-1 px-2 font-medium text-gray-900">{row.value}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {result.notesForm && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">Catatan</h6>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Traceable to SI through:</span>
                          <p className="text-gray-900">{result.notesForm.traceable_to_si_through || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Reference Document:</span>
                          <p className="text-gray-900">{result.notesForm.reference_document || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Calibration Method:</span>
                          <p className="text-gray-900">{result.notesForm.calibration_methode || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Others:</span>
                          <p className="text-gray-900">{result.notesForm.others || '-'}</p>
                        </div>
                        {result.notesForm.standardInstruments && result.notesForm.standardInstruments.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">Standard Instruments:</span>
                            <p className="text-gray-900">{result.notesForm.standardInstruments.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
