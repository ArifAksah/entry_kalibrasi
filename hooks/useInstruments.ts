import { useEffect, useState } from 'react'
import { Instrument, InstrumentInsert, InstrumentUpdate } from '../lib/supabase'

export const useInstruments = () => {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstruments = async (opts?: { q?: string; page?: number; pageSize?: number; type?: 'standard' | 'uut' }) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (opts?.q) params.set('q', opts.q)
      if (opts?.page) params.set('page', String(opts.page))
      if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))
      if (opts?.type) params.set('type', opts.type)
      const qs = params.toString()
      const res = await fetch(`/api/instruments${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch instruments')
      const payload = await res.json()
      const data = Array.isArray(payload) ? payload : (payload?.data ?? [])
      setInstruments(data)
      setError(null)
      return payload
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }
    } finally {
      setLoading(false)
    }
  }

  const addInstrument = async (payload: InstrumentInsert) => {
    try {
      const res = await fetch('/api/instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add instrument')
      setInstruments(prev => [data, ...prev])
      setError(null)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateInstrument = async (id: number, payload: InstrumentUpdate) => {
    try {
      const res = await fetch(`/api/instruments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update instrument')
      setInstruments(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const deleteInstrument = async (id: number) => {
    try {
      const res = await fetch(`/api/instruments/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete instrument')
      setInstruments(prev => prev.filter(item => item.id !== id))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  useEffect(() => { fetchInstruments({ page: 1, pageSize: 10 }) }, [])

  return { instruments, loading, error, addInstrument, updateInstrument, deleteInstrument, refetch: fetchInstruments, fetchInstruments }
}











