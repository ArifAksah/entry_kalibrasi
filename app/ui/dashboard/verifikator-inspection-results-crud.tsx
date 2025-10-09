'use client'

import React, { useEffect, useState } from 'react'
import { useVerifikatorInspectionResults } from '../../../hooks/useVerifikatorInspectionResults'
import { VerifikatorInspectionResult, VerifikatorInspectionResultInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

const VerifikatorInspectionResultsCRUD: React.FC = () => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useVerifikatorInspectionResults()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<VerifikatorInspectionResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<Array<{ id: number }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState<VerifikatorInspectionResultInsert>({ result: 0, verified_by: '' })

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch('/api/inspection-results')
        const data = await res.json()
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

  const openModal = (item?: VerifikatorInspectionResult) => {
    if (item) {
      setEditing(item)
      setForm({ result: item.result, verified_by: item.verified_by })
    } else {
      setEditing(null)
      setForm({ result: 0, verified_by: '' })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.result || !form.verified_by) return
    setIsSubmitting(true)
    try {
      if (editing) {
        await updateItem(editing.id, form)
      } else {
        await addItem(form)
      }
      closeModal()
    } catch {} finally { setIsSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this record?')) return
    try { await deleteItem(id) } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Inspection', href: '#' }, { label: 'Verifikator Results' }]} />
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <Card>
        <Table headers={[ 'Result', 'Verified By', 'Actions' ]}>
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.result}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.verified_by}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Result</label>
                <select
                  value={form.result || 0}
                  onChange={e => setForm({ ...form, result: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Select inspection result</option>
                  {results.map(r => (
                    <option key={r.id} value={r.id}>ID: {r.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verified By (Personel)</label>
                <select
                  value={form.verified_by || ''}
                  onChange={e => setForm({ ...form, verified_by: e.target.value })}
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
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default VerifikatorInspectionResultsCRUD


