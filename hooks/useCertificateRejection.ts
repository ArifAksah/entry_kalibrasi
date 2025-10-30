import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface RejectionData {
  verification_level: number
  rejection_reason: string
  rejection_destination?: string
}

interface RejectionOptions {
  success: boolean
  options?: Array<{
    value: string
    label: string
    description: string
    icon: string
  }>
  certificate?: {
    id: number
    no_certificate: string
    status: string
  }
  error?: string
}

export const useCertificateRejection = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getRejectionOptions = async (certificateId: number): Promise<RejectionOptions> => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/certificates/${certificateId}/reject`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get rejection options')
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const rejectCertificate = async (
    certificateId: number, 
    rejectionData: RejectionData
  ): Promise<{ success: boolean; error?: string; data?: any }> => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/certificates/${certificateId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(rejectionData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject certificate')
      }

      return { success: true, data }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const getRejectionHistory = async (certificateId: number) => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/certificates/${certificateId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get certificate data')
      }

      return {
        success: true,
        rejection_history: data.rejection_history || [],
        rejection_count: data.rejection_count || 0,
        last_rejection_by: data.last_rejection_by,
        last_rejection_at: data.last_rejection_at
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    getRejectionOptions,
    rejectCertificate,
    getRejectionHistory
  }
}




