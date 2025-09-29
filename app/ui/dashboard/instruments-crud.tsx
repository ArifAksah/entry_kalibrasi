// Placeholder to illustrate permission checks if instruments CRUD exists elsewhere.
// If you already have instruments-crud.tsx in another path, apply similar `usePermissions`
// gating for create/update/delete buttons as done in sensors and certificates.

'use client'

import React, { useEffect, useState } from 'react'
import { useInstruments } from '../../../hooks/useInstruments'
import { Instrument, InstrumentInsert } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { usePermissions } from '../../../hooks/usePermissions'

const InstrumentsCRUD: React.FC = () => {
  const { instruments, loading, error, addInstrument, updateInstrument, deleteInstrument } = useInstruments()
  const { can, canEndpoint } = usePermissions()
  // instrumentNames no longer required for validation. Keep optional fetch if needed elsewhere.

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<InstrumentInsert>({
    manufacturer: '',
    type: '',
    serial_number: '',
    others: '',
    name: '',
  })

  // No need to prefetch instrument names for this modal anymore

  const openModal = (item?: Instrument) => {
    if (item) {
      setEditing(item)
      setForm({
        manufacturer: item.manufacturer,
        type: item.type,
        serial_number: item.serial_number,
        others: item.others ?? '',
        name: item.name,
      })
    } else {
      setEditing(null)
      setForm({ manufacturer: '', type: '', serial_number: '', others: '', name: '' })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.manufacturer || !form.type || !form.serial_number || !form.name) return
    setIsSubmitting(true)
    try {
      if (editing) {
        await updateInstrument(editing.id, form)
      } else {
        await addInstrument(form)
      }
      closeModal()
    } catch (e) {
      // handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this instrument?')) return
    try { await deleteInstrument(id) } catch {}
  }

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
        <Breadcrumb items={[{ label: 'Instruments', href: '#' }, { label: 'Manager' }]} />
        {can('instrument','create') && (
          <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
        )}
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Manufacturer', 'Type', 'Serial No.', 'Name', 'Others', 'Actions' ]}>
          {instruments.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.manufacturer}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.serial_number}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.others ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                {can('instrument','update') && canEndpoint('PUT', `/api/instruments/${item.id}`) && (
                  <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                )}
                {can('instrument','delete') && canEndpoint('DELETE', `/api/instruments/${item.id}`) && (
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && can('instrument', editing ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl mx-4">
            <Card title={editing ? 'Edit Instrument' : 'Add New Instrument'}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input value={form.manufacturer} onChange={e=>setForm({ ...form, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <input value={form.type} onChange={e=>setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input value={form.serial_number} onChange={e=>setForm({ ...form, serial_number: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrument Name</label>
                <input value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter instrument name" required />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Others</label>
                <textarea value={form.others ?? ''} onChange={e=>setForm({ ...form, others: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              <div className="sm:col-span-2 flex justify-end space-x-3 pt-2">
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

export default InstrumentsCRUD


