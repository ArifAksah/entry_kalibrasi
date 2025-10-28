'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import { useAuth } from '../../contexts/AuthContext'
import { useCertificates } from '../../hooks/useCertificates'
import { Certificate, Station, Instrument, Personel } from '../../lib/supabase'
import { useAlert } from '../../hooks/useAlert'
import { supabase } from '../../lib/supabase'

// Modal Kirim Naskah Component
const KirimNaskahModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  certificate: Certificate | null
  verifikator1: Personel | null
  verifikator2: Personel | null
  assignor: Personel | null
  confirmDisabled?: boolean
}> = ({ isOpen, onClose, onConfirm, certificate, verifikator1, verifikator2, assignor, confirmDisabled = false }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
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
  const station = stations.find(s => s.id === certificate.station)
  const instrument = instruments.find(i => i.id === certificate.instrument)
  const authorized = personel.find(p => p.id === certificate.authorized_by)
  const verifikator1 = personel.find(p => p.id === certificate.verifikator_1)
  const verifikator2 = personel.find(p => p.id === certificate.verifikator_2)
  const assignor = personel.find(p => p.id === certificate.assignor)

  // Parse results data
  const results = certificate.results ? (typeof certificate.results === 'string' ? JSON.parse(certificate.results) : certificate.results) : []

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Certificate Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <img src="/bmkg.png" alt="BMKG" className="h-16 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">SERTIFIKAT KALIBRASI</h1>
        <p className="text-gray-600">BADAN METEOROLOGI, KLIMATOLOGI, DAN GEOFISIKA</p>
        <p className="text-gray-600">DIREKTORAT DATA DAN KOMPUTASI</p>
      </div>

      {/* Certificate Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left Column */}
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Nomor Sertifikat:</span>
            <span className="text-gray-900 font-semibold">{certificate.no_certificate || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Nomor Order:</span>
            <span className="text-gray-900">{certificate.no_order || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Nomor Identifikasi:</span>
            <span className="text-gray-900">{certificate.no_identification || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Tanggal Terbit:</span>
            <span className="text-gray-900">
              {certificate.issue_date ? new Date(certificate.issue_date).toLocaleDateString('id-ID') : '-'}
            </span>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Stasiun:</span>
            <span className="text-gray-900">{station?.name || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Instrumen:</span>
            <span className="text-gray-900">{instrument?.name || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-medium text-gray-700">Authorized By:</span>
            <span className="text-gray-900">{authorized?.name || '-'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium text-gray-700">Version:</span>
            <span className="text-gray-900">{certificate.version || 1}</span>
          </div>
        </div>
      </div>

      {/* Station Address */}
      {certificate.station_address && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Alamat Stasiun</h3>
          <p className="text-gray-700">{certificate.station_address}</p>
        </div>
      )}

      {/* Calibration Results */}
      {results && results.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hasil Kalibrasi</h3>
          <div className="space-y-6">
            {results.map((result: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Hasil Kalibrasi {index + 1}</h4>
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="font-medium text-gray-700">Tanggal Mulai:</span>
                    <p className="text-gray-900">
                      {typeof result.startDate === 'object' 
                        ? JSON.stringify(result.startDate)
                        : (result.startDate || '-')
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tanggal Selesai:</span>
                    <p className="text-gray-900">
                      {typeof result.endDate === 'object' 
                        ? JSON.stringify(result.endDate)
                        : (result.endDate || '-')
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tempat:</span>
                    <p className="text-gray-900">
                      {typeof result.place === 'object' 
                        ? JSON.stringify(result.place)
                        : (result.place || '-')
                      }
                    </p>
                  </div>
                </div>

                {/* Environment Conditions */}
                {result.environment && result.environment.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Kondisi Lingkungan</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {result.environment.map((env: any, envIndex: number) => (
                        <div key={envIndex} className="flex justify-between py-1">
                          <span className="text-sm text-gray-600">{env?.key || 'Unknown'}:</span>
                          <span className="text-sm text-gray-900">{env?.value || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calibration Table */}
                {result.table && (
                  <div className="mb-4">
                    {/* Handle multiple table objects */}
                    {Array.isArray(result.table) ? (
                      result.table.map((tableObj: any, index: number) => (
                        <TableRenderer key={index} data={tableObj} />
                      ))
                    ) : (
                      <TableRenderer data={result.table} title="Tabel Kalibrasi" />
                    )}
                  </div>
                )}

                {/* Images */}
                {result.images && result.images.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Gambar</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {result.images.map((image: string, imageIndex: number) => (
                        <div key={imageIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                          <img 
                            src={image} 
                            alt={`Calibration image ${imageIndex + 1}`}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Catatan</h5>
                  
                  {result.notesForm && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="space-y-2 text-sm">
                        <div>
                        <span className="font-medium text-gray-700">Traceable to SI through:</span>
                        <p className="text-gray-900">
                          {typeof result.notesForm.traceable_to_si_through === 'object' 
                            ? JSON.stringify(result.notesForm.traceable_to_si_through)
                            : (result.notesForm.traceable_to_si_through || '-')
                          }
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Reference Document:</span>
                        <p className="text-gray-900">
                          {typeof result.notesForm.reference_document === 'object' 
                            ? JSON.stringify(result.notesForm.reference_document)
                            : (result.notesForm.reference_document || '-')
                          }
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Calibration Method:</span>
                        <p className="text-gray-900">
                          {typeof result.notesForm.calibration_methode === 'object' 
                            ? JSON.stringify(result.notesForm.calibration_methode)
                            : (result.notesForm.calibration_methode || '-')
                          }
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Others:</span>
                        <p className="text-gray-900">
                          {typeof result.notesForm.others === 'object' 
                            ? JSON.stringify(result.notesForm.others)
                            : (result.notesForm.others || '-')
                          }
                        </p>
                      </div>
                      {result.notesForm.standardInstruments && result.notesForm.standardInstruments.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Standard Instruments:</span>
                          <p className="text-gray-900">
                            {Array.isArray(result.notesForm.standardInstruments) 
                              ? result.notesForm.standardInstruments.join(', ')
                              : String(result.notesForm.standardInstruments)
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
    </div>
  )
}

// Draft View Component
const DraftView: React.FC<{
  certificate: Certificate
  stations: Station[]
  instruments: Instrument[]
  personel: Personel[]
  onSendToVerifiers: (certificateId: number) => Promise<void>
  onBack?: () => void
  onUpdateCertificate?: (certificateId: number, updates: Partial<Certificate>) => Promise<void>
}> = ({ certificate, stations, instruments, personel, onSendToVerifiers, onBack, onUpdateCertificate }) => {
  const [showModal, setShowModal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedVerifikator1, setSelectedVerifikator1] = useState(certificate.verifikator_1 || '')
  const [selectedVerifikator2, setSelectedVerifikator2] = useState(certificate.verifikator_2 || '')

  const station = stations.find(s => s.id === certificate.station)
  const instrument = instruments.find(i => i.id === certificate.instrument)
  const verifikator1 = personel.find(p => p.id === certificate.verifikator_1)
  const verifikator2 = personel.find(p => p.id === certificate.verifikator_2)
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
        verifikator_2: selectedVerifikator2 || null
      })
      setIsEditing(false)
      
      // Update local state to reflect changes
      certificate.verifikator_1 = selectedVerifikator1 || null
      certificate.verifikator_2 = selectedVerifikator2 || null
    } catch (error) {
      console.error('Error updating certificate:', error)
      // Don't close editing mode if there's an error
    }
  }

  const isReadyToSend = certificate.verifikator_1 && certificate.verifikator_2

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Header dengan tombol Kirim Konsep */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Detail Log Sertifikat Kalibrasi</h2>
          <p className="text-sm text-gray-600">Status: Draft</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {showPreview ? 'HIDE PREVIEW' : 'PREVIEW'}
          </button>
          {!isReadyToSend && (
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
            className={`flex items-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
              isReadyToSend && !(isSending || hasSent)
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

      {/* Status Message */}
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-gray-700 font-medium">Naskah ini belum dikirim</p>
            <p className="text-sm text-gray-600">
              Pastikan Naskah sudah lengkap dan sesuai. Naskah akan dikirimkan kepada Verifikator.
            </p>
          </div>
        </div>
      </div>

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
        const [stationsRes, instrumentsRes, personelRes] = await Promise.all([
          fetch('/api/stations?page=1&pageSize=100'),
          fetch('/api/instruments?page=1&pageSize=100'),
          fetch('/api/personel')
        ])

        const stationsData = await stationsRes.json()
        const instrumentsData = await instrumentsRes.json()
        const personelData = await personelRes.json()

        setStations(Array.isArray(stationsData) ? stationsData : (stationsData?.data ?? []))
        setInstruments(Array.isArray(instrumentsData) ? instrumentsData : (instrumentsData?.data ?? []))
        setPersonel(Array.isArray(personelData) ? personelData : [])
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

      showAlert('success', 'Sertifikat berhasil dikirim ke verifikator!')
      
      // Redirect back to certificates page after successful send
      router.push('/certificates')
    } catch (error) {
      console.error('Error sending to verifiers:', error)
      showAlert('error', error instanceof Error ? error.message : 'Gagal mengirim ke verifikator')
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

      showAlert('success', 'Sertifikat berhasil diperbarui!')
      return responseData
    } catch (error) {
      console.error('Error updating certificate:', error)
      showAlert('error', error instanceof Error ? error.message : 'Gagal memperbarui sertifikat')
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
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
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