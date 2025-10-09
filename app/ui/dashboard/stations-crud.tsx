'use client'

import React, { useState, useEffect } from 'react'
import { useStations } from '../../../hooks/useStations'
import { Station, StationInsert, Personel } from '../../../lib/supabase'
import { supabase } from '../../../lib/supabase'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { usePermissions } from '../../../hooks/usePermissions'
import { Modal } from '../../../components/ui/Modal'
import { Input, Textarea, Select } from '../../../components/ui/Input'

const StationsCRUD: React.FC = () => {
  const { stations, loading, error, addStation, updateStation, deleteStation } = useStations()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Station | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [personel, setPersonel] = useState<Personel[]>([])
  const [personelMap, setPersonelMap] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [form, setForm] = useState<StationInsert>({
    station_id: '',
    name: '',
    address: '',
    type: '' as any,
    latitude: 0,
    longitude: 0,
    elevation: 0,
    time_zone: '',
    region: '',
    province: '',
    regency: '',
    created_by: '', // Will be set to current user
  })

  // Get current user and fetch personel data
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          setForm(prev => ({ ...prev, created_by: user.id }))
        }
      } catch (e) {
        console.error('Failed to get current user:', e)
      }
    }

    const fetchPersonel = async () => {
      try {
        const res = await fetch('/api/personel')
        if (res.ok) {
          const data = await res.json()
          setPersonel(data)
          // Create a map for quick lookup
          const map: Record<string, string> = {}
          data.forEach((p: Personel) => {
            map[p.id] = p.name
          })
          setPersonelMap(map)
        }
      } catch (e) {
        console.error('Failed to fetch personel:', e)
      }
    }

    getCurrentUser()
    fetchPersonel()
  }, [])

  const openModal = (item?: Station) => {
    if (item) {
      setEditing(item)
      setForm({
        station_id: item.station_id,
        name: item.name,
        address: item.address,
        type: (item as any).type || '' as any,
        latitude: item.latitude,
        longitude: item.longitude,
        elevation: item.elevation,
        time_zone: item.time_zone,
        region: item.region,
        province: item.province,
        regency: item.regency,
        created_by: item.created_by,
      })
    } else {
      setEditing(null)
      setForm({
        station_id: '',
        name: '',
        address: '',
        type: '' as any,
        latitude: 0,
        longitude: 0,
        elevation: 0,
        time_zone: '',
        region: '',
        province: '',
        regency: '',
        created_by: currentUserId || '',
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.station_id || !form.name || !form.address) return
    
    // Ensure created_by is set to current user
    const formData = { ...form, created_by: currentUserId || form.created_by }
    if (!formData.created_by) {
      alert('Please log in to create a station')
      return
    }
    
    setIsSubmitting(true)
    try {
      if (editing) {
        await updateStation(editing.id, formData)
      } else {
        await addStation(formData)
      }
      closeModal()
    } catch (e) {
      // handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this station?')) return
    try { await deleteStation(id) } catch {}
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
        <Breadcrumb items={[{ label: 'Stations', href: '#' }, { label: 'Manager' }]} />
        {can('instrument','read') && can('instrument','read') && can('certificate','read') && can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('sensor','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('instrument','read') && null}
        {can('certificate','read') && null}
        {can('sensor','read') && null}
        {can('station','create') && (
          <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
        )}
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Station ID', 'Name', 'Type', 'Address', 'Region', 'Province', 'Created By', 'Actions' ]}>
          {stations.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.station_id}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(item as any).type || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{item.address}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.region}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.province}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{personelMap[item.created_by] || 'Unknown'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
        {can('station','update') && canEndpoint('PUT', `/api/stations/${item.id}`) && (
                  <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                )}
        {can('station','delete') && canEndpoint('DELETE', `/api/stations/${item.id}`) && (
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && can('station', editing ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <Card title={editing ? 'Edit Station' : 'Add New Station'}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station ID</label>
                <input required value={form.station_id} onChange={e=>setForm({ ...form, station_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select required value={(form as any).type || ''} onChange={e=>setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih Type</option>
                  <option value="Meteorologi">Meteorologi</option>
                  <option value="Klimatologi">Klimatologi</option>
                  <option value="Geofisika">Geofisika</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea required value={form.address} onChange={e=>setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input required type="number" step="any" value={form.latitude} onChange={e=>setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input required type="number" step="any" value={form.longitude} onChange={e=>setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elevation</label>
                <input required type="number" step="any" value={form.elevation} onChange={e=>setForm({ ...form, elevation: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
                <input required value={form.time_zone} onChange={e=>setForm({ ...form, time_zone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <input required value={form.region} onChange={e=>setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <input required value={form.province} onChange={e=>setForm({ ...form, province: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regency</label>
                <input required value={form.regency} onChange={e=>setForm({ ...form, regency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                  {personelMap[currentUserId || ''] || 'Current User'}
                </div>
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

export default StationsCRUD
