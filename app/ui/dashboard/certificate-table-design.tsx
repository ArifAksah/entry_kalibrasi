'use client'

import React, { useState } from 'react'
import { Certificate, Station, Instrument } from '../../../lib/supabase'

// Status Button Component
const StatusButton: React.FC<{ status: string; type: 'verifikator' | 'penandatangan' | 'kirim' | 'berkas' }> = ({ status, type }) => {
  const getStatusColor = (status: string, type: string) => {
    if (status.includes('BELUM') || status.includes('NOT YET')) {
      return 'bg-orange-100 text-orange-800 border-orange-200'
    }
    if (status.includes('SETUJU') || status.includes('AGREED') || status.includes('TERKIRIM') || status.includes('SENT')) {
      return 'bg-green-100 text-green-800 border-green-200'
    }
    if (status.includes('TIDAK ADA') || status.includes('NONE')) {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status, type)}`}>
      {status}
    </span>
  )
}

// Action Icons Component
const ActionIcons: React.FC<{ certificate: Certificate }> = ({ certificate }) => {
  return (
    <div className="flex items-center space-x-2">
      <button className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button className="text-green-600 hover:text-green-800 p-1" title="View">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      <button className="text-purple-600 hover:text-purple-800 p-1" title="Info">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <button className="text-red-600 hover:text-red-800 p-1" title="Delete">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

// Certificate Table Component
const CertificateTableDesign: React.FC<{
  certificates: Certificate[]
  stations: Station[]
  instruments: Instrument[]
}> = ({ certificates, stations, instruments }) => {
  const [filters, setFilters] = useState({
    tanggal_naskah: '',
    nomor_naskah: '',
    hal: '',
    asal_naskah: '',
    status_verifikator: '',
    status_penandatangan: '',
    status_kirim: '',
    status_berkas: ''
  })

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const getStationName = (stationId: number | null) => {
    if (!stationId) return '-'
    const station = stations.find(s => s.id === stationId)
    return station ? `${station.name} (${station.station_id})` : '-'
  }

  const getInstrumentName = (instrumentId: number | null) => {
    if (!instrumentId) return '-'
    const instrument = instruments.find(i => i.id === instrumentId)
    return instrument?.name || '-'
  }

  const getStatusVerifikator = (cert: Certificate) => {
    if (cert.verifikator_1 && cert.verifikator_2) {
      return '2 SETUJU'
    } else if (cert.verifikator_1 || cert.verifikator_2) {
      return '1 SETUJU'
    }
    return '1 BELUM'
  }

  const getStatusPenandatangan = (cert: Certificate) => {
    if (cert.authorized_by) {
      return '1 SETUJU'
    }
    return '1 BELUM'
  }

  const getStatusKirim = (cert: Certificate) => {
    // Logic untuk menentukan status kirim berdasarkan data certificate
    return cert.authorized_by ? 'TERKIRIM' : 'BELUM'
  }

  const getStatusBerkas = (cert: Certificate) => {
    // Logic untuk menentukan status berkas
    return cert.results ? 'ADA' : 'TIDAK ADA'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
      {/* Header dengan gaya dari gambar */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Daftar Log Sertifikat Kalibrasi</h1>
            <p className="text-blue-100">Pembuatan Sertifikat Kalibrasi / Log Sertifikat Kalibrasi</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100 mb-1">Menampilkan:</div>
            <select className="bg-white text-gray-900 px-3 py-1 rounded border">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel dengan filter */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">NO</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">TANGGAL NASKAH</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">NOMOR NASKAH</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">HAL</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">ASAL NASKAH</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">STATUS VERIFIKATOR</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">STATUS PENANDATANGAN</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">STATUS KIRIM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">STATUS BERKAS</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">AKSI</th>
            </tr>
          </thead>
          
          {/* Filter Row */}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">
                <input 
                  type="text" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="No"
                  disabled
                />
              </th>
              <th className="px-4 py-2">
                <input 
                  type="date" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  value={filters.tanggal_naskah}
                  onChange={(e) => handleFilterChange('tanggal_naskah', e.target.value)}
                />
              </th>
              <th className="px-4 py-2">
                <input 
                  type="text" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="Nomor Naskah"
                  value={filters.nomor_naskah}
                  onChange={(e) => handleFilterChange('nomor_naskah', e.target.value)}
                />
              </th>
              <th className="px-4 py-2">
                <input 
                  type="text" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="Hal"
                  value={filters.hal}
                  onChange={(e) => handleFilterChange('hal', e.target.value)}
                />
              </th>
              <th className="px-4 py-2">
                <input 
                  type="text" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="Asal Naskah"
                  value={filters.asal_naskah}
                  onChange={(e) => handleFilterChange('asal_naskah', e.target.value)}
                />
              </th>
              <th className="px-4 py-2">
                <select 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  value={filters.status_verifikator}
                  onChange={(e) => handleFilterChange('status_verifikator', e.target.value)}
                >
                  <option value="">Semua</option>
                  <option value="belum">Belum</option>
                  <option value="setuju">Setuju</option>
                </select>
              </th>
              <th className="px-4 py-2">
                <select 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  value={filters.status_penandatangan}
                  onChange={(e) => handleFilterChange('status_penandatangan', e.target.value)}
                >
                  <option value="">Semua</option>
                  <option value="belum">Belum</option>
                  <option value="setuju">Setuju</option>
                </select>
              </th>
              <th className="px-4 py-2">
                <select 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  value={filters.status_kirim}
                  onChange={(e) => handleFilterChange('status_kirim', e.target.value)}
                >
                  <option value="">Semua</option>
                  <option value="belum">Belum</option>
                  <option value="terkirim">Terkirim</option>
                </select>
              </th>
              <th className="px-4 py-2">
                <select 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  value={filters.status_berkas}
                  onChange={(e) => handleFilterChange('status_berkas', e.target.value)}
                >
                  <option value="">Semua</option>
                  <option value="ada">Ada</option>
                  <option value="tidak_ada">Tidak Ada</option>
                </select>
              </th>
              <th className="px-4 py-2">
                <input 
                  type="text" 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="Aksi"
                  disabled
                />
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {certificates.map((cert, index) => (
              <tr key={cert.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(cert.issue_date).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {cert.no_certificate || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {getInstrumentName(cert.instrument)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {getStationName(cert.station)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusButton status={getStatusVerifikator(cert)} type="verifikator" />
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusButton status={getStatusPenandatangan(cert)} type="penandatangan" />
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusButton status={getStatusKirim(cert)} type="kirim" />
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusButton status={getStatusBerkas(cert)} type="berkas" />
                </td>
                <td className="px-4 py-3 text-sm">
                  <ActionIcons certificate={cert} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan 1 sampai {certificates.length} dari {certificates.length} entri
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
              Sebelumnya
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
              1
            </button>
            <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificateTableDesign














