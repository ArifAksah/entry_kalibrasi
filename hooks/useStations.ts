import { useEffect, useState, useCallback } from 'react'
import { Station, StationInsert, StationUpdate } from '../lib/supabase'
import { supabase } from '../lib/supabase'

export const useStations = () => {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStations = useCallback(async (opts?: { q?: string; page?: number; pageSize?: number; userId?: string }) => {
    try {
      setLoading(true)

      // If no search query and no userId, use the all endpoint
      if (!opts?.q && !opts?.userId) {
        const res = await fetch('/api/stations/all')
        if (!res.ok) throw new Error('Failed to fetch all stations')
        const data = await res.json()
        setStations(Array.isArray(data) ? data : [])
        setError(null)
        return { data: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0, page: 1, pageSize: Array.isArray(data) ? data.length : 0, totalPages: 1 }
      }

      // For search or user filter, use the regular paginated endpoint
      const params = new URLSearchParams()
      if (opts?.q) params.set('q', opts.q)
      if (opts?.page) params.set('page', String(opts.page))
      if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))
      if (opts?.userId) params.set('user_id', opts.userId)
      const qs = params.toString()
      const res = await fetch(`/api/stations${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch stations')
      const payload = await res.json()
      const data = Array.isArray(payload) ? payload : (payload?.data ?? [])
      setStations(data)
      setError(null)
      return payload
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
      return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }
    } finally {
      setLoading(false)
    }
  }, [])

  const addStation = useCallback(async (payload: StationInsert) => {
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
  }, [])

  const updateStation = useCallback(async (id: number, payload: StationUpdate) => {
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
  }, [])

  const deleteStation = useCallback(async (id: number) => {
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
  }, [])



  return { stations, loading, error, addStation, updateStation, deleteStation, refetch: fetchStations, fetchStations }
}
