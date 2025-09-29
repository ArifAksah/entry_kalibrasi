'use client'

import React, { useEffect, useState } from 'react'
import { useInspectionPerson } from '../../../hooks/useInspectionPerson'
import { InspectionPerson, InspectionPersonInsert } from '../../../lib/supabase'

const InspectionPersonCRUD: React.FC = () => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useInspectionPerson()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<InspectionPerson | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<Array<{ id: number }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState<InspectionPersonInsert>({ result: null, inspection_by: null })

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch('/api/inspection-results')
        // If no endpoint exists, expect array or fallback to empty
        const data = await res.json().catch(() => [])
        if (res.ok && Array.isArray(data)) setResults(data)
      } catch {}
    }
    const fetchPersonel = async () => {
      try {
        const res = await fetch('/api/personel')
        const data = await res.json()
        if (res.ok && Array.isArray(data)) setPersonel(data)
      } catch {}
    }
    fetchResults()
    fetchPersonel()
  }, [])

  const openModal = (item?: InspectionPerson) => {
    if (item) {
      setEditing(item)
      setForm({ result: item.result, inspection_by: item.inspection_by })
    } else {
      setEditing(null)
      setForm({ result: null, inspection_by: null })
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
        <h2 className="text-2xl font-bold text-gray-900">Inspection Person</h2>
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspection By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.result ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.inspection_by ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit' : 'Add New'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Result</label>
                <select
                  value={form.result ?? ''}
                  onChange={e => setForm({ ...form, result: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select inspection result</option>
                  {results.map(r => (
                    <option key={r.id} value={r.id}>ID: {r.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection By (Personel)</label>
                <select
                  value={form.inspection_by ?? ''}
                  onChange={e => setForm({ ...form, inspection_by: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select personel</option>
                  {personel.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionPersonCRUD


