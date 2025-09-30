import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CertificateVerification {
  id: number
  certificate_id: number
  verification_level: number
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
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
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      
      // Get current user to include in payload
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not found')
      
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
      if (!res.ok) throw new Error(data.error || 'Failed to create verification')
      
      setVerifications(prev => [data, ...prev])
      setError(null)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateVerification = async (id: number, payload: {
    status: 'pending' | 'approved' | 'rejected'
    notes?: string
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      
      const res = await fetch(`/api/certificate-verification/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update verification')
      
      setVerifications(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
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
    refetch: fetchVerifications,
    refetchPending: fetchPendingCertificates
  }
}
