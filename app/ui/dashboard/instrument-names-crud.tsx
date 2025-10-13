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
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm"
        >
          Add New
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
                      className="text-blue-600 hover:text-blue-900 transition-colors duration-200 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(instrumentName.id)}
                      className="text-red-600 hover:text-red-900 transition-colors duration-200 font-medium"
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

      {/* Modal dengan ambient light yang lebih kecil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-2xl mx-auto">
            {/* Ambient Light Effect yang lebih kecil */}
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-xl blur-lg -z-10"></div>
            
            {/* Modal Container */}
            <div className="bg-white rounded-xl shadow-2xl relative overflow-hidden">
              {/* Header dengan gradient */}
              <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4">
                <h3 className="text-xl font-semibold text-white">
                  {editingInstrumentName ? 'Edit Instrument Name' : 'Add New Instrument Name'}
                </h3>
                <p className="text-blue-200 text-sm mt-1">
                  {editingInstrumentName ? 'Update existing instrument name' : 'Create new instrument name'}
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Instrument (tabel instrument)
                  </label>
                  <select
                    value={formData.selectedInstrumentId}
                    onChange={(e) => {
                      const selected = instruments.find(i => String(i.id) === e.target.value)
                      setFormData({
                        selectedInstrumentId: e.target.value,
                        name: selected ? selected.name : formData.name
                      })
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">-- Pilih Instrument --</option>
                    {instruments.map(i => (
                      <option key={i.id} value={String(i.id)}>
                        {i.name} — {i.manufacturer} / {i.type} / SN {i.serial_number}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">
                    Memilih instrument akan otomatis mengisi nama di bawah.
                  </p>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nama yang disimpan ke instrument_names
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Masukkan nama instrument untuk disimpan"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.name.trim()}
                    className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 hover:shadow-md"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : editingInstrumentName ? 'Update' : 'Create'}
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

export default InstrumentNamesCRUD