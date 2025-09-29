'use client'

import { useState, useEffect } from 'react'
import { Sensor, SensorInsert, SensorUpdate, SensorName } from '../lib/supabase'

export const useSensors = () => {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all sensors
  const fetchSensors = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/sensors')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Failed to fetch sensors')
      }

      const list = Array.isArray(payload) ? payload : (payload?.data || [])
      setSensors(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Add new sensor
  const addSensor = async (sensorData: SensorInsert) => {
    try {
      setError(null)
      const response = await fetch('/api/sensors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Failed to add sensor')
      }

      const created = (payload && payload.data) ? payload.data : payload
      // Add the new sensor to the list
      setSensors(prev => [created, ...prev])
      return created
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Update sensor
  const updateSensor = async (id: number, sensorData: SensorUpdate) => {
    try {
      setError(null)
      const response = await fetch(`/api/sensors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Failed to update sensor')
      }

      const updated = (payload && payload.data) ? payload.data : payload
      // Update the sensor in the list
      setSensors(prev => 
        prev.map(sensor => 
          sensor.id === id ? updated : sensor
        )
      )
      return updated
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Delete sensor
  const deleteSensor = async (id: number) => {
    try {
      setError(null)
      const response = await fetch(`/api/sensors/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete sensor')
      }

      // Remove the sensor from the list
      setSensors(prev => prev.filter(sensor => sensor.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Load sensors on mount
  useEffect(() => {
    fetchSensors()
  }, [])

  return {
    sensors,
    loading,
    error,
    fetchSensors,
    addSensor,
    updateSensor,
    deleteSensor,
  }
}
