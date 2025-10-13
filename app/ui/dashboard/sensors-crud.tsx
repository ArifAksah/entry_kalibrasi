'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSensors } from '../../../hooks/useSensors'
import { usePermissions } from '../../../hooks/usePermissions'
import { Sensor, SensorInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

const SensorsCRUD: React.FC = () => {
  const { sensors, loading, error, addSensor, updateSensor, deleteSensor, fetchSensors } = useSensors()
  const { can, canEndpoint } = usePermissions()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null)
  const [formData, setFormData] = useState<SensorInsert>({
    manufacturer: '',
    type: '',
    serial_number: '',
    range_capacity: '',
    range_capacity_unit: '',
    graduating: '',
    graduating_unit: '',
    funnel_diameter: 0,
    funnel_diameter_unit: '',
    volume_per_tip: '',
    volume_per_tip_unit: '',
    funnel_area: 0,
    funnel_area_unit: '',
    name: '',
    is_standard: false as any
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    // initial server fetch
    fetchSensors({ page: 1, pageSize })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchSensors({ q: debouncedSearch, page: currentPage, pageSize })
  }, [debouncedSearch, currentPage])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sensors
    return sensors.filter(s => `${s.name} ${s.manufacturer} ${s.type} ${s.serial_number}`.toLowerCase().includes(q))
  }, [sensors, search])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered])
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage])

  const handleOpenModal = (sensor?: Sensor) => {
    if (sensor) {
      setEditingSensor(sensor)
      setFormData({
        manufacturer: sensor.manufacturer,
        type: sensor.type,
        serial_number: sensor.serial_number,
        range_capacity: sensor.range_capacity,
        range_capacity_unit: sensor.range_capacity_unit,
        graduating: sensor.graduating,
        graduating_unit: sensor.graduating_unit,
        funnel_diameter: sensor.funnel_diameter,
        funnel_diameter_unit: sensor.funnel_diameter_unit,
        volume_per_tip: sensor.volume_per_tip,
        volume_per_tip_unit: sensor.volume_per_tip_unit,
        funnel_area: sensor.funnel_area,
        funnel_area_unit: sensor.funnel_area_unit,
        name: sensor.name,
        is_standard: (sensor as any).is_standard || false
      })
    } else {
      setEditingSensor(null)
      setFormData({
        manufacturer: '',
        type: '',
        serial_number: '',
        range_capacity: '',
        range_capacity_unit: '',
        graduating: '',
        graduating_unit: '',
        funnel_diameter: 0,
        funnel_diameter_unit: '',
        volume_per_tip: '',
        volume_per_tip_unit: '',
        funnel_area: 0,
        funnel_area_unit: '',
        name: '',
        is_standard: false
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSensor(null)
    setFormData({
      manufacturer: '',
      type: '',
      serial_number: '',
      range_capacity: '',
      range_capacity_unit: '',
      graduating: '',
      graduating_unit: '',
      funnel_diameter: 0,
      funnel_diameter_unit: '',
      volume_per_tip: '',
      volume_per_tip_unit: '',
      funnel_area: 0,
      funnel_area_unit: '',
        name: '',
        is_standard: false
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingSensor) {
        await updateSensor(editingSensor.id, formData)
      } else {
        await addSensor(formData)
      }
      handleCloseModal()
    } catch (error) {
      console.error('Error saving sensor:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this sensor?')) {
      try {
        await deleteSensor(id)
      } catch (error) {
        console.error('Error deleting sensor:', error)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any
    const numericFields = new Set(['funnel_diameter', 'funnel_area'])
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (numericFields.has(name) ? (parseFloat(value) || 0) : value)
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading sensors...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Manager' }]} />
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Search sensors..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {can('sensor','create') && (
            <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
          )}
        </div>
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Name', 'Manufacturer', 'Type', 'Serial Number', 'Range Capacity', 'Standard?', 'Actions' ]}>
          {paged.map((sensor) => (
            <tr key={sensor.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.name || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.manufacturer}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.type}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.serial_number}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.range_capacity} {sensor.range_capacity_unit}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(sensor as any).is_standard ? 'Yes' : 'No'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                {can('sensor','update') && canEndpoint('PUT', `/api/sensors/${sensor.id}`) && (
                  <button onClick={() => handleOpenModal(sensor)} className="text-blue-600 hover:text-blue-900">Edit</button>
                )}
                {can('sensor','delete') && canEndpoint('DELETE', `/api/sensors/${sensor.id}`) && (
                  <button onClick={() => handleDelete(sensor.id)} className="text-red-600 hover:text-red-900">Delete</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span></div>
          <div className="inline-flex items-center gap-2">
            <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(1)}>First</button>
            <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>Prev</button>
            <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}>Next</button>
            <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(totalPages)}>Last</button>
          </div>
        </div>
      </Card>

      {/* Modal */}
      {isModalOpen && can('sensor', editingSensor ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <Card title={editingSensor ? 'Edit Sensor' : 'Add New Sensor'}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Basic Information
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sensor Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter sensor name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Manufacturer *
                    </label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Manufacturer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type *
                    </label>
                    <input
                      type="text"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Sensor type"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serial Number *
                    </label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Serial number"
                    />
                  </div>
                </div>

                {/* Range & Capacity */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Range & Capacity
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Range Capacity
                    </label>
                    <input
                      type="text"
                      name="range_capacity"
                      value={formData.range_capacity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Range capacity"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Range Capacity Unit
                    </label>
                    <select
                      name="range_capacity_unit"
                      value={formData.range_capacity_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select unit</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Graduating
                    </label>
                    <input
                      type="text"
                      name="graduating"
                      value={formData.graduating}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Graduating value"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Graduating Unit
                    </label>
                    <select
                      name="graduating_unit"
                      value={formData.graduating_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select unit</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>

                {/* Funnel Specifications */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Funnel Specifications
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Funnel Diameter
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="funnel_diameter"
                      value={formData.funnel_diameter}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Funnel Diameter Unit
                    </label>
                    <select
                      name="funnel_diameter_unit"
                      value={formData.funnel_diameter_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select unit</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Funnel Area
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="funnel_area"
                      value={formData.funnel_area}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Funnel Area Unit
                    </label>
                    <select
                      name="funnel_area_unit"
                      value={formData.funnel_area_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select unit</option>
                      <option value="mm²">mm²</option>
                      <option value="cm²">cm²</option>
                      <option value="m²">m²</option>
                    </select>
                  </div>
                </div>

                {/* Volume Specifications */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Volume Specifications
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Volume Per Tip
                    </label>
                    <input
                      type="text"
                      name="volume_per_tip"
                      value={formData.volume_per_tip}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Volume per tip"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Volume Per Tip Unit
                    </label>
                    <select
                      name="volume_per_tip_unit"
                      value={formData.volume_per_tip_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select unit</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="μl">μl</option>
                    </select>
                  </div>
                </div>

                {/* Flags */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Flags
                  </h4>
                  <div className="flex items-center gap-3">
                    <input id="is_standard" type="checkbox" name="is_standard" checked={(formData as any).is_standard} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <label htmlFor="is_standard" className="text-sm text-gray-700">Instrumen Standar?</label>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg"
                >
                  {isSubmitting ? 'Saving...' : editingSensor ? 'Update Sensor' : 'Add Sensor'}
                </button>
              </div>
            </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorsCRUD
