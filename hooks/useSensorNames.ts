'use client'

import { useState, useEffect } from 'react'
import { SensorName, SensorNameInsert } from '@/lib/supabase'

export const useSensorNames = () => {
  const [sensorNames, setSensorNames] = useState<SensorName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all sensor names
  const fetchSensorNames = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/sensor-names')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch sensor names')
      }

      setSensorNames(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Create new sensor name
  const createSensorName = async (data: SensorNameInsert) => {
    try {
      setError(null)
      const response = await fetch('/api/sensor-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create sensor name')
      }

      // Add to local state
      setSensorNames(prev => [result.data, ...prev])
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  // Update sensor name
  const updateSensorName = async (id: string, data: SensorNameInsert) => {
    try {
      setError(null)
      const response = await fetch(`/api/sensor-names/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update sensor name')
      }

      // Update local state
      setSensorNames(prev =>
        prev.map(item => (item.id === id ? result.data : item))
      )
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  // Delete sensor name
  const deleteSensorName = async (id: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/sensor-names/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete sensor name')
      }

      // Remove from local state
      setSensorNames(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchSensorNames()
  }, [])

  return {
    sensorNames,
    loading,
    error,
    fetchSensorNames,
    createSensorName,
    updateSensorName,
    deleteSensorName,
  }
}
