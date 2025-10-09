'use client'

import React, { useState } from 'react'
import { useSensors } from '../../../hooks/useSensors'
import { usePermissions } from '../../../hooks/usePermissions'
import { Sensor, SensorInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

const SensorsCRUD: React.FC = () => {
  const { sensors, loading, error, addSensor, updateSensor, deleteSensor } = useSensors()
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

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

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentSensors = sensors.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sensors.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

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
        <div>
          <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Manager' }]} />
          <p className="text-gray-600 mt-1">Manage your sensors and configurations</p>
        </div>
        {can('sensor','create') && (
          <button 
            onClick={() => handleOpenModal()} 
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Sensor
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table headers={['No', 'Name', 'Manufacturer', 'Type', 'Serial Number', 'Range Capacity', 'Standard?', 'Actions']}>
            {currentSensors.map((sensor, index) => (
              <tr key={sensor.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-500 text-center">
                    {indexOfFirstItem + index + 1}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {sensor.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sensor.manufacturer}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sensor.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sensor.serial_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sensor.range_capacity} {sensor.range_capacity_unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    (sensor as any).is_standard 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {(sensor as any).is_standard ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    {can('sensor','update') && canEndpoint('PUT', `/api/sensors/${sensor.id}`) && (
                      <button 
                        onClick={() => handleOpenModal(sensor)} 
                        className="inline-flex items-center px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 group"
                        title="Edit sensor"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="ml-1 text-sm font-medium">Edit</span>
                      </button>
                    )}
                    {can('sensor','delete') && canEndpoint('DELETE', `/api/sensors/${sensor.id}`) && (
                      <button 
                        onClick={() => handleDelete(sensor.id)} 
                        className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all duration-200 group"
                        title="Delete sensor"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="ml-1 text-sm font-medium">Delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Pagination */}
        {sensors.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, sensors.length)}
                </span>{' '}
                of <span className="font-medium">{sensors.length}</span> results
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-1 text-sm border rounded-md transition-colors duration-200 ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {sensors.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No sensors</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new sensor.</p>
            <div className="mt-6">
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Sensor
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal dengan ambient light effect */}
      {isModalOpen && can('sensor', editingSensor ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Ambient Light Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 rounded-2xl blur-xl -z-10"></div>
            
            <Card className="relative overflow-hidden shadow-2xl border-0 p-0">
              {/* Header dengan gradient dan close button */}
              <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {editingSensor ? 'Edit Sensor' : 'Add New Sensor'}
                    </h3>
                    <p className="text-blue-200 text-sm mt-1">
                      {editingSensor ? 'Update existing sensor information' : 'Create a new sensor entry'}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white hover:text-white transition-all duration-200 group"
                    aria-label="Close modal"
                  >
                    <svg 
                      className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M6 18L18 6M6 6l12 12" 
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <input 
                          id="is_standard" 
                          type="checkbox" 
                          name="is_standard" 
                          checked={(formData as any).is_standard} 
                          onChange={handleInputChange} 
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                        />
                        <label htmlFor="is_standard" className="text-sm font-medium text-gray-700">
                          Standard Instrument?
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {isSubmitting ? 'Saving...' : editingSensor ? 'Update Sensor' : 'Add Sensor'}
                    </button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorsCRUD