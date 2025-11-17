'use client'

import React, { useState } from 'react'
import { useNotes } from '../../../hooks/useNotes'
import { Note, NoteInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

const NotesCRUD: React.FC = () => {
  const { notes, loading, error, addNote, updateNote, deleteNote } = useNotes()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [formData, setFormData] = useState<NoteInsert>({
    traceable_to_si_through: '',
    reference_document: '',
    calibration_methode: '',
    others: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenModal = (note?: Note) => {
    if (note) {
      setEditingNote(note)
      setFormData({
        traceable_to_si_through: note.traceable_to_si_through || '',
        reference_document: note.reference_document || '',
        calibration_methode: note.calibration_methode || '',
        others: note.others || ''
      })
    } else {
      setEditingNote(null)
      setFormData({
        traceable_to_si_through: '',
        reference_document: '',
        calibration_methode: '',
        others: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingNote(null)
    setFormData({
      traceable_to_si_through: '',
      reference_document: '',
      calibration_methode: '',
      others: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingNote) {
        await updateNote(editingNote.id, formData)
      } else {
        await addNote(formData)
      }
      handleCloseModal()
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(id)
      } catch (error) {
        console.error('Error deleting note:', error)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading notes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Notes' }]} />
        <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Traceable to SI Through', 'Reference Document', 'Calibration Method', 'Others', 'Created At', 'Actions' ]}>
          {notes.map((note) => (
            <tr key={note.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{note.traceable_to_si_through || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{note.reference_document || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{note.calibration_methode || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{note.others || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(note.created_at).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <EditButton onClick={() => handleOpenModal(note)} title="Edit Note" />
                <DeleteButton onClick={() => handleDelete(note.id)} title="Delete Note" />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <Card title={editingNote ? 'Edit Note' : 'Add New Note'}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Traceable to SI Through
                  </label>
                  <input
                    type="text"
                    name="traceable_to_si_through"
                    value={formData.traceable_to_si_through ?? ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter traceable to SI through information"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Document
                  </label>
                  <input
                    type="text"
                    name="reference_document"
                    value={formData.reference_document ?? ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter reference document"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calibration Method
                  </label>
                  <input
                    type="text"
                    name="calibration_methode"
                    value={formData.calibration_methode ?? ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter calibration method"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Others
                  </label>
                  <textarea
                    name="others"
                    value={formData.others ?? ''}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter additional notes"
                  />
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
                  {isSubmitting ? 'Saving...' : editingNote ? 'Update Note' : 'Add Note'}
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

export default NotesCRUD
