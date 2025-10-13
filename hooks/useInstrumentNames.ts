// hooks/useInstrumentNames.ts
import { useEffect, useState } from 'react'
import { InstrumentName, InstrumentNameInsert, InstrumentNameUpdate } from '../lib/supabase'

export const useInstrumentNames = () => {
  const [instrumentNames, setInstrumentNames] = useState<InstrumentName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstrumentNames = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/instrument-names')
      if (!res.ok) throw new Error('Failed to fetch instrument names')
      const data = await res.json()
      setInstrumentNames(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addInstrumentName = async (payload: InstrumentNameInsert) => {
    try {
      const res = await fetch('/api/instrument-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add instrument name')
      setInstrumentNames(prev => [data, ...prev])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateInstrumentName = async (id: string, payload: InstrumentNameUpdate) => {
    try {
      const res = await fetch(`/api/instrument-names/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update instrument name')
      setInstrumentNames(prev => prev.map(item => item.id === id ? data : item))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const deleteInstrumentName = async (id: string) => {
    try {
      const res = await fetch(`/api/instrument-names/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete instrument name')
      setInstrumentNames(prev => prev.filter(item => item.id !== id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  useEffect(() => { fetchInstrumentNames() }, [])

  return { instrumentNames, loading, error, addInstrumentName, updateInstrumentName, deleteInstrumentName, refetch: fetchInstrumentNames }
}
