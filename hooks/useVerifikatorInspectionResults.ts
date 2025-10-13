import { useEffect, useState } from 'react'
import { VerifikatorInspectionResult, VerifikatorInspectionResultInsert, VerifikatorInspectionResultUpdate } from '../lib/supabase'

export const useVerifikatorInspectionResults = () => {
  const [items, setItems] = useState<VerifikatorInspectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/verifikator-inspection-results')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch data')
      setItems(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (payload: VerifikatorInspectionResultInsert) => {
    try {
      const res = await fetch('/api/verifikator-inspection-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add record')
      setItems(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateItem = async (id: number, payload: VerifikatorInspectionResultUpdate) => {
    try {
      const res = await fetch(`/api/verifikator-inspection-results/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update record')
      setItems(prev => prev.map(it => it.id === id ? data : it))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const deleteItem = async (id: number) => {
    try {
      const res = await fetch(`/api/verifikator-inspection-results/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete record')
      setItems(prev => prev.filter(it => it.id !== id))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  useEffect(() => { fetchAll() }, [])

  return { items, loading, error, addItem, updateItem, deleteItem, refetch: fetchAll }
}











