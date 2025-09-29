import { useEffect, useState } from 'react'
import { Station, StationInsert, StationUpdate } from '../lib/supabase'
import { supabase } from '../lib/supabase'

export const useStations = () => {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStations = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/stations')
      if (!res.ok) throw new Error('Failed to fetch stations')
      const data = await res.json()
      setStations(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const addStation = async (payload: StationInsert) => {
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const res = await fetch('/api/stations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add station')
      setStations(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateStation = async (id: number, payload: StationUpdate) => {
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const res = await fetch(`/api/stations/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update station')
      setStations(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  const deleteStation = async (id: number) => {
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const res = await fetch(`/api/stations/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete station')
      setStations(prev => prev.filter(item => item.id !== id))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      throw new Error(msg)
    }
  }

  useEffect(() => { fetchStations() }, [])

  return { stations, loading, error, addStation, updateStation, deleteStation, refetch: fetchStations }
}
