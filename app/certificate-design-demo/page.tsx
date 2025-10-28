'use client'

import React, { useState, useEffect } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import CertificateHeaderDesign from '../ui/dashboard/certificate-header-design'
import CertificateTableDesign from '../ui/dashboard/certificate-table-design'
import { Certificate, Station, Instrument } from '../../lib/supabase'

const CertificateDesignDemo: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load certificates
        const certRes = await fetch('/api/certificates?page=1&pageSize=50')
        const certData = await certRes.json()
        const certificatesData = Array.isArray(certData) ? certData : (certData?.data ?? [])
        setCertificates(certificatesData)

        // Load stations
        const stationRes = await fetch('/api/stations?page=1&pageSize=100')
        const stationData = await stationRes.json()
        const stationsData = Array.isArray(stationData) ? stationData : (stationData?.data ?? [])
        setStations(stationsData)

        // Load instruments
        const instrumentRes = await fetch('/api/instruments?page=1&pageSize=100')
        const instrumentData = await instrumentRes.json()
        const instrumentsData = Array.isArray(instrumentData) ? instrumentData : (instrumentData?.data ?? [])
        setInstruments(instrumentsData)

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading certificate design...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-50">
          <SideNav />
        </div>

        {/* Main Content */}
        <div className="ml-64">
          {/* Header dengan gaya dari gambar */}
          <CertificateHeaderDesign 
            title="Daftar Log Sertifikat Kalibrasi"
            subtitle="Pembuatan Sertifikat Kalibrasi / Log Sertifikat Kalibrasi"
            breadcrumb={["Dashboard", "Sertifikat Kalibrasi", "Log Sertifikat"]}
          />

          {/* Content Area */}
          <div className="p-6">
            {/* Search dan Filter Bar */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari sertifikat..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>
            </div>

            {/* Tabel dengan desain dari gambar */}
            <CertificateTableDesign 
              certificates={certificates}
              stations={stations}
              instruments={instruments}
            />

            {/* Additional Info */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-blue-900 mb-1">Informasi Desain</h3>
                  <p className="text-sm text-blue-700">
                    Tabel dan header ini didesain berdasarkan referensi gambar yang diberikan, 
                    dengan mengadopsi gaya visual, struktur kolom, dan elemen UI yang serupa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default CertificateDesignDemo

