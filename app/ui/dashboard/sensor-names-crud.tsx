'use client'

import React, { useEffect, useState } from 'react'
import { useSensorNames } from '../../../hooks/useSensorNames'
import { SensorName } from '../../../lib/supabase'
import { useSensors } from '../../../hooks/useSensors'

const SensorNamesCRUD: React.FC = () => {
  const {
    sensorNames,
    loading,
    error,
    createSensorName,
    updateSensorName,
    deleteSensorName,
  } = useSensorNames()

  const { sensors, fetchSensors } = useSensors()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSensor, setEditingSensor] = useState<SensorName | null>(null)
  const [formData, setFormData] = useState({ name: '', selectedSensorId: '' as any })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenModal = (sensor?: SensorName) => {
    if (sensor) {
      setEditingSensor(sensor)
      setFormData({ name: sensor.name, selectedSensorId: '' })
    } else {
      setEditingSensor(null)
      setFormData({ name: '', selectedSensorId: '' })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSensor(null)
    setFormData({ name: '', selectedSensorId: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      setIsSubmitting(true)
      
      if (editingSensor) {
        await updateSensorName(editingSensor.id, { name: formData.name })
      } else {
        await createSensorName({ name: formData.name })
      }
      
      handleCloseModal()
    } catch (error) {
      console.error('Error saving sensor name:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this sensor name?')) {
      try {
        await deleteSensorName(id)
      } catch (error) {
        console.error('Error deleting sensor name:', error)
      }
    }
  }

  // Prefetch sensors and handle Escape key to close modal
  useEffect(() => {
    fetchSensors()
  }, [fetchSensors])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen])

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading sensor names...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sensor Names</h3>
            <p className="text-sm text-gray-600">Manage your sensor names</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Sensor
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sensorNames.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No sensor names found. Create your first one!
                </td>
              </tr>
            ) : (
              sensorNames.map((sensor) => (
                <tr key={sensor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {sensor.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sensor.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sensor.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenModal(sensor)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sensor.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 transform transition-all animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🔧</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {editingSensor ? 'Edit Sensor Name' : 'Add New Sensor Name'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {editingSensor ? 'Update the sensor name details' : 'Enter the details for the new sensor'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Sensor (sumber: tabel sensor)
                  </label>
                  <select
                    value={formData.selectedSensorId}
                    onChange={(e) => {
                      const selected = sensors.find(s => String(s.id) === e.target.value)
                      setFormData({
                        selectedSensorId: e.target.value,
                        name: selected ? selected.name : ''
                      })
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={isSubmitting}
                  >
                    <option value="">-- Pilih Sensor --</option>
                    {sensors.map(s => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} — {s.manufacturer} / {s.type} / SN {s.serial_number}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Memilih sensor akan otomatis mengisi nama di bawah.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sensor Name yang disimpan ke sensor_names <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Nama sensor untuk disimpan di sensor_names"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Tips for naming sensors:</p>
                      <ul className="mt-1 text-xs text-gray-600 space-y-1">
                        <li>• Use descriptive names (e.g., "Temperature Sensor - Room A")</li>
                        <li>• Include location or purpose information</li>
                        <li>• Avoid special characters and keep it concise</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                  disabled={isSubmitting || !formData.name.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>{editingSensor ? 'Update Sensor' : 'Create Sensor'}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorNamesCRUD
