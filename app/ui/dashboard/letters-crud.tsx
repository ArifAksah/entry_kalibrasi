'use client'

import React, { useEffect, useState } from 'react'
import { useLetters } from '../../../hooks/useLetters'
import { Letter, LetterInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

const LettersCRUD: React.FC = () => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useLetters()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Letter | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instruments, setInstruments] = useState<Array<{ id: number; type?: string; serial_number?: string }>>([])
  const [stations, setStations] = useState<Array<{ id: number; name: string; station_id: string }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [results, setResults] = useState<Array<{ id: number }>>([])
  const [form, setForm] = useState<LetterInsert>({ no_letter: '', instrument: null, owner: null, issue_date: '', inspection_result: null, authorized_by: null })

  useEffect(() => {
    const fetchInstruments = async () => {
      try { const r = await fetch('/api/instruments'); const d = await r.json(); if (r.ok) setInstruments(Array.isArray(d)? d: []) } catch {}
    }
    const fetchStations = async () => {
      try { const r = await fetch('/api/stations'); const d = await r.json(); if (r.ok) setStations(Array.isArray(d)? d: []) } catch {}
    }
    const fetchPersonel = async () => {
      try { const r = await fetch('/api/personel'); const d = await r.json(); if (r.ok) setPersonel(Array.isArray(d)? d: []) } catch {}
    }
    const fetchResults = async () => {
      try { const r = await fetch('/api/inspection-results'); const d = await r.json(); if (r.ok) setResults(Array.isArray(d)? d: []) } catch {}
    }
    fetchInstruments(); fetchStations(); fetchPersonel(); fetchResults()
  }, [])

  const openModal = (item?: Letter) => {
    if (item) {
      setEditing(item)
      setForm({ no_letter: item.no_letter, instrument: item.instrument, owner: item.owner, issue_date: item.issue_date || '', inspection_result: item.inspection_result, authorized_by: item.authorized_by })
    } else {
      setEditing(null)
      setForm({ no_letter: '', instrument: null, owner: null, issue_date: '', inspection_result: null, authorized_by: null })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => { setIsModalOpen(false); setEditing(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.no_letter) return
    setIsSubmitting(true)
    try {
      if (editing) await updateItem(editing.id, form)
      else await addItem(form)
      closeModal()
    } catch {} finally { setIsSubmitting(false) }
  }

  const handleDelete = async (id: number) => { if (!confirm('Delete this letter?')) return; try { await deleteItem(id) } catch {} }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Documents', href: '#' }, { label: 'Letters' }]} />
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <Card>
        <Table headers={[ 'No. Letter', 'Instrument', 'Owner', 'Issue Date', 'Authorized By', 'Actions' ]}>
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.no_letter}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.instrument ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.owner ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.issue_date || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.authorized_by || '-'}</td>
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
          <div className="w-full max-w-2xl mx-4">
            <Card title={editing ? 'Edit Letter' : 'Add New Letter'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit Letter' : 'Add New Letter'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Letter</label>
                <input value={form.no_letter} onChange={e => setForm({ ...form, no_letter: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrument</label>
                <select value={form.instrument ?? ''} onChange={e => setForm({ ...form, instrument: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select instrument</option>
                  {instruments.map(i => (<option key={i.id} value={i.id}>ID: {i.id} {i.type ? `- ${i.type}` : ''} {i.serial_number ? `(${i.serial_number})` : ''}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner (Station)</label>
                <select value={form.owner ?? ''} onChange={e => setForm({ ...form, owner: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select station</option>
                  {stations.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.station_id})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                <input type="date" value={form.issue_date || ''} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Result</label>
                <select value={form.inspection_result ?? ''} onChange={e => setForm({ ...form, inspection_result: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select inspection result</option>
                  {results.map(r => (<option key={r.id} value={r.id}>ID: {r.id}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By (Personel)</label>
                <select value={form.authorized_by ?? ''} onChange={e => setForm({ ...form, authorized_by: e.target.value || null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select personel</option>
                  {personel.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>))}
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end space-x-3 pt-4">
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

export default LettersCRUD


