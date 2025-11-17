'use client'

import React, { useState, useEffect } from 'react'
import { useCalibrationResults } from '../../../hooks/useCalibrationResults'
import { CalibrationResult, CalibrationResultInsert, Sensor, Note } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

const CalibrationResultsCRUD: React.FC = () => {
  const { calibrationResults, loading, error, addCalibrationResult, updateCalibrationResult, deleteCalibrationResult } = useCalibrationResults()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalibrationResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [sensorMap, setSensorMap] = useState<Record<number, string>>({})
  const [notesMap, setNotesMap] = useState<Record<number, string>>({})
  const [form, setForm] = useState<CalibrationResultInsert>({
    calibration_date_start: '',
    calibration_date_end: '',
    calibration_place: '',
    environment: null,
    table_result: null,
    sensor: null,
    notes: null,
  })

  // Dynamic form fields for JSON data
  const [environmentFields, setEnvironmentFields] = useState<Array<{key: string, value: string}>>([])
  const [tableResultFields, setTableResultFields] = useState<Array<{key: string, value: string}>>([])

  // Helper functions for dynamic fields
  const addEnvironmentField = () => {
    setEnvironmentFields([...environmentFields, { key: '', value: '' }])
  }

  const removeEnvironmentField = (index: number) => {
    setEnvironmentFields(environmentFields.filter((_, i) => i !== index))
  }

  const updateEnvironmentField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...environmentFields]
    updated[index] = { ...updated[index], [field]: value }
    setEnvironmentFields(updated)
  }

  const addTableResultField = () => {
    setTableResultFields([...tableResultFields, { key: '', value: '' }])
  }

  const removeTableResultField = (index: number) => {
    setTableResultFields(tableResultFields.filter((_, i) => i !== index))
  }

  const updateTableResultField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...tableResultFields]
    updated[index] = { ...updated[index], [field]: value }
    setTableResultFields(updated)
  }

  // Convert dynamic fields to JSON
  const fieldsToJson = (fields: Array<{key: string, value: string}>) => {
    const json: Record<string, string> = {}
    fields.forEach(field => {
      if (field.key.trim()) {
        json[field.key.trim()] = field.value.trim()
      }
    })
    return Object.keys(json).length > 0 ? json : null
  }

  // Convert JSON to dynamic fields
  const jsonToFields = (json: any): Array<{key: string, value: string}> => {
    if (!json || typeof json !== 'object') return []
    return Object.entries(json).map(([key, value]) => ({
      key: key,
      value: String(value)
    }))
  }

  // Fetch sensors and notes for dropdowns
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const res = await fetch('/api/sensors')
        if (res.ok) {
          const data = await res.json()
          // Check if data is an array before using forEach
          if (Array.isArray(data)) {
            setSensors(data)
            const map: Record<number, string> = {}
            data.forEach((s: Sensor) => {
              map[s.id] = `${s.name} - ${s.type} (${s.serial_number})`
            })
            setSensorMap(map)
          } else {
            console.error('Sensors API returned non-array data:', data)
            setSensors([])
          }
        } else {
          console.error('Failed to fetch sensors:', res.status, res.statusText)
          setSensors([])
        }
      } catch (e) {
        console.error('Failed to fetch sensors:', e)
        setSensors([])
      }
    }

    const fetchNotes = async () => {
      try {
        const res = await fetch('/api/notes')
        if (res.ok) {
          const data = await res.json()
          // Check if data is an array before using forEach
          if (Array.isArray(data)) {
            setNotes(data)
            const map: Record<number, string> = {}
            data.forEach((n: Note) => {
              map[n.id] = `ID: ${n.id} - ${n.traceable_to_si_through || 'No description'}`
            })
            setNotesMap(map)
          } else {
            console.error('Notes API returned non-array data:', data)
            setNotes([])
          }
        } else {
          console.error('Failed to fetch notes:', res.status, res.statusText)
          setNotes([])
        }
      } catch (e) {
        console.error('Failed to fetch notes:', e)
        setNotes([])
      }
    }

    fetchSensors()
    fetchNotes()
  }, [])

  const openModal = (item?: CalibrationResult) => {
    if (item) {
      setEditing(item)
      setForm({
        calibration_date_start: item.calibration_date_start,
        calibration_date_end: item.calibration_date_end,
        calibration_place: item.calibration_place,
        environment: item.environment,
        table_result: item.table_result,
        sensor: item.sensor,
        notes: item.notes,
      })
      // Initialize dynamic fields from existing JSON data
      setEnvironmentFields(jsonToFields(item.environment))
      setTableResultFields(jsonToFields(item.table_result))
    } else {
      setEditing(null)
      setForm({
        calibration_date_start: '',
        calibration_date_end: '',
        calibration_place: '',
        environment: null,
        table_result: null,
        sensor: null,
        notes: null,
      })
      // Initialize empty dynamic fields
      setEnvironmentFields([])
      setTableResultFields([])
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.calibration_date_start || !form.calibration_date_end || !form.calibration_place) return

    setIsSubmitting(true)
    try {
      // Convert dynamic fields to JSON
      const formData = {
        ...form,
        environment: fieldsToJson(environmentFields),
        table_result: fieldsToJson(tableResultFields)
      }

      if (editing) {
        await updateCalibrationResult(editing.id, formData)
      } else {
        await addCalibrationResult(formData)
      }
      closeModal()
    } catch (e) {
      // handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this calibration result?')) return
    try { await deleteCalibrationResult(id) } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calibration results...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Calibration', href: '#' }, { label: 'Results' }]} />
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Start Date', 'End Date', 'Place', 'Sensor', 'Notes', 'Actions' ]}>
          {calibrationResults.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(item.calibration_date_start).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(item.calibration_date_end).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{item.calibration_place}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sensor ? sensorMap[item.sensor] || `Sensor ID: ${item.sensor}` : 'None'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.notes ? notesMap[item.notes] || `Notes ID: ${item.notes}` : 'None'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <EditButton onClick={() => openModal(item)} title="Edit Calibration Result" />
                <DeleteButton onClick={() => handleDelete(item.id)} title="Delete Calibration Result" />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <Card title={editing ? 'Edit Calibration Result' : 'Add New Calibration Result'}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  required
                  type="date"
                  value={form.calibration_date_start}
                  onChange={e => setForm({ ...form, calibration_date_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  required
                  type="date"
                  value={form.calibration_date_end}
                  onChange={e => setForm({ ...form, calibration_date_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Calibration Place</label>
                <input
                  required
                  value={form.calibration_place}
                  onChange={e => setForm({ ...form, calibration_place: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter calibration place"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
                <select
                  value={form.sensor || ''}
                  onChange={e => setForm({ ...form, sensor: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a sensor</option>
                  {sensors.map(sensor => (
                    <option key={sensor.id} value={sensor.id}>
                      {sensor.name} - {sensor.type} ({sensor.serial_number})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <select
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select notes</option>
                  {notes.map(note => (
                    <option key={note.id} value={note.id}>
                      ID: {note.id} - {note.traceable_to_si_through || 'No description'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Environment Data</label>
                  <button
                    type="button"
                    onClick={addEnvironmentField}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {environmentFields.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No environment fields added. Click "Add Field" to start.</p>
                  ) : (
                    environmentFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Key (e.g., U.95)"
                          value={field.key}
                          onChange={e => updateEnvironmentField(index, 'key', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="text-gray-500">:</span>
                        <input
                          type="text"
                          placeholder="Value (e.g., 0.4)"
                          value={field.value}
                          onChange={e => updateEnvironmentField(index, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeEnvironmentField(index)}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Add key-value pairs for environment data. Example: U.95 = 0.4, koreksi = 0.2C</p>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Table Result Data</label>
                  <button
                    type="button"
                    onClick={addTableResultField}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {tableResultFields.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No table result fields added. Click "Add Field" to start.</p>
                  ) : (
                    tableResultFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Key (e.g., measurement_1)"
                          value={field.key}
                          onChange={e => updateTableResultField(index, 'key', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="text-gray-500">:</span>
                        <input
                          type="text"
                          placeholder="Value (e.g., 25.5)"
                          value={field.value}
                          onChange={e => updateTableResultField(index, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeTableResultField(index)}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Add key-value pairs for table result data. Example: measurement_1 = 25.5, measurement_2 = 26.1</p>
              </div>
              <div className="sm:col-span-2 flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}
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

export default CalibrationResultsCRUD
