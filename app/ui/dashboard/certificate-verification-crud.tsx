'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificateVerification, PendingCertificate } from '../../../hooks/useCertificateVerification'
import { useStations } from '../../../hooks/useStations'
import { useInstruments } from '../../../hooks/useInstruments'
import { useSensors } from '../../../hooks/useSensors'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Alert from '../../../components/ui/Alert'
import { useAlert } from '../../../hooks/useAlert'
import { useCertificateRejection } from '../../../hooks/useCertificateRejection'
import LHKSReport from '../../../components/features/LHKSReport'
import UncertaintyModal from '../../../components/features/UncertaintyModal'
import { Certificate } from '../../../lib/supabase'
import { resultsToLegacyView } from '../../../lib/validators/certificate-results-render-adapter'
import { ViewIcon, CloseIcon, CheckIcon } from '../../../components/ui/ActionIcons'
import Dropdown, { DropdownItem } from '../../../components/ui/Dropdown'
import { supabase } from '../../../lib/supabase'

interface RejectionOption {
  value: string
  label: string
  description: string
  icon: string
  reset_from_level?: number
}

const CertificateVerificationCRUD: React.FC = () => {
  const { pendingCertificates, loading, error, createVerification, updateVerification } = useCertificateVerification()
  const { stations, refetch: fetchStations } = useStations()
  const { instruments, fetchInstruments } = useInstruments()
  const { sensors, fetchSensors } = useSensors()
  const [instrumentNames, setInstrumentNames] = useState<any[]>([])
  const { user } = useAuth()
  const { alert, showError, showSuccess, showWarning, hideAlert } = useAlert()

  // Fetch instruments & stations on mount (hooks don't auto-fetch)
  useEffect(() => {
    fetchInstruments({ pageSize: 500 })
    fetchStations({ pageSize: 500 })
    fetchSensors({ pageSize: 500 })
    
    fetch('/api/instrument-names')
      .then(res => res.json())
      .then(data => {
        setInstrumentNames(Array.isArray(data) ? data : data?.data || [])
      })
      .catch(e => console.error("Could not fetch instrument names", e))
  }, [])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<PendingCertificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { rejectCertificate } = useCertificateRejection()
  const [verificationForm, setVerificationForm] = useState({
    status: 'approved' as 'approved' | 'rejected',
    rejection_reason: '',
    rejection_category: 'administrative',
    approval_notes: ''
  })

  // Dynamic Rejection States
  const [rejectionOptions, setRejectionOptions] = useState<RejectionOption[]>([])
  const [loadingRejectionOptions, setLoadingRejectionOptions] = useState(false)

  // Fetch rejection options when status becomes rejected
  useEffect(() => {
    let isMounted = true
    const fetchOptions = async () => {
      if (verificationForm.status !== 'rejected' || !selectedCertificate) return
      
      setLoadingRejectionOptions(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')

        const response = await fetch(`/api/certificates/${selectedCertificate.id}/reject`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load rejection options')
        }

        const data = await response.json()
        if (isMounted) {
          setRejectionOptions(data.options || [])
          if (data.options?.length && !data.options.find((o: any) => o.value === verificationForm.rejection_category)) {
            setVerificationForm(prev => ({ ...prev, rejection_category: data.options[0].value }))
          }
        }
      } catch (error) {
        console.error('Error loading rejection options:', error)
        if (isMounted) {
          showError('Gagal memuat opsi penolakan')
        }
      } finally {
        if (isMounted) setLoadingRejectionOptions(false)
      }
    }

    fetchOptions()
    return () => { isMounted = false }
  }, [verificationForm.status, selectedCertificate, showError])

  const [isPassphraseModalOpen, setIsPassphraseModalOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [isSigning, setIsSigning] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)
  // Ref untuk menyimpan certificate ID tepat saat passphrase modal dibuka
  // Menghindari stale closure / selectedCertificate ter-reset sebelum signing selesai
  const signingCertificateIdRef = React.useRef<string | null>(null)

  // BSrE Verification State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // LHKS Modal State
  const [showLHKSModal, setShowLHKSModal] = useState(false)
  const [lhksCertificate, setLhksCertificate] = useState<Certificate | null>(null)
  const [lhksRawData, setLhksRawData] = useState<any[]>([])
  const [lhksStandardCerts, setLhksStandardCerts] = useState<any[]>([])
  const [showUncertaintyModal, setShowUncertaintyModal] = useState(false)
  const [uncertaintyCertificate, setUncertaintyCertificate] = useState<Certificate | null>(null)
  const [uncertaintyRawData, setUncertaintyRawData] = useState<any[]>([])
  const [uncertaintyStandardCerts, setUncertaintyStandardCerts] = useState<any[]>([])

  const handlePreviewLHKS = async (cert: PendingCertificate) => {
    const fullCert = cert as unknown as Certificate
    setLhksCertificate(fullCert)
    setLhksRawData([])
    setLhksStandardCerts([])
    try {
      // Extract session_id from results — works for both V0 (flat array) and V1 (object with sensors[])
      const legacyView = resultsToLegacyView(fullCert.results)
      const sessionId = legacyView.map((r: any) => r.session_id).find((sid: any) => !!sid) ?? null

      const fetchPromises = []
      if (sessionId) {
        fetchPromises.push(fetch(`/api/raw-data?session_id=${sessionId}`))
      } else {
        fetchPromises.push(Promise.resolve(null))
      }
      fetchPromises.push(fetch('/api/cert-standards'))

      const [rawRes, stdRes] = await Promise.all(fetchPromises)

      if (rawRes && rawRes.ok) {
        const json = await rawRes.json()
        setLhksRawData(json.data || [])
      }
      if (stdRes && stdRes.ok) {
        const json = await stdRes.json()
        setLhksStandardCerts(Array.isArray(json) ? json : [])
      }
    } catch (e) {
      console.error('Failed to fetch data for LHKS', e)
    }
    setShowLHKSModal(true)
  }

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

  const handleOpenUncertainty = async (cert: PendingCertificate) => {
    const fullCert = cert as unknown as Certificate
    // Extract session_id from results — works for both V0 (flat array) and V1 (object with sensors[])
    const legacyView = resultsToLegacyView(fullCert.results)
    const sessionId = legacyView.map((r: any) => r.session_id).find((sid: any) => !!sid) ?? null

    if (!sessionId) {
      showError('Data QC tidak tersedia. Pastikan sertifikat ini memiliki data mentah yang tersimpan (session_id).')
      return
    }

    setUncertaintyCertificate(fullCert)
    setUncertaintyRawData([])
    setUncertaintyStandardCerts([])

    try {
      const [rawRes, stdRes] = await Promise.all([
        fetch(`/api/raw-data?session_id=${sessionId}`),
        fetch('/api/cert-standards')
      ])

      if (!rawRes.ok) {
        throw new Error('Gagal mengambil data mentah untuk uncertainty')
      }

      const rawJson = await rawRes.json()
      setUncertaintyRawData(rawJson.data || [])

      if (stdRes.ok) {
        const stdJson = await stdRes.json()
        setUncertaintyStandardCerts(Array.isArray(stdJson) ? stdJson : [])
      }

      setShowUncertaintyModal(true)
    } catch (e) {
      console.error('Failed to fetch raw data for Uncertainty', e)
      showError('Gagal mengambil data mentah untuk perhitungan ketidakpastian')
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
    if (cert.verifikator_3 === user?.id) return 'Verifikator 3'
    if (cert.authorized_by === user?.id) return 'Penandatangan'
    return 'Unknown'
  }

  // Filter certificates based on search query
  const filteredCertificates = useMemo(() => {
    if (!pendingCertificates) return []
    const query = searchQuery.trim().toLowerCase()
    const visibleCertificates = pendingCertificates
    if (!query) return visibleCertificates

    return visibleCertificates.filter((cert) => {
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
        cert.verification_status.verifikator_3 || '',
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

  const openModal = (certificate: PendingCertificate) => {
    setSelectedCertificate(certificate)
    setVerificationForm({
      status: 'approved',
      rejection_reason: '',
      rejection_category: 'administrative',
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
      rejection_reason: '',
      rejection_category: 'administrative',
      approval_notes: ''
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedCertificate(null)
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

      if (verificationForm.status === 'approved' && verificationLevel === 4) {
        setIsSubmitting(false)
        setPassphrase('')
        setPassphraseError(null)
        // Simpan certificate ID ke ref agar tidak hilang saat modal transition
        signingCertificateIdRef.current = String(selectedCertificate.id)
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

      if (verificationForm.status === 'rejected') {
        const rejectionData = {
          verification_level: verificationLevel,
          rejection_reason: verificationForm.rejection_reason,
          rejection_category: verificationForm.rejection_category || 'administrative'
        }
        result = await rejectCertificate(selectedCertificate.id, rejectionData)
      } else {
        if (existingId) {
          result = await updateVerification(existingId, {
            status: verificationForm.status,
            approval_notes: verificationForm.approval_notes || undefined,
            rejection_reason: undefined
          })
        } else {
          result = await createVerification({
            certificate_id: selectedCertificate.id,
            verification_level: verificationLevel,
            status: verificationForm.status,
            notes: undefined,
            rejection_reason: undefined,
            approval_notes: verificationForm.approval_notes || undefined
          })
        }
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

      if (verificationForm.status === 'approved' && verificationLevel === 4) {
        setIsSubmitting(false)
        setPassphrase('')
        setPassphraseError(null)
        signingCertificateIdRef.current = String(selectedCertificate.id)
        setIsPassphraseModalOpen(true)
        return
      }

      let result;
      if (verificationForm.status === 'rejected') {
        const rejectionData = {
          verification_level: verificationLevel,
          rejection_reason: verificationForm.rejection_reason,
          rejection_category: verificationForm.rejection_category || 'administrative'
        }
        result = await rejectCertificate(selectedCertificate.id, rejectionData)
      } else {
        result = await updateVerification(existingId, {
          status: verificationForm.status,
          approval_notes: verificationForm.approval_notes || undefined,
          rejection_reason: undefined
        })
      }

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

  const getWorkflowStatusBadge = (cert: PendingCertificate) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full"

    if (cert.status === 'draft' && cert.has_rejected_verification) {
      return `${baseClasses} bg-amber-100 text-amber-800`
    }

    switch (cert.status) {
      case 'sent':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`
      case 'draft':
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-slate-100 text-slate-800`
    }
  }

  const getWorkflowStatusLabel = (cert: PendingCertificate) => {
    if (cert.status === 'draft' && cert.has_rejected_verification) {
      return 'Menunggu Perbaikan'
    }

    switch (cert.status) {
      case 'sent':
        return 'Terkirim'
      case 'approved':
        return 'Disetujui'
      case 'rejected':
        return 'Ditolak'
      case 'draft':
        return 'Draft'
      default:
        return cert.status
    }
  }

  const getWorkflowStatusHint = (cert: PendingCertificate) => {
    if (cert.status === 'draft' && cert.has_rejected_verification) {
      return 'Tampil karena pernah ditolak dan menunggu revisi'
    }

    if (cert.status === 'sent') {
      return 'Sedang berada di alur verifikasi'
    }

    if (cert.status === 'approved') {
      return 'Sertifikat selesai diverifikasi'
    }

    return null
  }

  const canEditOwnVerification = (cert: PendingCertificate) => {
    const hasExistingVerification = Boolean(cert.verification_status.user_verification_id)
    if (!hasExistingVerification) return false

    const userLevel = cert.verification_status.user_verification_level
    const userStatus = cert.verification_status.user_verification_status

    // Verifikator 3 may still revise their verification while final signing is still pending.
    return userLevel === 3 && userStatus === 'approved' && cert.verification_status.authorized_by !== 'approved'
  }

  const canShowPrimaryAction = (cert: PendingCertificate) => {
    return cert.verification_status.user_can_act || canEditOwnVerification(cert)
  }

  const isPrimaryActionDisabled = (cert: PendingCertificate) => {
    if (cert.verification_status.user_verification_status === 'rejected') return true
    if (cert.verification_status.user_verification_status === 'approved') {
      return !canEditOwnVerification(cert)
    }
    return false
  }

  const handlePrimaryAction = (cert: PendingCertificate) => {
    if (cert.verification_status.user_verification_status === 'pending') {
      openModal(cert)
      return
    }

    if (cert.verification_status.user_verification_id) {
      openEditModal(cert)
      return
    }

    openModal(cert)
  }

  const getPrimaryActionLabel = (_cert: PendingCertificate) => {
    // Seragamkan label tombol aksi utama → selalu 'Verifikasi'
    return 'Verifikasi'
  }

  const renderVerificationProgress = (verificationStatus: PendingCertificate['verification_status']) => (
    <div className="space-y-2 mt-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Verifikator 1</span>
        <span className={getStatusBadge(verificationStatus.verifikator_1 || 'pending')}>
          {verificationStatus.verifikator_1 || 'pending'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Verifikator 2</span>
        <span className={getStatusBadge(verificationStatus.verifikator_2 || 'pending')}>
          {verificationStatus.verifikator_2 || 'pending'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Verifikator 3</span>
        <span className={getStatusBadge(verificationStatus.verifikator_3 || 'pending')}>
          {verificationStatus.verifikator_3 || 'pending'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Penandatangan</span>
        <span className={getStatusBadge(verificationStatus.authorized_by || 'pending')}>
          {verificationStatus.authorized_by || 'pending'}
        </span>
      </div>
    </div>
  )

  const getRoleBadgeClass = (role: string) => {
    if (role.includes('Penandatangan')) return 'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800'
    if (role.includes('Verifikator')) return 'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800'
    return 'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800'
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
        <Breadcrumb items={[{ label: 'Verifikasi', href: '#' }, { label: 'Verifikasi Sertifikat' }]} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sertifikat yang Ditugaskan kepada Anda</h2>
          <p className="text-sm text-gray-600 mb-3">
            Anda ditugaskan sebagai verifikator untuk sertifikat berikut. Klik tombol verifikasi untuk meninjau dan memberikan keputusan.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Panduan Verifikasi:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li><span className="font-medium">Tinjau:</span> Periksa seluruh data sertifikat dengan teliti</li>
              <li><span className="font-medium">Setujui:</span> Jika data sudah benar dan lengkap</li>
              <li><span className="font-medium">Tolak:</span> Jika ada kesalahan yang perlu diperbaiki</li>
              <li><span className="font-medium">Catatan:</span> Berikan catatan yang relevan untuk setiap keputusan</li>
            </ul>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari berdasarkan nomor sertifikat, order, stasiun, instrumen, atau status..."
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
                  title="Hapus pencarian"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-600">
                Ditemukan <span className="font-medium">{filteredCertificates.length}</span> sertifikat yang cocok dengan "{searchQuery}"
                {filteredCertificates.length === 0 && (
                  <span className="text-red-500 ml-2">- Tidak ada sertifikat yang ditemukan</span>
                )}
              </div>
            )}
          </div>
        </div>

        <Table headers={[
          'Nomor Sertifikat',
          'Stasiun',
          'Peran & Status Anda',
          'Status Keseluruhan',
          'Aksi'
        ]}>
          {currentCertificates.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                {searchQuery ? 'Tidak ada sertifikat yang sesuai dengan pencarian Anda' : 'Tidak ada sertifikat yang ditugaskan kepada Anda'}
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
                      {cert.no_order} / {cert.no_identification}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-col items-start space-y-1.5">
                    <span className="font-medium text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-xs">
                      {getVerificationLevel(cert)}
                    </span>
                    <span className={getStatusBadge(cert.verification_status.user_verification_status || 'pending')}>
                      {cert.verification_status.user_verification_status || 'pending'}
                    </span>
                    {cert.verification_status.user_verification_status === 'rejected' && (
                      <span className="text-[10px] text-red-500">
                        Sertifikat ditolak
                      </span>
                    )}
                    {cert.verification_status.user_verification_status === 'pending' && (
                      <span className="text-[10px] text-yellow-600">
                        Menunggu verifikasi
                      </span>
                    )}
                    {cert.verification_status.user_verification_status === 'approved' && (
                      <span className={`text-[10px] ${canEditOwnVerification(cert) ? 'text-blue-600' : 'text-green-600'}`}>
                        {canEditOwnVerification(cert) ? 'Masih dapat diubah sebelum penandatangan verifikasi' : 'Edit terkunci'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex flex-col items-start space-y-1">
                      <span className={getWorkflowStatusBadge(cert)}>
                        {getWorkflowStatusLabel(cert)}
                      </span>
                      {getWorkflowStatusHint(cert) && (
                        <span className="text-[10px] text-gray-500">
                          {getWorkflowStatusHint(cert)}
                        </span>
                      )}
                    </div>
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
                      <span className="text-xs text-gray-500">Verifikator 3:</span>
                      <span className={getStatusBadge(cert.verification_status.verifikator_3)}>
                        {cert.verification_status.verifikator_3}
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
                  <div className="flex items-center space-x-2">
                    {/* Primary Action */}
                    {canShowPrimaryAction(cert) ? (
                      <button
                        onClick={() => handlePrimaryAction(cert)}
                        disabled={isPrimaryActionDisabled(cert)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-all duration-200 shadow-sm ${
                          isPrimaryActionDisabled(cert)
                            ? 'bg-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <CheckIcon className="w-4 h-4" />
                        <span>{getPrimaryActionLabel(cert)}</span>
                      </button>
                    ) : (
                      <a
                        href={`/certificates/${cert.id}/view?from=verification`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all duration-200 shadow-sm"
                      >
                        <ViewIcon className="w-4 h-4" />
                        <span>Lihat</span>
                      </a>
                    )}

                    {/* Dropdown aksi tambahan */}
                    <Dropdown
                      trigger={
                        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                      }
                    >
                      {/* Lihat sertifikat jika bukan aksi utama */}
                      {canShowPrimaryAction(cert) && (
                        <DropdownItem
                          href={`/certificates/${cert.id}/view?from=verification`}
                          target="_blank"
                          icon={<ViewIcon className="w-4 h-4" />}
                        >
                          Lihat Sertifikat
                        </DropdownItem>
                      )}

                      {/* Pratinjau LHKS */}
                      <DropdownItem
                        onClick={() => handlePreviewLHKS(cert)}
                        icon={
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        }
                      >
                        Pratinjau LHKS
                      </DropdownItem>

                      <DropdownItem
                        onClick={() => handleOpenUncertainty(cert)}
                        icon={
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        }
                      >
                        Uncertainty
                      </DropdownItem>

                      {cert.verification_status.authorized_by === 'approved' && (cert as any).pdf_path && (
                        <>
                          <DropdownItem
                            onClick={async () => {
                              try {
                                const { data: { session } } = await supabase.auth.getSession()
                                if (!session?.access_token) throw new Error('Not authenticated')
                                const response = await fetch(`/api/certificates/${cert.id}/pdf?t=${Date.now()}`, {
                                  cache: 'no-store',
                                  headers: { 'Authorization': `Bearer ${session.access_token}` }
                                })
                                if (!response.ok) throw new Error('Gagal membuka PDF')
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                window.open(url, '_blank', 'noopener,noreferrer')
                                window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
                              } catch (err) {
                                console.error('Error opening PDF:', err)
                                showError('Gagal membuka PDF.')
                              }
                            }}
                            icon={
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            }
                          >
                            Lihat PDF Tersimpan
                          </DropdownItem>
                          <DropdownItem
                            onClick={async () => {
                              try {
                                const { data: { session } } = await supabase.auth.getSession()
                                if (!session?.access_token) throw new Error('Not authenticated')
                                const response = await fetch(`/api/certificates/${cert.id}/pdf?download=true&t=${Date.now()}`, {
                                  cache: 'no-store',
                                  headers: { 'Authorization': `Bearer ${session.access_token}` }
                                })
                                if (!response.ok) {
                                  const errorData = await response.json().catch(() => ({ error: 'Gagal mengunduh PDF' }))
                                  showError(errorData.error || 'Gagal mengunduh PDF.')
                                  return
                                }

                                const contentType = response.headers.get('Content-Type') || ''
                                if (!contentType.toLowerCase().includes('application/pdf')) {
                                  const errorText = await response.text().catch(() => '')
                                  showError(`Response download bukan PDF yang valid.${errorText ? ` ${errorText.slice(0, 160)}` : ''}`)
                                  return
                                }
                                
                                const contentDisposition = response.headers.get('Content-Disposition')
                                let filename = `Certificate_${cert.no_certificate || cert.id}_Signed.pdf`
                                if (contentDisposition) {
                                  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
                                  if (filenameMatch && filenameMatch[1]) {
                                    filename = filenameMatch[1].replace(/['"]/g, '')
                                    if (filename.includes('%')) filename = decodeURIComponent(filename)
                                  }
                                }

                                if (!filename.toLowerCase().endsWith('.pdf')) filename = `${filename}.pdf`

                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = filename
                                a.type = 'application/pdf'
                                document.body.appendChild(a)
                                a.click()
                                window.URL.revokeObjectURL(url)
                                document.body.removeChild(a)
                              } catch (err) {
                                console.error('Error downloading PDF:', err)
                                showError('Gagal mengunduh PDF.')
                              }
                            }}
                            icon={
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            }
                          >
                            Unduh PDF Bertanda Tangan
                          </DropdownItem>
                        </>
                      )}

                      {/* Verifikasi BSrE */}
                      {cert.verification_status.authorized_by === 'approved' && (cert as any).pdf_path && (
                        <DropdownItem
                          onClick={() => handleVerifyBSrE(cert)}
                          icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                        >
                          Verifikasi BSrE
                        </DropdownItem>
                      )}
                    </Dropdown>
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
                Sebelumnya
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
                Berikutnya
                <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Menampilkan <span className="font-medium">{indexOfFirstCertificate + 1}</span> sampai{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastCertificate, filteredCertificates.length)}
                  </span>{' '}
                  dari <span className="font-medium">{filteredCertificates.length}</span> hasil
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
                Verifikasi Sertifikat - {selectedCertificate.no_certificate}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Detail Sertifikat</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Nomor Sertifikat:</span>
                      <p className="text-gray-900">{selectedCertificate.no_certificate}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Nomor Order:</span>
                      <p className="text-gray-900">{selectedCertificate.no_order}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Identifikasi:</span>
                      <p className="text-gray-900">{selectedCertificate.no_identification}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tanggal Terbit:</span>
                      <p className="text-gray-900">{new Date(selectedCertificate.issue_date).toISOString().slice(0, 10)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Stasiun:</span>
                      <p className="text-gray-900">{selectedCertificate.station?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Instrumen:</span>
                      <p className="text-gray-900">{selectedCertificate.instrument?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Peran Anda:</span>
                      <div className="mt-1">
                        <span className={getRoleBadgeClass(getVerificationLevel(selectedCertificate))}>
                          {getVerificationLevel(selectedCertificate)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status Saat Ini:</span>
                      <div className="mt-1">
                        <span className={getStatusBadge(selectedCertificate.verification_status.user_verification_status || 'pending')}>
                          {selectedCertificate.verification_status.user_verification_status || 'pending'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status Alur:</span>
                      <div className="mt-1 space-y-1">
                        <span className={getWorkflowStatusBadge(selectedCertificate)}>
                          {getWorkflowStatusLabel(selectedCertificate)}
                        </span>
                        {getWorkflowStatusHint(selectedCertificate) && (
                          <p className="text-[11px] text-gray-500">
                            {getWorkflowStatusHint(selectedCertificate)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Progres Verifikasi:</span>
                      {renderVerificationProgress(selectedCertificate.verification_status)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keputusan Verifikasi
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
                        <span className="text-green-700 font-medium">Setujui</span>
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
                        <span className="text-red-700 font-medium">Tolak</span>
                      </label>
                    </div>
                  </div>

                  {verificationForm.status === 'rejected' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-2">
                          Catatan Penolakan *
                        </label>
                        <textarea
                          value={verificationForm.rejection_reason}
                          onChange={(e) => setVerificationForm({ ...verificationForm, rejection_reason: e.target.value })}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          rows={3}
                          placeholder="Tuliskan alasan penolakan secara rinci..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Kategori Penolakan *
                        </label>

                        {loadingRejectionOptions ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                            <span className="ml-3 text-sm text-gray-600">Memuat opsi...</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {rejectionOptions.map((option) => (
                              <label
                                key={option.value}
                                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                                  verificationForm.rejection_category === option.value
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="rejection_category"
                                  value={option.value}
                                  checked={verificationForm.rejection_category === option.value}
                                  onChange={(e) => setVerificationForm({ ...verificationForm, rejection_category: e.target.value })}
                                  className="mt-1 mr-3 text-red-600 focus:ring-red-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-base">{option.icon}</span>
                                    <span className="font-medium text-sm text-gray-900">{option.label}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <svg className="w-4 h-4 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <p className="text-xs text-yellow-700">
                              Sertifikat akan dikembalikan ke pembuat untuk direvisi. Sistem akan otomatis menentukan verifikasi ulang mulai level yang sesuai dengan kategori penolakan.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {verificationForm.status === 'approved' && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        Catatan Persetujuan (Opsional)
                      </label>
                      <textarea
                        value={verificationForm.approval_notes}
                        onChange={(e) => setVerificationForm({ ...verificationForm, approval_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        placeholder="Tambahkan catatan persetujuan jika diperlukan..."
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
                Ubah Verifikasi - {selectedCertificate.no_certificate}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Detail Sertifikat</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Nomor Sertifikat:</span>
                      <p className="text-gray-900">{selectedCertificate.no_certificate}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Nomor Order:</span>
                      <p className="text-gray-900">{selectedCertificate.no_order}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Identifikasi:</span>
                      <p className="text-gray-900">{selectedCertificate.no_identification}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tanggal Terbit:</span>
                      <p className="text-gray-900">{new Date(selectedCertificate.issue_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Stasiun:</span>
                      <p className="text-gray-900">{selectedCertificate.station?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Instrumen:</span>
                      <p className="text-gray-900">{selectedCertificate.instrument?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Peran Anda:</span>
                      <div className="mt-1">
                        <span className={getRoleBadgeClass(getVerificationLevel(selectedCertificate))}>
                          {getVerificationLevel(selectedCertificate)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status Saat Ini:</span>
                      <div className="mt-1">
                        <span className={getStatusBadge(selectedCertificate.verification_status.user_verification_status || 'pending')}>
                          {selectedCertificate.verification_status.user_verification_status || 'pending'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status Alur:</span>
                      <div className="mt-1 space-y-1">
                        <span className={getWorkflowStatusBadge(selectedCertificate)}>
                          {getWorkflowStatusLabel(selectedCertificate)}
                        </span>
                        {getWorkflowStatusHint(selectedCertificate) && (
                          <p className="text-[11px] text-gray-500">
                            {getWorkflowStatusHint(selectedCertificate)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Progres Verifikasi:</span>
                      {renderVerificationProgress(selectedCertificate.verification_status)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keputusan Verifikasi
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
                        <span className="text-green-700 font-medium">Setujui</span>
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
                        <span className="text-red-700 font-medium">Tolak</span>
                      </label>
                    </div>
                  </div>

                  {verificationForm.status === 'rejected' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-2">
                          Catatan Penolakan *
                        </label>
                        <textarea
                          value={verificationForm.rejection_reason}
                          onChange={(e) => setVerificationForm({ ...verificationForm, rejection_reason: e.target.value })}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          rows={3}
                          placeholder="Tuliskan alasan penolakan secara rinci..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Kategori Penolakan *
                        </label>

                        {loadingRejectionOptions ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                            <span className="ml-3 text-sm text-gray-600">Memuat opsi...</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {rejectionOptions.map((option) => (
                              <label
                                key={option.value}
                                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                                  verificationForm.rejection_category === option.value
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="edit_rejection_category"
                                  value={option.value}
                                  checked={verificationForm.rejection_category === option.value}
                                  onChange={(e) => setVerificationForm({ ...verificationForm, rejection_category: e.target.value })}
                                  className="mt-1 mr-3 text-red-600 focus:ring-red-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-base">{option.icon}</span>
                                    <span className="font-medium text-sm text-gray-900">{option.label}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {verificationForm.status === 'approved' && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        Catatan Persetujuan (Opsional)
                      </label>
                      <textarea
                        value={verificationForm.approval_notes}
                        onChange={(e) => setVerificationForm({ ...verificationForm, approval_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        placeholder="Tambahkan catatan persetujuan jika diperlukan..."
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
                {isSubmitting ? 'Mengirim...' : `${verificationForm.status === 'approved' ? 'Perbarui Persetujuan' : 'Perbarui Penolakan'}`}
              </button>
            </div>
          </div>
        </div>
      )}



      {isPassphraseModalOpen && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Tanda Tangan Elektronik (TTE)</h3>
              </div>
              {!isSigning && (
                <button
                  onClick={() => {
                    setIsPassphraseModalOpen(false)
                    setPassphraseError(null)
                    setPassphrase('')
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Info sertifikat */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Sertifikat:</span> {selectedCertificate.no_certificate}
                </p>
              </div>

              {/* Loading state saat proses berlangsung */}
              {isSigning ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-100"></div>
                    <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute inset-0"></div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-800">Sedang memproses...</p>
                    <p className="text-xs text-gray-500">Membuat PDF dan mengirim ke BSrE untuk penandatanganan.</p>
                    <p className="text-xs text-amber-600 font-medium">Proses ini dapat memakan waktu 1-3 menit, harap tunggu.</p>
                  </div>
                </div>
              ) : passphraseError && passphraseError.toLowerCase().includes('nik') ? null : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passphrase BSrE
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={passphrase}
                    onChange={(e) => {
                      setPassphrase(e.target.value)
                      setPassphraseError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!isSigning) {
                          const btn = document.querySelector('[data-sign-btn]') as HTMLButtonElement
                          if (btn) btn.click()
                        }
                      }
                    }}
                    disabled={isSigning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Masukkan passphrase TTE Anda"
                    autoFocus
                  />
                </div>
              )}

              {/* Error display - selalu tampil jika ada error, bahkan saat loading selesai */}
              {passphraseError && !isSigning && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Gagal menandatangani dokumen</p>
                      <p className="text-sm text-red-700 mt-1">{passphraseError}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              {passphraseError && passphraseError.toLowerCase().includes('nik') && !isSigning && (
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
              {!isSigning && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPassphraseModalOpen(false)
                    setPassphraseError(null)
                    setPassphrase('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Batal
                </button>
              )}
              {!(passphraseError && passphraseError.toLowerCase().includes('nik')) && (
                <button
                  type="button"
                  data-sign-btn
                  disabled={isSigning}
                  onClick={async (e) => {
                    e.preventDefault()
                    if (!selectedCertificate) return
                    if (!passphrase.trim()) {
                      setPassphraseError('Passphrase wajib diisi')
                      return
                    }

                    // Clear error sebelum mulai
                    setPassphraseError(null)

                    try {
                      setIsSigning(true)
                      const { data: { session } } = await (await import('../../../lib/supabase')).supabase.auth.getSession()
                      const token = session?.access_token
                      if (!token) {
                        setPassphraseError('Sesi login tidak valid. Silakan login ulang.')
                        setIsSigning(false)
                        return
                      }

                      let res: Response
                      try {
                        res = await fetch('/api/certificate-verification/sign-level-3', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            // Gunakan ref untuk memastikan document ID yang dipakai
                            // adalah ID sertifikat yang dipilih saat modal dibuka,
                            // bukan selectedCertificate yang mungkin sudah berubah/null
                            documentId: signingCertificateIdRef.current || String(selectedCertificate?.id),
                            userPassphrase: passphrase
                          })
                        })
                      } catch (networkErr: any) {
                        // Network error / fetch failed
                        setPassphraseError('Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.')
                        setIsSigning(false)
                        return
                      }

                      // Parse response body
                      let data: any = {}
                      try {
                        data = await res.json()
                      } catch {
                        data = { error: 'Gagal memproses response dari server' }
                      }

                      if (!res.ok) {
                        const errorMsg = data?.error || 'Gagal menandatangani dokumen'
                        const errorCode = data?.code
                        const errorMsgLower = errorMsg.toLowerCase()

                        // NIK belum diatur di database
                        if (
                          errorCode === 'NIK_MISSING' ||
                          errorMsg.includes('NIK belum diatur') ||
                          errorMsg.includes('NIK tidak ditemukan') ||
                          errorMsg.includes('NIK_NOT_FOUND')
                        ) {
                          setPassphraseError('NIK belum diatur di profil Anda. Silakan lengkapi data NIK di halaman profil.')
                          setIsSigning(false)
                          return
                        }

                        // NIK ada di database tapi tidak dikenali BSrE
                        if (
                          errorCode === 'NIK_INVALID_BSRE' ||
                          errorMsg.includes('NIK_INVALID') ||
                          errorMsg.includes('NIK Anda tidak dikenali')
                        ) {
                          setPassphraseError('NIK Anda tidak dikenali oleh sistem BSrE. Pastikan NIK yang didaftarkan di profil sudah terdaftar di BSrE.')
                          setIsSigning(false)
                          return
                        }

                        // Cek NIK error dari pesan (fallback jika error code tidak spesifik)
                        // Ini safety net agar NIK error tidak disalahklasifikasikan sebagai passphrase salah
                        const isNikError =
                          errorMsgLower.includes('nik') ||
                          errorMsgLower.includes('tidak terdaftar di bsre') ||
                          errorMsgLower.includes('user not found') ||
                          errorMsgLower.includes('pengguna tidak ditemukan')
                        if (isNikError) {
                          setPassphraseError('NIK Anda tidak dikenali atau tidak terdaftar di BSrE. Silakan periksa data NIK di halaman profil.')
                          setIsSigning(false)
                          return
                        }

                        // Passphrase salah (HTTP 400) - hanya jika bukan error NIK
                        if (res.status === 400) {
                          if (
                            errorMsgLower.includes('passphrase') ||
                            errorMsgLower.includes('salah')
                          ) {
                            setPassphraseError('Passphrase yang Anda masukkan salah. Silakan coba lagi.')
                          } else {
                            setPassphraseError(errorMsg)
                          }
                          setIsSigning(false)
                          return
                        }

                        // Belum semua verifikator approve (HTTP 401)
                        if (res.status === 401) {
                          setPassphraseError('Sertifikat belum siap untuk ditandatangani. Pastikan semua verifikator sudah menyetujui.')
                          setIsSigning(false)
                          return
                        }

                        // Tidak berwenang (HTTP 403)
                        if (res.status === 403) {
                          setPassphraseError('Anda tidak berwenang menandatangani dokumen ini.')
                          setIsSigning(false)
                          return
                        }

                        // Error lainnya (500, dll)
                        setPassphraseError(`Terjadi kesalahan: ${errorMsg}`)
                        setIsSigning(false)
                        return
                      }

                      // === SUCCESS ===
                      setIsSigning(false)
                      setPassphrase('')
                      setIsPassphraseModalOpen(false)
                      localStorage.setItem('certificate_signed', JSON.stringify({
                        certificateId: selectedCertificate.id,
                        timestamp: Date.now()
                      }))
                      // Tampilkan notifikasi sukses menggunakan useAlert (bukan window.alert)
                      // window.alert() bisa di-suppress browser saat async handler sebelum reload
                      showSuccess('Dokumen berhasil ditandatangani. Halaman akan diperbarui...')
                      // Tunggu 3 detik agar notifikasi terlihat sebelum reload
                      setTimeout(() => {
                        window.location.reload()
                      }, 3000)

                    } catch (err: any) {
                      // Catch-all untuk error yang tidak terduga
                      console.error('[Passphrase Submit] Unexpected error:', err)
                      setPassphraseError(`Terjadi kesalahan tidak terduga: ${err?.message || 'Silakan coba lagi.'}`)
                      setIsSigning(false)
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSigning ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memproses...
                    </span>
                  ) : 'Setuju dan Tanda Tangan'}
                </button>
              )}
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

      {/* LHKS Modal */}
      {showLHKSModal && lhksCertificate && (() => {
        const legacyView = resultsToLegacyView(lhksCertificate.results)
        const firstResult = legacyView[0]
        const envs = firstResult?.environment || []
        const temp = envs.find((e: any) => e.key?.toLowerCase().includes('suhu') || e.key?.toLowerCase().includes('temp'))?.value
        const hum = envs.find((e: any) => e.key?.toLowerCase().includes('kelembapan') || e.key?.toLowerCase().includes('humidity') || e.key?.toLowerCase().includes('rh'))?.value
        return (
        <LHKSReport
          isOpen={showLHKSModal}
          onClose={() => { setShowLHKSModal(false); setLhksCertificate(null) }}
          certificate={lhksCertificate}
          owner={stations.find(s => s.id === (typeof lhksCertificate.station === 'object' ? (lhksCertificate.station as any)?.id : lhksCertificate.station)) || null}
          instrument={instruments.find(i => i.id === (typeof lhksCertificate.instrument === 'object' ? (lhksCertificate.instrument as any)?.id : lhksCertificate.instrument)) || null}
          sensors={instruments.find(i => i.id === (typeof lhksCertificate.instrument === 'object' ? (lhksCertificate.instrument as any)?.id : lhksCertificate.instrument))?.sensor || []}
          rawData={lhksRawData}
          standardCerts={lhksStandardCerts}
          calibrationDate={firstResult?.startDate || lhksCertificate.issue_date || ''}
          calibrationLocation={firstResult?.place || ''}
          environmentConditions={{ temperature: temp || '-', humidity: hum || '-' }}
          sessionResults={legacyView}
          allInstruments={instruments}
          allSensors={sensors}
          instrumentNames={instrumentNames}
        />
        )
      })()}

      {showUncertaintyModal && uncertaintyCertificate && (
        <UncertaintyModal
          isOpen={showUncertaintyModal}
          onClose={() => {
            setShowUncertaintyModal(false)
            setUncertaintyCertificate(null)
          }}
          certificate={uncertaintyCertificate}
          instruments={instruments}
          sensors={sensors}
          standardCerts={uncertaintyStandardCerts}
          rawData={uncertaintyRawData}
          instrumentNames={instrumentNames}
        />
      )}
    </div>
  )
}

export default CertificateVerificationCRUD
