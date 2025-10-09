import { useEffect, useState } from 'react'
import { VerifikatorCalResult, VerifikatorCalResultInsert, VerifikatorCalResultUpdate } from '../lib/supabase'

export const useVerifikatorCalResults = () => {
  const [items, setItems] = useState<VerifikatorCalResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/verifikator-cal-result')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch verifikator records')
      setItems(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (payload: VerifikatorCalResultInsert) => {
    try {
      const res = await fetch('/api/verifikator-cal-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add verifikator record')
      setItems(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateItem = async (id: number, payload: VerifikatorCalResultUpdate) => {
    try {
      const res = await fetch(`/api/verifikator-cal-result/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update verifikator record')
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
      const res = await fetch(`/api/verifikator-cal-result/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete verifikator record')
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












