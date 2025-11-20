'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
import { useCertificateRejection } from '../../../hooks/useCertificateRejection'
import RejectionModal from './rejection-modal'
import { Certificate, CertificateInsert, Station, Instrument, Sensor } from '../../../lib/supabase'
import { EditIcon, DeleteIcon, ViewIcon, CloseIcon, CheckIcon, XIcon, EditButton, ViewButton, VerifyButton, RejectButton } from '../../../components/ui/ActionIcons'

const CertificateVerificationCRUD: React.FC = () => {
  const { pendingCertificates, loading, error, createVerification, updateVerification } = useCertificateVerification()
  const { updateCertificate } = useCertificates()
  const { stations } = useStations()
  const { instruments } = useInstruments()
  const { sensors } = useSensors()
  const { user } = useAuth()
  const { can, canEndpoint } = usePermissions()
  const { alert, showError, showSuccess, showWarning, hideAlert } = useAlert()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<PendingCertificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { rejectCertificate } = useCertificateRejection()
  const [verificationForm, setVerificationForm] = useState({
    status: 'approved' as 'approved' | 'rejected',
    notes: '',
    rejection_reason: '',
    approval_notes: ''
  })

  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [isPassphraseModalOpen, setIsPassphraseModalOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [isSigning, setIsSigning] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)

  // BSrE Verification State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerifyBSrE = async (cert: PendingCertificate) => {
    setIsVerifying(true)
    setVerificationResult(null)
    setIsVerifyModalOpen(true)

    try {
      const response = await fetch(`/api/certificates/${cert.id}/verify-bsre`, {
        method: 'POST'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed')
      }

      setVerificationResult(result)
    } catch (error: any) {
      console.error('BSrE Verification Error:', error)
      setVerificationResult({ error: error.message || 'Failed to verify with BSrE' })
    } finally {
      setIsVerifying(false)
    }
  }

  // Live search and pagination states
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const certificatesPerPage = 10

  useEffect(() => {
    console.log('CertificateVerificationCRUD mounted, pendingCertificates:', pendingCertificates)
    if (pendingCertificates && pendingCertificates.length > 0) {
      console.log('First certificate verification status:', pendingCertificates[0].verification_status)
      console.log('User verification status:', pendingCertificates[0].verification_status.user_verification_status)
    }
  }, [pendingCertificates])

  // Helper function to get verification level
  const getVerificationLevel = (cert: PendingCertificate) => {
    if (cert.verifikator_1 === user?.id) return 'Verifikator 1'
    if (cert.verifikator_2 === user?.id) return 'Verifikator 2'
    if (cert.authorized_by === user?.id) return 'Penandatangan'
    return 'Unknown'
  }

  // Filter certificates based on search query
  const filteredCertificates = useMemo(() => {
    if (!pendingCertificates) return []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return pendingCertificates

    return pendingCertificates.filter((cert) => {
      const searchText = [
        cert.no_certificate || '',
        cert.no_order || '',
        cert.no_identification || '',
        cert.station?.name || '',
        cert.instrument?.name || '',
        getVerificationLevel(cert),
        cert.verification_status.user_verification_status || 'pending',
        cert.verification_status.verifikator_1 || '',
        cert.verification_status.verifikator_2 || '',
        cert.verification_status.authorized_by || '',
        new Date(cert.issue_date).toLocaleDateString()
      ].join(' ').toLowerCase()

      return searchText.includes(query)
    })
  }, [pendingCertificates, searchQuery, user])

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Calculate pagination
  const totalPages = useMemo(() => {
    return Math.ceil(filteredCertificates.length / certificatesPerPage)
  }, [filteredCertificates.length])

  // Ensure current page is valid when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages])

  // Get current page certificates
  const indexOfLastCertificate = currentPage * certificatesPerPage
  const indexOfFirstCertificate = indexOfLastCertificate - certificatesPerPage
  const currentCertificates = useMemo(() => {
    return filteredCertificates.slice(indexOfFirstCertificate, indexOfLastCertificate)
  }, [filteredCertificates, indexOfFirstCertificate, indexOfLastCertificate])

  // Change page
  const paginate = (pageNumber: number) => {
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)))
  }

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
      notes: '',
      rejection_reason: '',
      approval_notes: ''
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedCertificate(null)
  }

  const openRejectionModal = (certificate: PendingCertificate) => {
    setSelectedCertificate(certificate)
    setIsRejectionModalOpen(true)
  }

  const closeRejectionModal = () => {
    setIsRejectionModalOpen(false)
    setSelectedCertificate(null)
  }

  const handleRejection = async (rejectionData: any) => {
    if (!selectedCertificate) return

    try {
      setIsSubmitting(true)

      const result = await rejectCertificate(selectedCertificate.id, rejectionData)

      if (result.success) {
        closeRejectionModal()
        showSuccess('Sertifikat berhasil ditolak')

        // Refresh the data
        window.location.reload()
      } else {
        showError(result.error || 'Gagal menolak sertifikat')
      }
    } catch (error) {
      console.error('Rejection error:', error)
      showError('Terjadi kesalahan saat menolak sertifikat')
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCertificate) return

    setIsSubmitting(true)
    try {
      const verificationLevel = selectedCertificate.verification_status.user_verification_level
      if (!verificationLevel) {
        showError('Level verifikasi tidak valid.')
        return
      }

      // Validate rejection reason if rejecting
      if (verificationForm.status === 'rejected' && !verificationForm.rejection_reason.trim()) {
        showError('Alasan penolakan harus diisi.')
        return
      }

      if (verificationForm.status === 'approved' && verificationLevel === 3) {
        setIsSubmitting(false)
        setPassphrase('')
        setPassphraseError(null)
        setIsPassphraseModalOpen(true)
        return
      }

      // Check if verification already exists
      const existingVerification = selectedCertificate.verification_status.user_verification_status
      if (existingVerification && existingVerification !== 'pending') {
        if (existingVerification === 'rejected') {
          showError('Sertifikat ini sudah ditolak sebelumnya. Silakan gunakan tombol perbaikan untuk mengirim ulang.')
        } else {
          showError('Sertifikat ini sudah diverifikasi sebelumnya.')
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
        showError('Level verifikasi tidak valid.')
        return
      }

      // Validate rejection reason if rejecting
      if (verificationForm.status === 'rejected' && !verificationForm.rejection_reason.trim()) {
        showError('Alasan penolakan harus diisi.')
        return
      }

      const existingId = selectedCertificate.verification_status.user_verification_id
      if (!existingId) {
        showError('Verifikasi tidak ditemukan untuk diedit.')
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Verification Instructions:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <span className="font-medium">Review:</span> Periksa semua data certificate dengan teliti</li>
              <li>• <span className="font-medium">Approve:</span> Jika data sudah benar dan lengkap</li>
              <li>• <span className="font-medium">Reject:</span> Jika ada kesalahan yang perlu diperbaiki</li>
              <li>• <span className="font-medium">Notes:</span> Berikan catatan untuk setiap keputusan</li>
            </ul>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by certificate number, order, station, instrument, status..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1) // Reset to first page when searching
                }}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear search"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-600">
                Found <span className="font-medium">{filteredCertificates.length}</span> certificate{filteredCertificates.length !== 1 ? 's' : ''} matching "{searchQuery}"
                {filteredCertificates.length === 0 && (
                  <span className="text-red-500 ml-2">- No certificates found</span>
                )}
              </div>
            )}
          </div>
        </div>

        <Table headers={[
          'Certificate No',
          'Station',
          'Your Role',
          'Your Status',
          'Overall Status',
          'Actions'
        ]}>
          {currentCertificates.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                {searchQuery ? 'No certificates found matching your search' : 'No certificates assigned to you'}
              </td>
            </tr>
          ) : (
            currentCertificates.map((cert) => (
              <tr key={cert.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {cert.no_certificate}
                    </span>
                    <span className="text-xs text-gray-500">
                      {cert.no_order} • {cert.no_identification}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(cert.issue_date).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-900">
                      {cert.station?.name || '-'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {cert.instrument?.name || '-'}
                    </span>
                  </div>
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
                      <span className="text-xs text-gray-500">Verifikator 1:</span>
                      <span className={getStatusBadge(cert.verification_status.verifikator_1)}>
                        {cert.verification_status.verifikator_1}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Verifikator 2:</span>
                      <span className={getStatusBadge(cert.verification_status.verifikator_2)}>
                        {cert.verification_status.verifikator_2}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Penandatangan:</span>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200"
                    >
                      <ViewIcon className="w-4 h-4" />
                      <span>View</span>
                    </a>
                    {/* Download PDF button - only show if Level 3 approved and PDF already signed (exists in e-certificate-signed) */}
                    {cert.verification_status.authorized_by === 'approved' && (cert as any).pdf_path && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              // Download PDF from e-certificate-signed folder
                              const response = await fetch(`/api/certificates/${cert.id}/pdf?download=true`)
                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: 'Failed to download PDF' }))
                                showError(errorData.error || 'Gagal mengunduh PDF. Pastikan PDF sudah ditandatangani.')
                                return
                              }

                              // Get PDF blob from response
                              const blob = await response.blob()
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              const certificateNumber = cert.no_certificate || String(cert.id)
                              const safeFileName = certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')
                              a.download = `Certificate_${safeFileName}_Signed.pdf`
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                              showSuccess('PDF yang ditandatangani berhasil diunduh')
                            } catch (err) {
                              console.error('Error downloading signed PDF:', err)
                              showError('Gagal mengunduh PDF. Silakan coba lagi.')
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200 border border-transparent hover:border-indigo-200"
                          title="Download PDF yang sudah ditandatangani dari e-certificate-signed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Download PDF Signed</span>
                        </button>

                        <button
                          onClick={() => handleVerifyBSrE(cert)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-all duration-200 border border-transparent hover:border-teal-200"
                          title="Verifikasi Keaslian Dokumen via BSrE"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Verify BSrE</span>
                        </button>
                      </>
                    )}
                    {cert.verification_status.user_verification_status === 'pending' && (
                      <a
                        href={`/certificates?edit=${cert.id}&from=verification`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200 border border-transparent hover:border-purple-200"
                        title="Edit Certificate"
                      >
                        <EditIcon className="w-4 h-4" />
                        <span>Edit</span>
                      </a>
                    )}
                    {cert.verification_status.user_can_act ? (
                      <>
                        <button
                          onClick={() => {
                            openModal(cert)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                          title={cert.verification_status.user_verification_id ? 'Update Verification' : 'Verify Certificate'}
                        >
                          <CheckIcon className="w-4 h-4" />
                          <span>{cert.verification_status.user_verification_id ? 'Update' : 'Verify'}</span>
                        </button>
                        <button
                          onClick={() => {
                            openRejectionModal(cert)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
                          title="Tolak Sertifikat"
                        >
                          <XIcon className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => {
                            console.log('Edit button clicked for cert:', cert.id, 'status:', cert.verification_status.user_verification_status)
                            openEditModal(cert)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg transition-all duration-200 border border-transparent hover:border-orange-200"
                          title="Edit verification"
                        >
                          <EditIcon className="w-4 h-4" />
                          <span>Edit</span>
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
            ))
          )}
        </Table>

        {/* Pagination */}
        {filteredCertificates.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
            {/* Mobile Pagination */}
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${currentPage === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-white hover:text-gray-900'
                  }`}
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <button
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${currentPage === totalPages
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-white hover:text-gray-900'
                  }`}
              >
                Next
                <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstCertificate + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastCertificate, filteredCertificates.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredCertificates.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => paginate(1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 transition-colors ${currentPage === 1
                      ? 'cursor-not-allowed'
                      : 'hover:bg-white hover:text-gray-600'
                      }`}
                    title="First page"
                  >
                    <span className="sr-only">First</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 text-gray-400 transition-colors ${currentPage === 1
                      ? 'cursor-not-allowed'
                      : 'hover:bg-white hover:text-gray-600'
                      }`}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Smart page numbers with ellipsis */}
                  {(() => {
                    const pages = []
                    const maxVisiblePages = 5

                    if (totalPages <= maxVisiblePages) {
                      // Show all pages if total is small
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => paginate(i)}
                            className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ${currentPage === i
                              ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0'
                              }`}
                          >
                            {i}
                          </button>
                        )
                      }
                    } else {
                      // Show smart pagination with ellipsis
                      const startPage = Math.max(1, currentPage - 2)
                      const endPage = Math.min(totalPages, currentPage + 2)

                      // Always show first page
                      if (startPage > 1) {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => paginate(1)}
                            className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0"
                          >
                            1
                          </button>
                        )

                        if (startPage > 2) {
                          pages.push(
                            <span key="ellipsis1" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700">
                              ...
                            </span>
                          )
                        }
                      }

                      // Show pages around current page
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => paginate(i)}
                            className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ${currentPage === i
                              ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0'
                              }`}
                          >
                            {i}
                          </button>
                        )
                      }

                      // Always show last page
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis2" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700">
                              ...
                            </span>
                          )
                        }

                        pages.push(
                          <button
                            key={totalPages}
                            onClick={() => paginate(totalPages)}
                            className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0"
                          >
                            {totalPages}
                          </button>
                        )
                      }
                    }

                    return pages
                  })()}

                  <button
                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 text-gray-400 transition-colors ${currentPage === totalPages
                      ? 'cursor-not-allowed'
                      : 'hover:bg-white hover:text-gray-600'
                      }`}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => paginate(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 transition-colors ${currentPage === totalPages
                      ? 'cursor-not-allowed'
                      : 'hover:bg-white hover:text-gray-600'
                      }`}
                    title="Last page"
                  >
                    <span className="sr-only">Last</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
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
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
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
                      <p className="text-gray-900">{new Date(selectedCertificate.issue_date).toISOString().slice(0, 10)}</p>
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
                        <div>Verifikator 1: {selectedCertificate.verification_status.verifikator_1 || 'pending'}</div>
                        <div>Verifikator 2: {selectedCertificate.verification_status.verifikator_2 || 'pending'}</div>
                        <div>Penandatangan: {selectedCertificate.verification_status.authorized_by || 'pending'}</div>
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${verificationForm.status === 'approved'
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
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${verificationForm.status === 'approved'
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

      {/* Rejection Modal */}
      {selectedCertificate && (
        <RejectionModal
          isOpen={isRejectionModalOpen}
          onClose={closeRejectionModal}
          onConfirm={handleRejection}
          certificateId={selectedCertificate.id}
          verificationLevel={getVerificationLevel(selectedCertificate) === 'Verifikator 1' ? 1 : 2}
          certificateNumber={selectedCertificate.no_certificate}
        />
      )}

      {isPassphraseModalOpen && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Masukkan Passphrase TTE</h3>
              <button
                onClick={() => {
                  setIsPassphraseModalOpen(false)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Passphrase</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value)
                    setPassphraseError(null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan passphrase TTE Anda"
                />
                {passphraseError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {passphraseError}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              {passphraseError && passphraseError.includes('profil') && (
                <a
                  href="/profile-settings"
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg border border-blue-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Atur NIK di Profil
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsPassphraseModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSigning}
                onClick={async () => {
                  if (!selectedCertificate) return
                  if (!passphrase.trim()) {
                    setPassphraseError('Passphrase wajib diisi')
                    return
                  }
                  try {
                    setIsSigning(true)
                    const { data: { session } } = await (await import('../../../lib/supabase')).supabase.auth.getSession()
                    const token = session?.access_token
                    if (!token) {
                      showError('Not authenticated')
                      setIsSigning(false)
                      return
                    }
                    const res = await fetch('/api/certificate-verification/sign-level-3', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        documentId: String(selectedCertificate.id),
                        userPassphrase: passphrase
                      })
                    })

                    // Parse response body first
                    const data = await res.json().catch(() => ({ error: 'Gagal memproses response' }))

                    // Handle errors according to BSrE JUKNIS format:
                    // HTTP 400: {"error": "Passphrase yang dimasukkan salah"} atau {"error": "NIK peserta tidak terdaftar"}
                    // HTTP 401: {"error": "Sertifikat belum diterbitkan"}
                    if (!res.ok) {
                      const errorMsg = data?.error || 'Gagal menandatangani dokumen'
                      const errorCode = data?.code

                      // Handle specific NIK missing error
                      if (errorCode === 'NIK_MISSING' || errorMsg.includes('NIK belum diatur')) {
                        setPassphraseError('NIK belum diatur di profil Anda. Silakan lengkapi data profil terlebih dahulu.')
                        setIsSigning(false)
                        return
                      }

                      // Check if passphrase is wrong (HTTP 400)
                      if (res.status === 400 && (
                        errorMsg.includes('Passphrase') ||
                        errorMsg.includes('passphrase') ||
                        errorMsg.includes('salah')
                      )) {
                        setPassphraseError('Passphrase yang dimasukkan salah. Silakan masukkan passphrase yang benar.')
                        setIsSigning(false)
                        return
                      }

                      // Check if NIK is not registered (HTTP 400)
                      if (res.status === 400 && (
                        errorMsg.includes('NIK') ||
                        errorMsg.includes('nik') ||
                        errorMsg.includes('tidak terdaftar') ||
                        errorMsg.includes('tidak ditemukan')
                      )) {
                        setPassphraseError('NIK peserta tidak terdaftar. Pastikan NIK sudah terdaftar di sistem BSrE.')
                        setIsSigning(false)
                        return
                      }

                      // For other errors, show error message in modal and alert
                      setPassphraseError(errorMsg)
                      showError(errorMsg)
                      setIsSigning(false)
                      return
                    }
                    setIsPassphraseModalOpen(false)
                    setPassphrase('')
                    showSuccess('Dokumen berhasil ditandatangani!')
                    // Set localStorage flag to notify other tabs/windows
                    localStorage.setItem('certificate_signed', JSON.stringify({
                      certificateId: selectedCertificate.id,
                      timestamp: Date.now()
                    }))
                    setTimeout(() => {
                      window.location.reload()
                    }, 1500)
                  } catch (err) {
                    showError('Terjadi kesalahan saat mengirim passphrase')
                  } finally {
                    setIsSigning(false)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {isSigning ? 'Memproses...' : 'Setuju dan Tanda Tangan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* BSrE Verification Modal */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsVerifyModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-teal-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Verifikasi BSrE
                    </h3>
                    <div className="mt-2">
                      {isVerifying ? (
                        <div className="flex flex-col items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
                          <p className="text-sm text-gray-500">Menghubungi server BSrE...</p>
                        </div>
                      ) : verificationResult ? (
                        <div className="text-sm text-gray-500 space-y-3">
                          {verificationResult.error ? (
                            <div className="bg-red-50 p-3 rounded-md text-red-700 border border-red-200">
                              <p className="font-bold">Verifikasi Gagal</p>
                              <p>{verificationResult.error}</p>
                              {verificationResult.details && <p className="text-xs mt-1">{typeof verificationResult.details === 'string' ? verificationResult.details : JSON.stringify(verificationResult.details)}</p>}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {/* Determine validity based on BSrE response structure */}
                              {(() => {
                                const isValid = verificationResult.notes?.toLowerCase().includes('dokumen valid') ||
                                  verificationResult.summary === 'VALID' ||
                                  verificationResult.summary === 'WARNING'; // Warning usually means valid signature but untrusted root (dev env)

                                const signerInfo = verificationResult.details?.[0]?.info_signer || {};
                                const tsaInfo = verificationResult.details?.[0]?.info_tsa || {};

                                return (
                                  <>
                                    <div className={`p-3 rounded-md border ${isValid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                      <p className="font-bold text-lg">{isValid ? 'Dokumen Valid' : 'Dokumen Tidak Valid'}</p>
                                      <p className="text-xs mt-1 font-semibold">{verificationResult.notes || verificationResult.summary || '-'}</p>
                                      {verificationResult.summary === 'WARNING' && (
                                        <p className="text-[10px] mt-1 italic">Note: Status WARNING biasanya muncul di environment development karena Root CA tidak dikenal browser/sistem, namun tanda tangan matematis valid.</p>
                                      )}
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-left">
                                      <p className="font-semibold text-gray-700 mb-1">Detail Penandatangan:</p>
                                      <ul className="space-y-1 text-xs">
                                        <li><span className="font-medium">Nama:</span> {signerInfo.nama_signer || signerInfo.signer_name || '-'}</li>
                                        <li><span className="font-medium">DN:</span> <span className="break-all">{signerInfo.issuer_dn || signerInfo.signer_dn || '-'}</span></li>
                                        <li><span className="font-medium">Waktu Tanda Tangan:</span> {tsaInfo.waktu_tsa || tsaInfo.timestamp || '-'}</li>
                                        <li><span className="font-medium">Nama Dokumen:</span> {verificationResult.nama_dokumen || '-'}</li>
                                      </ul>
                                    </div>

                                    <div className="mt-2">
                                      <button
                                        onClick={() => {
                                          const detailsElement = document.getElementById('raw-details');
                                          if (detailsElement) {
                                            detailsElement.style.display = detailsElement.style.display === 'none' ? 'block' : 'none';
                                          }
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-800 underline mb-1"
                                      >
                                        Lihat Raw Response
                                      </button>
                                      <div id="raw-details" style={{ display: 'none' }} className="bg-gray-100 p-2 rounded text-[10px] overflow-auto max-h-32 font-mono">
                                        {JSON.stringify(verificationResult, null, 2)}
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Siap melakukan verifikasi dokumen.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setIsVerifyModalOpen(false)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateVerificationCRUD
