'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificateVerification, PendingCertificate } from '../../../hooks/useCertificateVerification'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { usePermissions } from '../../../hooks/usePermissions'

const CertificateVerificationCRUD: React.FC = () => {
  const { pendingCertificates, loading, error, createVerification, updateVerification } = useCertificateVerification()
  const { user } = useAuth()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<PendingCertificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verificationForm, setVerificationForm] = useState({
    status: 'approved' as 'approved' | 'rejected',
    notes: ''
  })

  const openModal = (certificate: PendingCertificate) => {
    setSelectedCertificate(certificate)
    setVerificationForm({
      status: 'approved',
      notes: ''
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedCertificate(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCertificate) return
    
    setIsSubmitting(true)
    try {
      const verificationLevel = selectedCertificate.verification_status.user_verification_level
      if (!verificationLevel) throw new Error('Invalid verification level')

      // Check if verification already exists
      const existingVerification = selectedCertificate.verification_status.user_verification_status
      if (existingVerification && existingVerification !== 'pending') {
        throw new Error('This certificate has already been verified')
      }

      const existingId = selectedCertificate.verification_status.user_verification_id
      if (existingId) {
        await updateVerification(existingId, verificationForm)
      } else {
        await createVerification({
          certificate_id: selectedCertificate.id,
          verification_level: verificationLevel,
          status: verificationForm.status,
          notes: verificationForm.notes || undefined
        })
      }
      
      closeModal()
      // Refresh data (soft): refetch pending list
      // As a simple approach, reload the page to ensure all views reflect changes
      window.location.reload()
    } catch (e) {
      console.error('Verification error:', e)
      alert(e instanceof Error ? e.message : 'Failed to submit verification')
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
          <p className="text-sm text-gray-600">
            You are assigned as a verifikator for the following certificates. Click "Verify" to review and approve/reject.
          </p>
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
                <span className={getStatusBadge(cert.verification_status.user_verification_status || 'pending')}>
                  {cert.verification_status.user_verification_status || 'pending'}
                </span>
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
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <a 
                  href={`/certificates/${cert.id}/print`} 
                  target="_blank" 
                  className="text-green-600 hover:text-green-800"
                >
                  View
                </a>
                {cert.verification_status.user_can_act ? (
                  <button 
                    onClick={() => openModal(cert)} 
                    className="text-blue-600 hover:text-blue-900"
                    disabled={cert.verification_status.user_verification_status === 'approved' || cert.verification_status.user_verification_status === 'rejected'}
                  >
                    {cert.verification_status.user_verification_status === 'pending' ? 'Verify' : 'Update'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Waiting previous step</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl mx-4">
            <Card title={`Verify Certificate - ${selectedCertificate.no_certificate}`}>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      Notes (Optional)
                    </label>
                    <textarea
                      value={verificationForm.notes}
                      onChange={(e) => setVerificationForm({ ...verificationForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Add any notes about your verification decision..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                      verificationForm.status === 'approved' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : `${verificationForm.status === 'approved' ? 'Approve' : 'Reject'} Certificate`}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateVerificationCRUD
