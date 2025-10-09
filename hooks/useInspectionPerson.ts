import { useEffect, useState } from 'react'
import { InspectionPerson, InspectionPersonInsert, InspectionPersonUpdate } from '../lib/supabase'

export const useInspectionPerson = () => {
  const [items, setItems] = useState<InspectionPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inspection-person')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inspection_person')
      setItems(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (payload: InspectionPersonInsert) => {
    try {
      const res = await fetch('/api/inspection-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      setItems(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateItem = async (id: number, payload: InspectionPersonUpdate) => {
    try {
      const res = await fetch(`/api/inspection-person/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
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
      const res = await fetch(`/api/inspection-person/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
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












