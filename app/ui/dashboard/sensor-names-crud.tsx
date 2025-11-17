'use client'

import React, { useState } from 'react'
import { useSensors } from '../../../hooks/useSensors'
import { usePermissions } from '../../../hooks/usePermissions'
import { Sensor, SensorInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

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
        <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Manager' }]} />
        {can('sensor','create') && (
          <button 
            onClick={() => handleOpenModal()} 
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
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
          <Table headers={['Name', 'Manufacturer', 'Type', 'Serial Number', 'Range Capacity', 'Standard?', 'Actions']}>
            {currentSensors.map((sensor) => (
              <tr key={sensor.id} className="hover:bg-gray-50 transition-colors duration-150">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {can('sensor','update') && canEndpoint('PUT', `/api/sensors/${sensor.id}`) && (
                    <EditButton onClick={() => handleOpenModal(sensor)} title="Edit Sensor" />
                  )}
                  {can('sensor','delete') && canEndpoint('DELETE', `/api/sensors/${sensor.id}`) && (
                    <DeleteButton onClick={() => handleDelete(sensor.id)} title="Delete Sensor" />
                  )}
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
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-1 text-sm border rounded-md transition-colors ${
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
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal dengan 3 kolom */}
      {isModalOpen && can('sensor', editingSensor ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Ambient Light Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 rounded-2xl blur-xl -z-10"></div>
            
            <Card 
              title={
                <div className="bg-gradient-to-r from-slate-800 to-blue-900 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
                  <h3 className="text-xl font-semibold text-white">
                    {editingSensor ? 'Edit Sensor' : 'Add New Sensor'}
                  </h3>
                  <p className="text-blue-200 text-sm mt-1">
                    {editingSensor ? 'Update existing sensor information' : 'Create a new sensor entry'}
                  </p>
                </div>
              }
              className="relative overflow-hidden shadow-2xl border-0"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Kolom 1: Basic Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Basic Information
                    </h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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

                  {/* Kolom 2: Range & Capacity */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Range & Capacity
                    </h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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

                  {/* Kolom 3: Funnel & Volume */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Funnel & Volume
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Diameter Unit
                        </label>
                        <select
                          name="funnel_diameter_unit"
                          value={formData.funnel_diameter_unit}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        >
                          <option value="">Unit</option>
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="m">m</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Area Unit
                        </label>
                        <select
                          name="funnel_area_unit"
                          value={formData.funnel_area_unit}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        >
                          <option value="">Unit</option>
                          <option value="mm²">mm²</option>
                          <option value="cm²">cm²</option>
                          <option value="m²">m²</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Volume Unit
                        </label>
                        <select
                          name="volume_per_tip_unit"
                          value={formData.volume_per_tip_unit}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        >
                          <option value="">Unit</option>
                          <option value="ml">ml</option>
                          <option value="l">l</option>
                          <option value="μl">μl</option>
                        </select>
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="pt-4">
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
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorsCRUD