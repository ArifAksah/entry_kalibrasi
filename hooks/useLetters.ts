import { useEffect, useState } from 'react'
import { Letter, LetterInsert, LetterUpdate } from '../lib/supabase'

export const useLetters = () => {
  const [items, setItems] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/letters')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch letters')
      setItems(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (payload: LetterInsert) => {
    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add letter')
      setItems(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateItem = async (id: number, payload: LetterUpdate) => {
    try {
      const res = await fetch(`/api/letters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update letter')
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
      const res = await fetch(`/api/letters/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete letter')
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












