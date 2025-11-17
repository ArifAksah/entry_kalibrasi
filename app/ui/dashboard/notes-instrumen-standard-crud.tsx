'use client'

import React, { useEffect, useState } from 'react'
import { useNotesInstrumenStandard } from '../../../hooks/useNotesInstrumenStandard'
import { NotesInstrumenStandard, NotesInstrumenStandardInsert, Sensor, Note } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

const NotesInstrumenStandardCRUD: React.FC = () => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useNotesInstrumenStandard()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<NotesInstrumenStandard | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [form, setForm] = useState<NotesInstrumenStandardInsert>({ notes: null, instrumen_standard: null })

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetch('/api/notes')
        const data = await res.json()
        if (res.ok && Array.isArray(data)) setNotes(data)
      } catch {}
    }
    const fetchSensors = async () => {
      try {
        const res = await fetch('/api/sensors')
        const data = await res.json()
        if (res.ok && Array.isArray(data)) setSensors(data)
      } catch {}
    }
    fetchNotes()
    fetchSensors()
  }, [])

  const openModal = (item?: NotesInstrumenStandard) => {
    if (item) {
      setEditing(item)
      setForm({ notes: item.notes, instrumen_standard: item.instrumen_standard })
    } else {
      setEditing(null)
      setForm({ notes: null, instrumen_standard: null })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (editing) {
        await updateItem(editing.id, form)
      } else {
        await addItem(form)
      }
      closeModal()
    } catch {} finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this record?')) return
    try { await deleteItem(id) } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Sensors', href: '#' }, { label: 'Notes Instrumen Standard' }]} />
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <Card>
        <Table headers={[ 'Notes', 'Instrumen Standard (Sensor)', 'Actions' ]}>
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.notes ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.instrumen_standard ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <EditButton onClick={() => openModal(item)} title="Edit Notes Instrumen Standard" />
                <DeleteButton onClick={() => handleDelete(item.id)} title="Delete Notes Instrumen Standard" />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-xl mx-4">
            <Card title={editing ? 'Edit' : 'Add New'}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <select
                  value={form.notes ?? ''}
                  onChange={e => setForm({ ...form, notes: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select notes</option>
                  {notes.map(n => (
                    <option key={n.id} value={n.id}>ID: {n.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrumen Standard (Sensor)</label>
                <select
                  value={form.instrumen_standard ?? ''}
                  onChange={e => setForm({ ...form, instrumen_standard: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select sensor</option>
                  {sensors.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.type} ({s.serial_number})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotesInstrumenStandardCRUD


