'use client'

import React, { useEffect, useState } from 'react'
import { useInstrumentNames } from '../../../hooks/useInstrumentNames'
import { InstrumentName, InstrumentNameInsert } from '../../../lib/supabase'
import { useInstruments } from '../../../hooks/useInstruments'

const InstrumentNamesCRUD: React.FC = () => {
  const {
    instrumentNames,
    loading,
    error,
    addInstrumentName,
    updateInstrumentName,
    deleteInstrumentName,
  } = useInstrumentNames()

  const { instruments, refetch } = useInstruments()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInstrumentName, setEditingInstrumentName] = useState<InstrumentName | null>(null)
  const [formData, setFormData] = useState<{ name: string; selectedInstrumentId: string | '' }>({ name: '', selectedInstrumentId: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenModal = (instrumentName?: InstrumentName) => {
    if (instrumentName) {
      setEditingInstrumentName(instrumentName)
      setFormData({ name: instrumentName.name, selectedInstrumentId: '' })
    } else {
      setEditingInstrumentName(null)
      setFormData({ name: '', selectedInstrumentId: '' })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingInstrumentName(null)
    setFormData({ name: '', selectedInstrumentId: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      if (editingInstrumentName) {
        await updateInstrumentName(editingInstrumentName.id, { name: formData.name })
      } else {
        await addInstrumentName({ name: formData.name })
      }
      handleCloseModal()
    } catch (error) {
      console.error('Error saving instrument name:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this instrument name?')) {
      try {
        await deleteInstrumentName(id)
      } catch (error) {
        console.error('Error deleting instrument name:', error)
      }
    }
  }

  useEffect(() => { refetch() }, [refetch])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Instrument Names</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          Add New Instrument Name
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {instrumentNames.map((instrumentName) => (
                <tr key={instrumentName.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {instrumentName.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(instrumentName.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleOpenModal(instrumentName)}
                      className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(instrumentName.id)}
                      className="text-red-600 hover:text-red-900 transition-colors duration-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingInstrumentName ? 'Edit Instrument Name' : 'Add New Instrument Name'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Instrument (tabel instrument)</label>
                <select
                  value={formData.selectedInstrumentId}
                  onChange={(e) => {
                    const selected = instruments.find(i => String(i.id) === e.target.value)
                    setFormData({
                      selectedInstrumentId: e.target.value,
                      name: selected ? selected.name : ''
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Instrument --</option>
                  {instruments.map(i => (
                    <option key={i.id} value={String(i.id)}>
                      {i.name} — {i.manufacturer} / {i.type} / SN {i.serial_number}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Memilih instrument akan otomatis mengisi nama di bawah.</p>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama yang disimpan ke instrument_names
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masukkan nama instrument untuk disimpan"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
                >
                  {isSubmitting ? 'Saving...' : editingInstrumentName ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default InstrumentNamesCRUD
