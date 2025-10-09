import { useEffect, useState } from 'react'
import { CalibrationResult, CalibrationResultInsert, CalibrationResultUpdate } from '../lib/supabase'

export const useCalibrationResults = () => {
  const [calibrationResults, setCalibrationResults] = useState<CalibrationResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalibrationResults = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/calibration-results')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch calibration results')
      setCalibrationResults(data)
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const addCalibrationResult = async (payload: CalibrationResultInsert) => {
    try {
      const res = await fetch('/api/calibration-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add calibration result')
      setCalibrationResults(prev => [data, ...prev])
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const updateCalibrationResult = async (id: number, payload: CalibrationResultUpdate) => {
    try {
      const res = await fetch(`/api/calibration-results/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update calibration result')
      setCalibrationResults(prev => prev.map(item => item.id === id ? data : item))
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const deleteCalibrationResult = async (id: number) => {
    try {
      const res = await fetch(`/api/calibration-results/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete calibration result')
      setCalibrationResults(prev => prev.filter(item => item.id !== id))
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchCalibrationResults()
  }, [])

  return { 
    calibrationResults, 
    loading, 
    error, 
    addCalibrationResult, 
    updateCalibrationResult, 
    deleteCalibrationResult,
    refetch: fetchCalibrationResults 
  }
}










