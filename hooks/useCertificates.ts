import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Certificate, CertificateInsert, CertificateUpdate } from '../lib/supabase'

export const useCertificates = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCertificates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/certificates')
      if (!res.ok) throw new Error('Failed to fetch certificates')
      const data = await res.json()
      setCertificates(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

    const addCertificate = async (payload: CertificateInsert) => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')
        const res = await fetch('/api/certificates', {
        method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add certificate')
      try {
        // Ensure creator fields exist locally so creator can see their own certificate immediately
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData?.user?.id
        if (uid) {
          if (data && typeof data === 'object') {
            if (data.created_by == null) (data as any).created_by = uid
            if (data.sent_by == null) (data as any).sent_by = uid
          }
        }
      } catch {}
      setCertificates(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

    const updateCertificate = async (id: number, payload: CertificateUpdate) => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')
        const res = await fetch(`/api/certificates/${id}`, {
        method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update certificate')
      setCertificates(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const deleteCertificate = async (id: number) => {
    try {
      const res = await fetch(`/api/certificates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete certificate')
      setCertificates(prev => prev.filter(item => item.id !== id))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  useEffect(() => { fetchCertificates() }, [])

  return { certificates, loading, error, addCertificate, updateCertificate, deleteCertificate, refetch: fetchCertificates }
}




