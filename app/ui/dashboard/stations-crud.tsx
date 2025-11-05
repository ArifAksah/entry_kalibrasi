'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useStations } from '../../../hooks/useStations'
import { Station, StationInsert, Personel } from '../../../lib/supabase'
import { supabase } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Loading from '../../../components/ui/Loading'
import { usePermissions } from '../../../hooks/usePermissions'

// SVG Icons untuk tampilan yang lebih elegan
const EditIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const PlusIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const CloseIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const StationIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

// Komponen Background Batik Elegan
const BatikBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full opacity-5">
      <div className="absolute top-4 left-4 w-32 h-32 border-2 border-[#1e377c] rounded-full"></div>
      <div className="absolute top-4 right-4 w-24 h-24 border border-[#1e377c] rotate-45"></div>
      <div className="absolute bottom-4 left-4 w-20 h-20 border border-[#1e377c] rounded-full"></div>
      <div className="absolute bottom-4 right-4 w-28 h-28 border-2 border-[#1e377c] rotate-12"></div>
    </div>
    <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
    <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
  </div>
)

const StationsCRUD: React.FC = () => {
  const { stations, loading, error, addStation, updateStation, deleteStation, fetchStations } = useStations()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Station | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const [serverTotal, setServerTotal] = useState(0)
  const [serverTotalPages, setServerTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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
    // initial server-side fetch
    fetchStations({ page: 1, pageSize })
  }, [])

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return stations
    return stations.filter(s => {
      const hay = [
        s.station_id,
        s.name,
        (s as any).type,
        s.address,
        s.region,
        s.province,
        s.regency
      ].map(v => String(v ?? '').toLowerCase()).join(' ')
      return hay.includes(q)
    })
  }, [stations, search])

  // Ensure current page stays within range when data changes
  // debounce search to avoid losing focus/loading flicker
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const total = filteredStations.length
    setServerTotal(total)
    setServerTotalPages(Math.max(1, Math.ceil(total / pageSize)))
    if (currentPage > Math.ceil(total / pageSize)) {
      setCurrentPage(1)
    }
  }, [filteredStations])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredStations.length / pageSize)), [filteredStations])
  const pagedStations = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStations.slice(start, start + pageSize)
  }, [filteredStations, currentPage])

  const openModal = (item?: Station) => {
    if (item) {
      setEditing(item)
      setForm({
        station_id: (item as any).station_id ?? '',
        name: (item as any).name ?? '',
        address: (item as any).address ?? '',
        type: ((item as any).type ?? '') as any,
        latitude: typeof (item as any).latitude === 'number' ? (item as any).latitude : 0,
        longitude: typeof (item as any).longitude === 'number' ? (item as any).longitude : 0,
        elevation: typeof (item as any).elevation === 'number' ? (item as any).elevation : 0,
        time_zone: (item as any).time_zone ?? '',
        region: (item as any).region ?? '',
        province: (item as any).province ?? '',
        regency: (item as any).regency ?? '',
        created_by: (item as any).created_by ?? (currentUserId || ''),
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
      console.error('Error submitting station:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this station?')) return
    try { 
      await deleteStation(id) 
    } catch (e) {
      console.error('Error deleting station:', e)
    }
  }
 
  // Note: avoid unmounting the UI on loading; show inline indicator instead

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
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Search station..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && (
            <span className="text-sm text-gray-500">Loading...</span>
          )}
          {can('station','create') && (
            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <Table
          headers={[ 'Station ID', 'Name', 'Type', 'Region', 'Province', 'Actions' ]}
          columnClasses={[ 'w-28', 'w-48', 'w-28', 'w-40', 'w-40', 'w-28' ]}
          tableClassName="min-w-full table-fixed divide-y divide-gray-200"
        >
          {pagedStations.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.station_id}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.name}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{(item as any).type || '-'}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.region}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.province}</td>
              <td className="px-6 py-4 text-sm font-medium space-x-2">
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
        {/* Pagination controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              className={`px-3 py-1 rounded border ${currentPage === 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >First</button>
            <button
              className={`px-3 py-1 rounded border ${currentPage === 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >Prev</button>
            <button
              className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >Next</button>
            <button
              className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >Last</button>
          </div>
        </div>
      </Card>

      {/* Modal dengan desain elegan */}
      {isModalOpen && can('station', editing ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal dengan gradient elegan */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <StationIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editing ? 'Edit Station' : 'Create New Station'}
                    </h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      {editing ? 'Update existing station details' : 'Fill in the station information below'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="max-h-[70vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Station Information - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <StationIcon className="w-4 h-4 text-[#1e377c]" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Station Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Station ID *', value: form.station_id, onChange: (e: any) => setForm({ ...form, station_id: e.target.value }), type: 'text', required: true },
                      { label: 'Name *', value: form.name, onChange: (e: any) => setForm({ ...form, name: e.target.value }), type: 'text', required: true },
                      { 
                        label: 'Type *', 
                        value: (form as any).type || '', 
                        onChange: (e: any) => setForm({ ...form, type: e.target.value as any }), 
                        type: 'select', 
                        required: true,
                        options: [
                          { value: '', label: 'Pilih Type' },
                          { value: 'Meteorologi', label: 'Meteorologi' },
                          { value: 'Klimatologi', label: 'Klimatologi' },
                          { value: 'Geofisika', label: 'Geofisika' }
                        ]
                      },
                      { label: 'Time Zone *', value: form.time_zone, onChange: (e: any) => setForm({ ...form, time_zone: e.target.value }), type: 'text', required: true },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            required={field.required}
                            value={field.value}
                            onChange={field.onChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          >
                            {field.options?.map((option, optIndex) => (
                              <option key={optIndex} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            required={field.required}
                            type={field.type}
                            value={field.value}
                            onChange={field.onChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                    
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Address *</label>
                      <textarea 
                        required 
                        value={form.address} 
                        onChange={e=>setForm({ ...form, address: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm" 
                        rows={2} 
                      />
                    </div>
                  </div>
                </div>

                {/* Location Details - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Location Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Latitude *', value: form.latitude, onChange: (e: any) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 }), type: 'number', step: "any", required: true },
                      { label: 'Longitude *', value: form.longitude, onChange: (e: any) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 }), type: 'number', step: "any", required: true },
                      { label: 'Elevation (m) *', value: form.elevation, onChange: (e: any) => setForm({ ...form, elevation: parseFloat(e.target.value) || 0 }), type: 'number', step: "any", required: true },
                      { label: 'Region *', value: form.region, onChange: (e: any) => setForm({ ...form, region: e.target.value }), type: 'text', required: true },
                      { label: 'Province *', value: form.province, onChange: (e: any) => setForm({ ...form, province: e.target.value }), type: 'text', required: true },
                      { label: 'Regency *', value: form.regency, onChange: (e: any) => setForm({ ...form, regency: e.target.value }), type: 'text', required: true },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        <input
                          required={field.required}
                          type={field.type}
                          step={field.step}
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Created By Information - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <svg className="w-4 h-4 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Created By</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Current User</label>
                      <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm">
                        {personelMap[currentUserId || ''] || 'Current User'}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        This station will be associated with your account
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg transition-all duration-200 shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : editing ? 'Update Station' : 'Create Station'}
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

export default StationsCRUD