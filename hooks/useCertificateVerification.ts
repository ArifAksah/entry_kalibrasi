import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CertificateVerification {
  id: number
  certificate_id: number
  verification_level: number
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
  rejection_reason?: string
  approval_notes?: string
  verified_by: string
  created_at: string
  updated_at: string
  certificate?: {
    id: number
    no_certificate: string
    no_order: string
    no_identification: string
    issue_date: string
    station?: number
    instrument?: number
    verification_notes?: string
    rejection_reason?: string
    repair_notes?: string
    repair_status?: 'none' | 'pending' | 'completed' | 'rejected'
    repair_requested_at?: string
    repair_completed_at?: string
  }
  verifikator?: {
    id: string
    name: string
  }
}

export interface PendingCertificate {
  id: number
  no_certificate: string
  no_order: string
  no_identification: string
  issue_date: string
  station?: number
  instrument?: number
  verifikator_1?: string
  verifikator_2?: string
  created_at: string
  station?: {
    id: number
    name: string
    station_id: string
  }
  instrument?: {
    id: number
    name: string
    type?: string
    manufacturer?: string
    serial_number?: string
  }
  verification_status: {
    verifikator_1: string
    verifikator_2: string
    user_verification_status: string | null
    user_verification_level: number | null
    user_verification_id: number | null
    verif1_created_at?: string
    verif2_created_at?: string
  }
}

export const useCertificateVerification = () => {
  const [verifications, setVerifications] = useState<CertificateVerification[]>([])
  const [pendingCertificates, setPendingCertificates] = useState<PendingCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVerifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/certificate-verification')
      if (!res.ok) throw new Error('Failed to fetch verifications')
      const data = await res.json()
      setVerifications(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCertificates = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      
      const res = await fetch('/api/certificate-verification/pending', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch pending certificates')
      const data = await res.json()
      setPendingCertificates(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const createVerification = async (payload: {
    certificate_id: number
    verification_level: number
    status: 'pending' | 'approved' | 'rejected'
    notes?: string
    rejection_reason?: string
    approval_notes?: string
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return { success: false, error: 'Not authenticated' }
      }
      
      // Get current user to include in payload
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('User not found')
        return { success: false, error: 'User not found' }
      }
      
      const res = await fetch('/api/certificate-verification', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          ...payload,
          verified_by: user.id
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMessage = data.error || 'Gagal membuat verifikasi'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
      
      setVerifications(prev => [data, ...prev])
      setError(null)
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  const updateVerification = async (id: number, payload: {
    status: 'pending' | 'approved' | 'rejected'
    notes?: string
    rejection_reason?: string
    approval_notes?: string
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return { success: false, error: 'Not authenticated' }
      }
      
      const res = await fetch(`/api/certificate-verification/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMessage = data.error || 'Gagal memperbarui verifikasi'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
      
      setVerifications(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  const deleteVerification = async (id: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      
      const res = await fetch(`/api/certificate-verification/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete verification')
      
      setVerifications(prev => prev.filter(item => item.id !== id))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const requestRepair = async (certificateId: number, repairNotes?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return { success: false, error: 'Not authenticated' }
      }
      
      const res = await fetch('/api/certificate-verification/repair', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          certificate_id: certificateId,
          repair_notes: repairNotes
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMessage = data.error || 'Gagal meminta perbaikan'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
      
      setError(null)
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  const completeRepair = async (certificateId: number, completionNotes?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return { success: false, error: 'Not authenticated' }
      }
      
      const res = await fetch('/api/certificate-verification/repair/complete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          certificate_id: certificateId,
          completion_notes: completionNotes
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMessage = data.error || 'Gagal menyelesaikan perbaikan'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
      
      setError(null)
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  const resetVerification = async (certificateId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return { success: false, error: 'Not authenticated' }
      }
      
      const res = await fetch('/api/certificate-verification/reset', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          certificate_id: certificateId
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMessage = data.error || 'Gagal mereset verifikasi'
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }
      
      setError(null)
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { success: false, error: msg }
    }
  }

  useEffect(() => { 
    fetchVerifications()
    fetchPendingCertificates()
  }, [])

  return { 
    verifications, 
    pendingCertificates,
    loading, 
    error, 
    createVerification, 
    updateVerification, 
    deleteVerification,
    requestRepair,
    completeRepair,
    resetVerification,
    refetch: fetchVerifications,
    refetchPending: fetchPendingCertificates
  }
}
