'use client'

import React, { useState } from 'react'
import { useSensors } from '../../../hooks/useSensors'
import { usePermissions } from '../../../hooks/usePermissions'
import { Sensor, SensorInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

// SVG Icons untuk tampilan yang lebih elegan
const EditIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const PlusIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const CloseIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const SensorIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

// Komponen Background Batik Elegan
const BatikBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full opacity-5">
      <div className="absolute top-4 left-4 w-32 h-32 border-2 border-[#1e377c] rounded-full"></div>
      <div className="absolute top-4 right-4 w-24 h-24 border border-[#1e377c] rotate-45"></div>
      <div className="absolute bottom-4 left-4 w-20 h-20 border border-[#1e377c] rounded-full"></div>
      <div className="absolute bottom-4 right-4 w-28 h-28 border-2 border-[#1e377c] rotate-12"></div>
    </div>
    <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
    <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
  </div>
)

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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e377c]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Header dengan background putih dan aksen biru elegan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 relative overflow-hidden">
        <BatikBackground />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Manager' }]} />
            <p className="text-gray-600 text-sm mt-1">Manage your sensors and configurations</p>
          </div>
          {can('sensor','create') && (
            <button 
              onClick={() => handleOpenModal()} 
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] text-white rounded-lg hover:from-[#2a4a9d] hover:to-[#1e377c] transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="font-semibold">Add New Sensor</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabel dengan card elegan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Manufacturer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Serial Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Range Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Standard?</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentSensors.map((sensor, index) => (
                <tr key={sensor.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                  <td className="px-4 py-3 text-sm text-center text-gray-500">
                    {indexOfFirstItem + index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {sensor.name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{sensor.manufacturer}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{sensor.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{sensor.serial_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {sensor.range_capacity} {sensor.range_capacity_unit}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      (sensor as any).is_standard 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {(sensor as any).is_standard ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium space-x-1">
                    {can('sensor','update') && canEndpoint('PUT', `/api/sensors/${sensor.id}`) && (
                      <button 
                        onClick={() => handleOpenModal(sensor)} 
                        className="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                        title="Edit Sensor"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    )}
                    {can('sensor','delete') && canEndpoint('DELETE', `/api/sensors/${sensor.id}`) && (
                      <button 
                        onClick={() => handleDelete(sensor.id)} 
                        className="inline-flex items-center p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
                        title="Delete Sensor"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination dengan desain elegan */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="text-xs text-gray-600">
              Showing <span className="font-semibold">{indexOfFirstItem + 1}</span> to <span className="font-semibold">{Math.min(indexOfLastItem, sensors.length)}</span> of <span className="font-semibold">{sensors.length}</span> entries
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-gray-400 transition-all duration-200"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => paginate(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    currentPage === page
                      ? 'bg-[#1e377c] text-white shadow-md'
                      : 'border border-gray-300 text-gray-700 hover:bg-white hover:border-gray-400'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-gray-400 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {sensors.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <SensorIcon className="w-12 h-12" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">No sensors</h3>
            <p className="text-sm text-gray-500 mt-1">Get started by creating a new sensor.</p>
            <div className="mt-6">
              {can('sensor','create') && (
                <button
                  onClick={() => handleOpenModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] rounded-lg hover:from-[#2a4a9d] hover:to-[#1e377c] transition-all duration-200 shadow hover:shadow-lg"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Sensor
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal dengan desain elegan */}
      {isModalOpen && can('sensor', editingSensor ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal dengan gradient elegan */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <SensorIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingSensor ? 'Edit Sensor' : 'Create New Sensor'}
                    </h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      {editingSensor ? 'Update existing sensor information' : 'Fill in the sensor information below'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="max-h-[70vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Information - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Basic Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Sensor Name *', name: 'name', value: formData.name, type: 'text', required: true, placeholder: 'Enter sensor name' },
                      { label: 'Manufacturer *', name: 'manufacturer', value: formData.manufacturer, type: 'text', required: true, placeholder: 'Manufacturer name' },
                      { label: 'Type *', name: 'type', value: formData.type, type: 'text', required: true, placeholder: 'Sensor type' },
                      { label: 'Serial Number *', name: 'serial_number', value: formData.serial_number, type: 'text', required: true, placeholder: 'Serial number' },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        <input
                          required={field.required}
                          type={field.type}
                          name={field.name}
                          value={field.value}
                          onChange={handleInputChange}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Range & Capacity - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Range & Capacity</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Range Capacity', name: 'range_capacity', value: formData.range_capacity, type: 'text', placeholder: 'Range capacity' },
                      { 
                        label: 'Range Capacity Unit', 
                        name: 'range_capacity_unit', 
                        value: formData.range_capacity_unit, 
                        type: 'select',
                        options: [
                          { value: '', label: 'Select unit' },
                          { value: 'ml', label: 'ml' },
                          { value: 'l', label: 'l' },
                          { value: 'g', label: 'g' },
                          { value: 'kg', label: 'kg' },
                          { value: 'mm', label: 'mm' },
                          { value: 'cm', label: 'cm' },
                          { value: 'm', label: 'm' }
                        ]
                      },
                      { label: 'Graduating', name: 'graduating', value: formData.graduating, type: 'text', placeholder: 'Graduating value' },
                      { 
                        label: 'Graduating Unit', 
                        name: 'graduating_unit', 
                        value: formData.graduating_unit, 
                        type: 'select',
                        options: [
                          { value: '', label: 'Select unit' },
                          { value: 'ml', label: 'ml' },
                          { value: 'l', label: 'l' },
                          { value: 'g', label: 'g' },
                          { value: 'kg', label: 'kg' },
                          { value: 'mm', label: 'mm' },
                          { value: 'cm', label: 'cm' },
                          { value: 'm', label: 'm' }
                        ]
                      },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          >
                            {field.options?.map((option, optIndex) => (
                              <option key={optIndex} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Funnel Specifications - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Funnel Specifications</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Funnel Diameter', name: 'funnel_diameter', value: formData.funnel_diameter, type: 'number', step: "0.01", placeholder: '0.00' },
                      { 
                        label: 'Funnel Diameter Unit', 
                        name: 'funnel_diameter_unit', 
                        value: formData.funnel_diameter_unit, 
                        type: 'select',
                        options: [
                          { value: '', label: 'Select unit' },
                          { value: 'mm', label: 'mm' },
                          { value: 'cm', label: 'cm' },
                          { value: 'm', label: 'm' }
                        ]
                      },
                      { label: 'Funnel Area', name: 'funnel_area', value: formData.funnel_area, type: 'number', step: "0.01", placeholder: '0.00' },
                      { 
                        label: 'Funnel Area Unit', 
                        name: 'funnel_area_unit', 
                        value: formData.funnel_area_unit, 
                        type: 'select',
                        options: [
                          { value: '', label: 'Select unit' },
                          { value: 'mm²', label: 'mm²' },
                          { value: 'cm²', label: 'cm²' },
                          { value: 'm²', label: 'm²' }
                        ]
                      },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          >
                            {field.options?.map((option, optIndex) => (
                              <option key={optIndex} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            step={field.step}
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Volume Specifications - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Volume Specifications</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Volume Per Tip', name: 'volume_per_tip', value: formData.volume_per_tip, type: 'text', placeholder: 'Volume per tip' },
                      { 
                        label: 'Volume Per Tip Unit', 
                        name: 'volume_per_tip_unit', 
                        value: formData.volume_per_tip_unit, 
                        type: 'select',
                        options: [
                          { value: '', label: 'Select unit' },
                          { value: 'ml', label: 'ml' },
                          { value: 'l', label: 'l' },
                          { value: 'μl', label: 'μl' }
                        ]
                      },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          >
                            {field.options?.map((option, optIndex) => (
                              <option key={optIndex} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            name={field.name}
                            value={field.value}
                            onChange={handleInputChange}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Flags</h3>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <input 
                      id="is_standard" 
                      type="checkbox" 
                      name="is_standard" 
                      checked={(formData as any).is_standard} 
                      onChange={handleInputChange} 
                      className="h-4 w-4 text-[#1e377c] border-gray-300 rounded focus:ring-[#1e377c]" 
                    />
                    <label htmlFor="is_standard" className="text-sm font-semibold text-gray-700">
                      Standard Instrument?
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button 
                    type="button" 
                    onClick={handleCloseModal} 
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg transition-all duration-200 shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : editingSensor ? 'Update Sensor' : 'Create Sensor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorsCRUD