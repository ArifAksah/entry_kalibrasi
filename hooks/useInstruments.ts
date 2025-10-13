import { useEffect, useState } from 'react'
import { Instrument, InstrumentInsert, InstrumentUpdate } from '../lib/supabase'

export const useInstruments = () => {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstruments = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/instruments')
      if (!res.ok) throw new Error('Failed to fetch instruments')
      const data = await res.json()
      setInstruments(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateInstrument = async (id: number, payload: InstrumentUpdate) => {
    try {
      const res = await fetch(`/api/instruments/${id}` ,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update instrument')
      setInstruments(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
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

  useEffect(() => { fetchInstruments() }, [])

  return { instruments, loading, error, addInstrument, updateInstrument, deleteInstrument, refetch: fetchInstruments }
}











