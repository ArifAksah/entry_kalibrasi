'use client'

import React, { useState, useCallback } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useAlert } from '../../../hooks/useAlert'
import { supabase } from '../../../lib/supabase'

interface RejectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: RejectionData) => void
  certificateId: number
  verificationLevel: number
  certificateNumber: string
}

interface RejectionData {
  verification_level: number
  rejection_reason: string
  rejection_destination?: string
}

interface RejectionOption {
  value: string
  label: string
  description: string
  icon: string
}

const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  certificateId,
  verificationLevel,
  certificateNumber
}) => {
  const { user } = useAuth()
  const { showAlert } = useAlert()
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionDestination, setRejectionDestination] = useState('creator')
  const [rejectionOptions, setRejectionOptions] = useState<RejectionOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)

  const loadRejectionOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch(`/api/certificates/${certificateId}/reject`, {
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
      setRejectionOptions(data.options || [])
    } catch (error) {
      console.error('Error loading rejection options:', error)
      showAlert('error', 'Gagal memuat opsi penolakan')
    } finally {
      setLoadingOptions(false)
    }
  }, [certificateId, showAlert])

  // Load rejection options for verifikator 2
  React.useEffect(() => {
    if (isOpen && verificationLevel === 2) {
      loadRejectionOptions()
    }
  }, [isOpen, verificationLevel, loadRejectionOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!rejectionReason.trim()) {
      showAlert('error', 'Alasan penolakan harus diisi')
      return
    }

    setLoading(true)
    try {
      const rejectionData: RejectionData = {
        verification_level: verificationLevel,
        rejection_reason: rejectionReason.trim(),
        rejection_destination: verificationLevel === 2 ? rejectionDestination : 'creator'
      }

      await onConfirm(rejectionData)
      onClose()
    } catch (error) {
      console.error('Error submitting rejection:', error)
      showAlert('error', 'Gagal mengirim penolakan')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRejectionReason('')
    setRejectionDestination('creator')
    setRejectionOptions([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Tolak Sertifikat</h2>
                <p className="text-red-100 text-sm">
                  {certificateNumber} - Verifikator {verificationLevel}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-red-200 transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rejection Reason */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Alasan Penolakan *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan sertifikat ini..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={4}
                required
              />
            </div>

            {/* Rejection Destination (only for Verifikator 2) */}
            {verificationLevel === 2 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tujuan Pengembalian *
                </label>
                
                {loadingOptions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                    <span className="ml-3 text-gray-600">Memuat opsi...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rejectionOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          rejectionDestination === option.value
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="rejection_destination"
                          value={option.value}
                          checked={rejectionDestination === option.value}
                          onChange={(e) => setRejectionDestination(e.target.value)}
                          className="mt-1 mr-3 text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{option.icon}</span>
                            <span className="font-medium text-gray-900">{option.label}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Perhatian</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    {verificationLevel === 1 
                      ? 'Sertifikat akan dikembalikan langsung ke pembuat untuk diperbaiki.'
                      : 'Pilih tujuan pengembalian yang sesuai. Sertifikat akan dikembalikan sesuai pilihan Anda.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !rejectionReason.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>Tolak Sertifikat</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RejectionModal
