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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

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

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentInstrumentNames = instrumentNames.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(instrumentNames.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Instrument Names</h2>
          <p className="text-gray-600 mt-1">Manage your instrument names and configurations</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  No
                </th>
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
              {currentInstrumentNames.map((instrumentName, index) => (
                <tr key={instrumentName.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-500 text-center">
                      {indexOfFirstItem + index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{instrumentName.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(instrumentName.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {/* Edit Button with Icon */}
                      <button
                        onClick={() => handleOpenModal(instrumentName)}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 group"
                        title="Edit instrument name"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="ml-1 text-sm font-medium">Edit</span>
                      </button>
                      
                      {/* Delete Button with Icon */}
                      <button
                        onClick={() => handleDelete(instrumentName.id)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all duration-200 group"
                        title="Delete instrument name"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="ml-1 text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {instrumentNames.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, instrumentNames.length)}
                </span>{' '}
                of <span className="font-medium">{instrumentNames.length}</span> results
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

        {instrumentNames.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No instrument names</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new instrument name.</p>
            <div className="mt-6">
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Instrument Name
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal dengan ambient light yang lebih kecil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-2xl mx-auto">
            {/* Ambient Light Effect yang lebih kecil */}
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-xl blur-lg -z-10"></div>
            
            {/* Modal Container */}
            <div className="bg-white rounded-xl shadow-2xl relative overflow-hidden">
              {/* Header dengan gradient dan close button */}
              <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {editingInstrumentName ? 'Edit Instrument Name' : 'Add New Instrument Name'}
                    </h3>
                    <p className="text-blue-200 text-sm mt-1">
                      {editingInstrumentName ? 'Update existing instrument name' : 'Create new instrument name'}
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