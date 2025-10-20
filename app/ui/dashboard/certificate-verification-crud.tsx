'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificateVerification, PendingCertificate } from '../../../hooks/useCertificateVerification'
import { useCertificates } from '../../../hooks/useCertificates'
import { useStations } from '../../../hooks/useStations'
import { useInstruments } from '../../../hooks/useInstruments'
import { useSensors } from '../../../hooks/useSensors'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Alert from '../../../components/ui/Alert'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import { Certificate, CertificateInsert, Station, Instrument, Sensor } from '../../../lib/supabase'

const CertificateVerificationCRUD: React.FC = () => {
  const { pendingCertificates, loading, error, createVerification, updateVerification } = useCertificateVerification()
  const { updateCertificate } = useCertificates()
  const { stations } = useStations()
  const { instruments } = useInstruments()
  const { sensors } = useSensors()
  const { user } = useAuth()
  const { can, canEndpoint } = usePermissions()
  const { alert, showSuccess, showError, showWarning, hideAlert } = useAlert()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditCertificateModalOpen, setIsEditCertificateModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<PendingCertificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verificationForm, setVerificationForm] = useState({
    status: 'approved' as 'approved' | 'rejected',
    notes: '',
    rejection_reason: '',
    approval_notes: ''
  })

  // State for certificate editing
  const [certificateForm, setCertificateForm] = useState<CertificateInsert>({
    no_certificate: '',
    no_order: '',
    no_identification: '',
    authorized_by: null,
    verifikator_1: null as any,
    verifikator_2: null as any,
    issue_date: '',
    station: null,
    instrument: null,
    station_address: null as any,
  })
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null)
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    console.log('CertificateVerificationCRUD mounted, pendingCertificates:', pendingCertificates)
    if (pendingCertificates && pendingCertificates.length > 0) {
      console.log('First certificate verification status:', pendingCertificates[0].verification_status)
      console.log('User verification status:', pendingCertificates[0].verification_status.user_verification_status)
    }
  }, [pendingCertificates])

  // Fetch personel data
  useEffect(() => {
    const fetchPersonel = async () => {
      try {
        const response = await fetch('/api/personel')
        if (response.ok) {
          const data = await response.json()
          setPersonel(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error('Failed to fetch personel:', e)
      }
    }
    fetchPersonel()
  }, [])

  const openModal = (certificate: PendingCertificate) => {
    setSelectedCertificate(certificate)
    setVerificationForm({
      status: 'approved',
      notes: '',
      rejection_reason: '',
      approval_notes: ''
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedCertificate(null)
  }

  const openEditModal = (certificate: PendingCertificate) => {
    setSelectedCertificate(certificate)
    // Pre-fill form with existing verification data
    const existingStatus = certificate.verification_status.user_verification_status
    setVerificationForm({
      status: existingStatus === 'approved' ? 'approved' : 'rejected',
      notes: certificate.verification_status.user_verification_notes || '',
      rejection_reason: certificate.verification_status.user_verification_rejection_reason || '',
      approval_notes: certificate.verification_status.user_verification_approval_notes || ''
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedCertificate(null)
  }

  const openEditCertificateModal = (certificate: PendingCertificate) => {
    // Convert PendingCertificate to Certificate format for editing
    const certData: Certificate = {
      id: certificate.id,
      no_certificate: certificate.no_certificate,
      no_order: certificate.no_order,
      no_identification: certificate.no_identification,
      authorized_by: certificate.authorized_by,
      verifikator_1: certificate.verifikator_1,
      verifikator_2: certificate.verifikator_2,
      issue_date: certificate.issue_date,
      station: certificate.station?.id || null,
      instrument: certificate.instrument?.id || null,
      created_at: certificate.created_at,
      updated_at: certificate.updated_at,
      station_address: (certificate as any).station_address || null,
    }
    
    setEditingCertificate(certData)
    setCertificateForm({
      no_certificate: certificate.no_certificate,
      no_order: certificate.no_order,
      no_identification: certificate.no_identification,
      authorized_by: certificate.authorized_by,
      verifikator_1: certificate.verifikator_1,
      verifikator_2: certificate.verifikator_2,
      issue_date: certificate.issue_date,
      station: certificate.station?.id || null,
      instrument: certificate.instrument?.id || null,
      station_address: (certificate as any).station_address || null,
    })
    setIsEditCertificateModalOpen(true)
  }

  const closeEditCertificateModal = () => {
    setIsEditCertificateModalOpen(false)
    setEditingCertificate(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCertificate) return
    
    setIsSubmitting(true)
    try {
      const verificationLevel = selectedCertificate.verification_status.user_verification_level
      if (!verificationLevel) {
        alert('Level verifikasi tidak valid.')
        return
      }

      // Validate rejection reason if rejecting
      if (verificationForm.status === 'rejected' && !verificationForm.rejection_reason.trim()) {
        alert('Alasan penolakan harus diisi.')
        return
      }

      // Check if verification already exists
      const existingVerification = selectedCertificate.verification_status.user_verification_status
      if (existingVerification && existingVerification !== 'pending') {
        if (existingVerification === 'rejected') {
          alert('Sertifikat ini sudah ditolak sebelumnya. Silakan gunakan tombol perbaikan untuk mengirim ulang.')
        } else {
          alert('Sertifikat ini sudah diverifikasi sebelumnya.')
        }
        return
      }

      const existingId = selectedCertificate.verification_status.user_verification_id
      let result
      
      if (existingId) {
        result = await updateVerification(existingId, verificationForm)
      } else {
        result = await createVerification({
          certificate_id: selectedCertificate.id,
          verification_level: verificationLevel,
          status: verificationForm.status,
          notes: verificationForm.notes || undefined,
          rejection_reason: verificationForm.status === 'rejected' ? verificationForm.rejection_reason : undefined,
          approval_notes: verificationForm.status === 'approved' ? verificationForm.approval_notes : undefined
        })
      }
      
      if (result.success) {
        closeModal()
        
        // Show success message
        if (verificationForm.status === 'approved') {
          showSuccess('Sertifikat berhasil disetujui!')
        } else {
          showWarning('Sertifikat telah ditolak. Sertifikat dapat diperbaiki dan dikirim ulang.')
        }
        
        // Refresh data (soft): refetch pending list
        // As a simple approach, reload the page to ensure all views reflect changes
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        // Handle error from result
        const errorMessage = result.error || 'Terjadi kesalahan'
        
        // Show user-friendly error message
        if (errorMessage.includes('rejected')) {
          showError('Sertifikat telah ditolak. Silakan perbaiki sertifikat dan kirim ulang untuk verifikasi.')
        } else if (errorMessage.includes('already')) {
          showWarning('Sertifikat ini sudah diverifikasi sebelumnya.')
        } else {
          showError(`Terjadi kesalahan: ${errorMessage}`)
        }
      }
    } catch (e) {
      console.error('Verification error:', e)
      const errorMessage = e instanceof Error ? e.message : 'Failed to submit verification'
      showError(`Terjadi kesalahan: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCertificate) return
    
    setIsSubmitting(true)
    try {
      const verificationLevel = selectedCertificate.verification_status.user_verification_level
      if (!verificationLevel) {
        alert('Level verifikasi tidak valid.')
        return
      }

      // Validate rejection reason if rejecting
      if (verificationForm.status === 'rejected' && !verificationForm.rejection_reason.trim()) {
        alert('Alasan penolakan harus diisi.')
        return
      }

      const existingId = selectedCertificate.verification_status.user_verification_id
      if (!existingId) {
        alert('Verifikasi tidak ditemukan untuk diedit.')
        return
      }

      const result = await updateVerification(existingId, verificationForm)
      
      if (result.success) {
        closeEditModal()
        
        // Show success message
        if (verificationForm.status === 'approved') {
          showSuccess('Verifikasi berhasil diperbarui!')
        } else {
          showWarning('Verifikasi telah diperbarui.')
        }
        
        // Refresh data
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        const errorMessage = result.error || 'Terjadi kesalahan'
        showError(`Terjadi kesalahan: ${errorMessage}`)
      }
    } catch (e) {
      console.error('Edit verification error:', e)
      const errorMessage = e instanceof Error ? e.message : 'Failed to update verification'
      showError(`Terjadi kesalahan: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCertificateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCertificate) return
    
    setIsSubmitting(true)
    try {
      // Update certificate data only - no status change
      await updateCertificate(editingCertificate.id, certificateForm as any)
      
      closeEditCertificateModal()
      showSuccess('Data certificate berhasil diperbarui! Status verifikasi tetap tidak berubah.')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (e) {
      console.error('Error updating certificate:', e)
      showError('Gagal memperbarui certificate: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full"
    switch (status) {
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getVerificationLevel = (cert: PendingCertificate) => {
    if (cert.verifikator_1 === user?.id) return 'Verifikator 1'
    if (cert.verifikator_2 === user?.id) return 'Verifikator 2'
    if (cert.authorized_by === user?.id) return 'Authorized By'
    return 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alert Component */}
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Verification', href: '#' }, { label: 'Certificate Verification' }]} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Certificates Assigned to You</h2>
          <p className="text-sm text-gray-600 mb-3">
            You are assigned as a verifikator for the following certificates. Click "Verify" to review and approve/reject.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">📝 Edit Certificate Data:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <span className="font-medium">Tujuan:</span> Revisi minor data certificate (typo, data salah, dll)</li>
              <li>• <span className="font-medium">Akses:</span> Verifikator dapat edit data certificate yang ditugaskan</li>
              <li>• <span className="font-medium">Status:</span> Edit data tidak mengubah status verifikasi</li>
              <li>• <span className="font-medium">Workflow:</span> Revisi minor dapat langsung di-approve tanpa balik ke pembuat</li>
              <li>• <span className="font-medium">Lock:</span> Edit terkunci setelah certificate di-approve untuk mencegah gangguan</li>
            </ul>
          </div>
        </div>
        
        <Table headers={[
          'Certificate No', 
          'Order No', 
          'Identification', 
          'Issue Date', 
          'Station', 
          'Instrument', 
          'Your Role',
          'Your Status',
          'Overall Status',
          'Actions'
        ]}>
          {pendingCertificates.map((cert) => (
            <tr key={cert.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {cert.no_certificate}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {cert.no_order}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {cert.no_identification}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(cert.issue_date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {cert.station?.name || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {cert.instrument?.name || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {getVerificationLevel(cert)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex flex-col">
                  <span className={getStatusBadge(cert.verification_status.user_verification_status || 'pending')}>
                    {cert.verification_status.user_verification_status || 'pending'}
                  </span>
                  {cert.verification_status.user_verification_status === 'rejected' && (
                    <span className="text-xs text-red-500 mt-1">
                      Sertifikat ditolak
                    </span>
                  )}
                  {cert.verification_status.user_verification_status === 'pending' && (
                    <span className="text-xs text-yellow-600 mt-1">
                      Menunggu verifikasi
                    </span>
                  )}
                  {cert.verification_status.user_verification_status === 'approved' && (
                    <span className="text-xs text-green-600 mt-1">
                      Sertifikat disetujui - edit tidak tersedia
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">V1:</span>
                    <span className={getStatusBadge(cert.verification_status.verifikator_1)}>
                      {cert.verification_status.verifikator_1}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">V2:</span>
                    <span className={getStatusBadge(cert.verification_status.verifikator_2)}>
                      {cert.verification_status.verifikator_2}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Auth:</span>
                    <span className={getStatusBadge(cert.verification_status.authorized_by)}>
                      {cert.verification_status.authorized_by}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex space-x-2">
                  <a 
                    href={`/certificates/${cert.id}/print`} 
                    target="_blank" 
                    className="text-green-600 hover:text-green-800"
                  >
                    View
                  </a>
                  {/* Tombol Edit Certificate untuk revisi minor data certificate - hanya jika belum approved */}
                  {cert.verification_status.user_can_act && cert.verification_status.user_verification_status !== 'approved' && (
                    <button 
                      onClick={() => {
                        console.log('Edit certificate button clicked for cert:', cert.id)
                        openEditCertificateModal(cert)
                      }}
                      className="text-purple-600 hover:text-purple-800"
                      title="Edit Certificate Data (Minor revisions)"
                    >
                      Edit Cert
                    </button>
                  )}
                  {cert.verification_status.user_can_act ? (
                    <>
                      <button 
                        onClick={() => {
                          openModal(cert)
                        }} 
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {cert.verification_status.user_verification_id ? 'Update' : 'Verify'}
                      </button>
                      <button 
                        onClick={() => {
                          console.log('Edit button clicked for cert:', cert.id, 'status:', cert.verification_status.user_verification_status)
                          openEditModal(cert)
                        }}
                        className="text-orange-600 hover:text-orange-800"
                        title="Edit verification"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs text-gray-400">Waiting previous step</span>
                      {cert.verification_status.user_verification_status !== 'approved' && (
                        <span className="text-xs text-purple-600">
                          Edit data available after your turn
                        </span>
                      )}
                      {cert.verification_status.user_verification_status === 'approved' && (
                        <span className="text-xs text-green-600">
                          Approved - edit locked
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Verify Certificate - {selectedCertificate.no_certificate}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="verification-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Certificate Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Certificate No:</span>
                      <p className="text-gray-900">{selectedCertificate.no_certificate}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Order No:</span>
                      <p className="text-gray-900">{selectedCertificate.no_order}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Identification:</span>
                      <p className="text-gray-900">{selectedCertificate.no_identification}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Issue Date:</span>
                      <p className="text-gray-900">{new Date(selectedCertificate.issue_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Station:</span>
                      <p className="text-gray-900">{selectedCertificate.station?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Instrument:</span>
                      <p className="text-gray-900">{selectedCertificate.instrument?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Your Role:</span>
                      <p className="text-gray-900">{getVerificationLevel(selectedCertificate)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Current Status:</span>
                      <p className="text-gray-900">{selectedCertificate.verification_status.user_verification_status || 'pending'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Verification Progress:</span>
                      <div className="text-sm text-gray-600 mt-1">
                        <div>V1: {selectedCertificate.verification_status.verifikator_1 || 'pending'}</div>
                        <div>V2: {selectedCertificate.verification_status.verifikator_2 || 'pending'}</div>
                        <div>Auth: {selectedCertificate.verification_status.authorized_by || 'pending'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Verification Decision
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="approved"
                          checked={verificationForm.status === 'approved'}
                          onChange={(e) => setVerificationForm({ ...verificationForm, status: e.target.value as 'approved' | 'rejected' })}
                          className="mr-2"
                        />
                        <span className="text-green-700 font-medium">Approve</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="rejected"
                          checked={verificationForm.status === 'rejected'}
                          onChange={(e) => setVerificationForm({ ...verificationForm, status: e.target.value as 'approved' | 'rejected' })}
                          className="mr-2"
                        />
                        <span className="text-red-700 font-medium">Reject</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      General Notes (Optional)
                    </label>
                    <textarea
                      value={verificationForm.notes}
                      onChange={(e) => setVerificationForm({ ...verificationForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Add any general notes about your verification decision..."
                    />
                  </div>

                  {verificationForm.status === 'rejected' && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={verificationForm.rejection_reason}
                        onChange={(e) => setVerificationForm({ ...verificationForm, rejection_reason: e.target.value })}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={3}
                        placeholder="Please provide a detailed reason for rejection..."
                        required
                      />
                    </div>
                  )}

                  {verificationForm.status === 'approved' && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={verificationForm.approval_notes}
                        onChange={(e) => setVerificationForm({ ...verificationForm, approval_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        placeholder="Add any notes about the approval..."
                      />
                    </div>
                  )}
                </div>

              </form>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                form="verification-form"
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  verificationForm.status === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isSubmitting ? 'Mengirim...' : `${verificationForm.status === 'approved' ? 'Setujui' : 'Tolak'} Sertifikat`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Verification - {selectedCertificate.no_certificate}
              </h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-verification-form" onSubmit={handleEditSubmit} className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Certificate Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Certificate No:</span>
                      <p className="text-gray-900">{selectedCertificate.no_certificate}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Order No:</span>
                      <p className="text-gray-900">{selectedCertificate.no_order}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Identification:</span>
                      <p className="text-gray-900">{selectedCertificate.no_identification}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Issue Date:</span>
                      <p className="text-gray-900">{new Date(selectedCertificate.issue_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Station:</span>
                      <p className="text-gray-900">{selectedCertificate.station?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Instrument:</span>
                      <p className="text-gray-900">{selectedCertificate.instrument?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Your Role:</span>
                      <p className="text-gray-900">{getVerificationLevel(selectedCertificate)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Current Status:</span>
                      <p className="text-gray-900">{selectedCertificate.verification_status.user_verification_status || 'pending'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Verification Decision
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="edit-status"
                          value="approved"
                          checked={verificationForm.status === 'approved'}
                          onChange={(e) => setVerificationForm({ ...verificationForm, status: e.target.value as 'approved' | 'rejected' })}
                          className="mr-2"
                        />
                        <span className="text-green-700 font-medium">Approve</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="edit-status"
                          value="rejected"
                          checked={verificationForm.status === 'rejected'}
                          onChange={(e) => setVerificationForm({ ...verificationForm, status: e.target.value as 'approved' | 'rejected' })}
                          className="mr-2"
                        />
                        <span className="text-red-700 font-medium">Reject</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      General Notes (Optional)
                    </label>
                    <textarea
                      value={verificationForm.notes}
                      onChange={(e) => setVerificationForm({ ...verificationForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Add any general notes about your verification decision..."
                    />
                  </div>

                  {verificationForm.status === 'rejected' && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={verificationForm.rejection_reason}
                        onChange={(e) => setVerificationForm({ ...verificationForm, rejection_reason: e.target.value })}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={3}
                        placeholder="Please provide a detailed reason for rejection..."
                        required
                      />
                    </div>
                  )}

                  {verificationForm.status === 'approved' && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={verificationForm.approval_notes}
                        onChange={(e) => setVerificationForm({ ...verificationForm, approval_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        placeholder="Add any notes about the approval..."
                      />
                    </div>
                  )}
                </div>

              </form>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-verification-form"
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  verificationForm.status === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isSubmitting ? 'Mengirim...' : `Update ${verificationForm.status === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Certificate Modal */}
      {isEditCertificateModalOpen && editingCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Certificate Data - {editingCertificate.no_certificate}
                </h3>
                <p className="text-sm text-blue-600 mt-1">
                  📝 Edit data certificate untuk revisi minor (typo, data salah, dll). Status verifikasi tidak akan berubah.
                </p>
              </div>
              <button
                onClick={closeEditCertificateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-certificate-form" onSubmit={handleEditCertificateSubmit} className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Certificate Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Certificate No *</label>
                      <input
                        type="text"
                        value={certificateForm.no_certificate}
                        onChange={(e) => setCertificateForm({ ...certificateForm, no_certificate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order No *</label>
                      <input
                        type="text"
                        value={certificateForm.no_order}
                        onChange={(e) => setCertificateForm({ ...certificateForm, no_order: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Identification *</label>
                      <input
                        type="text"
                        value={certificateForm.no_identification}
                        onChange={(e) => setCertificateForm({ ...certificateForm, no_identification: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
                      <input
                        type="date"
                        value={certificateForm.issue_date}
                        onChange={(e) => setCertificateForm({ ...certificateForm, issue_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                      <select
                        value={certificateForm.station || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, station: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Station</option>
                        {stations.map(station => (
                          <option key={station.id} value={station.id}>{station.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instrument</label>
                      <select
                        value={certificateForm.instrument || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, instrument: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Instrument</option>
                        {instruments.map(instrument => (
                          <option key={instrument.id} value={instrument.id}>{(instrument as any).name || 'Instrument'}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By</label>
                      <select
                        value={certificateForm.authorized_by || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, authorized_by: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Verifikator 1 *</label>
                      <select
                        value={(certificateForm as any).verifikator_1 || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, verifikator_1: e.target.value || null } as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Verifikator 2 *</label>
                      <select
                        value={(certificateForm as any).verifikator_2 || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, verifikator_2: e.target.value || null } as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Station Address</label>
                      <textarea
                        value={(certificateForm as any).station_address || ''}
                        onChange={(e) => setCertificateForm({ ...certificateForm, station_address: e.target.value || null } as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Station address..."
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={closeEditCertificateModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-certificate-form"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Certificate Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateVerificationCRUD
