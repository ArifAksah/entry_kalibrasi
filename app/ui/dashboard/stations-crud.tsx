'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useStations } from '../../../hooks/useStations'
import { Station, StationInsert, Personel, RefStation } from '../../../lib/supabase'
import { supabase } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Loading from '../../../components/ui/Loading'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'
import { usePermissions } from '../../../hooks/usePermissions'
import Toast from '../../../components/ui/Toast'

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

// Interfaces for API Wilayah
interface WilayahProvince {
  id: string
  name: string
}

interface WilayahRegency {
  id: string
  province_id: string
  name: string
}

export default function StationsCRUD() {
  const { stations, loading, error, addStation, updateStation, deleteStation, fetchStations } = useStations()

  const { can, canEndpoint, role } = usePermissions()

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
  const [refStations, setRefStations] = useState<RefStation[]>([])
  const [refSearch, setRefSearch] = useState('')
  const [showRefDropdown, setShowRefDropdown] = useState(false)
  const [isLoadingRef, setIsLoadingRef] = useState(false)

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  
  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; id: number | null; title: string; message: string }>({
    isOpen: false,
    id: null,
    title: 'Konfirmasi',
    message: ''
  })

  // State for Wilayah API
  const [provinces, setProvinces] = useState<WilayahProvince[]>([])
  const [regencies, setRegencies] = useState<WilayahRegency[]>([])
  const [selectedProvId, setSelectedProvId] = useState<string>('')

  const [form, setForm] = useState<StationInsert>({
    station_id: '',
    name: '',
    address: '',
    type_id: null,
    latitude: '',
    longitude: '',
    elevation: '',
    time_zone: '',
    region: '',
    province: '',
    regency: '',
    created_by: '', // Will be set to current user
  })


  // Search Reference Stations
  useEffect(() => {
    const searchRef = async () => {
      if (refSearch.length < 3) {
        setRefStations([])
        return
      }
      setIsLoadingRef(true)
      try {
        const res = await supabase
          .from('ref_stations')
          .select('*')
          .ilike('station_name', `%${refSearch}%`)
          .limit(10)

        if (res.data) setRefStations(res.data)
      } catch (e) {
        console.error('Error searching ref stations:', e)
      } finally {
        setIsLoadingRef(false)
      }
    }
    const t = setTimeout(searchRef, 300)
    return () => clearTimeout(t)
  }, [refSearch])

  // Fetch Provinces on mount
  useEffect(() => {
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
      .then(res => res.json())
      .then(data => setProvinces(data))
      .catch(err => console.error('Error fetching provinces:', err))
  }, [])

  // Fetch Regencies when Province ID changes
  useEffect(() => {
    if (selectedProvId) {
      fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${selectedProvId}.json`)
        .then(res => res.json())
        .then(data => setRegencies(data))
        .catch(err => console.error('Error fetching regencies:', err))
    } else {
      setRegencies([])
    }
  }, [selectedProvId])

  const selectRefStation = (ref: RefStation) => {
    // Try to match province to set ID for regency fetching
    if (ref.propinsi_name && provinces.length > 0) {
      const match = provinces.find(p => p.name.toLowerCase() === ref.propinsi_name.toLowerCase())
      if (match) {
        setSelectedProvId(match.id)
      }
    }

    setForm(prev => ({
      ...prev,
      station_id: ref.station_wmo_id || ref.wigos_id || ref.station_id || '', // Use WMO/WIGOS as station_id
      name: ref.station_name,
      latitude: ref.current_latitude ?? '',
      longitude: ref.current_longitude ?? '',
      elevation: ref.current_elevation ?? '',
      time_zone: ref.timezone || '',
      region: ref.region_description || '',
      province: ref.propinsi_name || '',
      regency: ref.kabupaten_name || '',
      // Map station_type_id to integer ID
      type_id: ref.station_type_id || null,
      address: `Station ID: ${ref.station_id}, ${ref.kabupaten_name}, ${ref.propinsi_name}` // Auto-generate simple address
    }))
    setRefSearch('')
    setShowRefDropdown(false)
  }

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
    // Fetch data for dropdowns
    fetchPersonel()
  }, [])

  // Fetch stations once role and user are known
  useEffect(() => {
    const initStations = async () => {
      // Wait for role to be determined
      if (!role) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          setForm(prev => ({ ...prev, created_by: user.id }))

          // Use userId filtering if not admin
          const filterUserId = role === 'admin' ? undefined : user.id
          fetchStations({ page: 1, pageSize, userId: filterUserId })
        }
      } catch (e) {
        console.error('Failed to init stations page:', e)
      }
    }

    if (role) {
      initStations()
    }
  }, [role])

  const filteredStations = useMemo(() => {
    let data = stations
    // Server-side filtering handles user restriction now

    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(s => {
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
        type_id: (item as any).type_id ?? null,
        latitude: (item as any).latitude ?? '',
        longitude: (item as any).longitude ?? '',
        elevation: (item as any).elevation ?? '',
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
        type_id: null,
        latitude: '',
        longitude: '',
        elevation: '',
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
    if (!form.name || !form.address) return // Removed station_id check as it might be wmo_id now

    // Ensure created_by is set to current user
    // Ensure created_by is set to current user
    const finalPayload = { ...form, created_by: currentUserId || form.created_by } as StationInsert

    if (!finalPayload.created_by) {
      setToast({ message: 'Please log in to create a station', type: 'error' })
      return
    }

    setIsSubmitting(true)
    try {
      if (editing) {
        await updateStation(editing.id, finalPayload)
        setToast({ message: 'Station updated successfully', type: 'success' })
      } else {
        await addStation(finalPayload)
        setToast({ message: 'Station created successfully', type: 'success' })
      }
      closeModal()
    } catch (e) {
      console.error('Error submitting station:', e)
      setToast({ message: 'Failed to save station', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (id: number) => {
    setConfirmState({
      isOpen: true,
      id,
      title: 'Konfirmasi Hapus',
      message: 'Apakah Anda yakin ingin menghapus stasiun ini?'
    })
  }

  const handleConfirmDelete = async () => {
    if (confirmState.id === null) return
    try {
      await deleteStation(confirmState.id)
      setToast({ message: 'Station deleted successfully', type: 'success' })
    } catch (e) {
      console.error('Error deleting station:', e)
      setToast({ message: 'Failed to delete station', type: 'error' })
    } finally {
      setConfirmState({ isOpen: false, id: null, title: 'Konfirmasi', message: '' })
    }
  }

  // Note: avoid unmounting the UI on loading; show inline indicator instead

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Stations', href: '#' }, { label: 'Manager' }]} />
        {can('instrument', 'read') && can('instrument', 'read') && can('certificate', 'read') && can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('sensor', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
        {can('instrument', 'read') && null}
        {can('certificate', 'read') && null}
        {can('sensor', 'read') && null}
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
          {can('station', 'create') && (
            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
          )}
        </div>
      </div>


      <Card>
        <Table
          headers={['ID (WMO)', 'Name', 'Type', 'Region', 'Province', 'Actions']}
          columnClasses={['w-28', 'w-48', 'w-28', 'w-40', 'w-40', 'w-28']}
          tableClassName="min-w-full table-fixed divide-y divide-gray-200"
        >
          {pagedStations.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.station_id || '-'}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.name}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{(item as any).station_type?.name || '-'}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.region}</td>
              <td className="px-6 py-4 text-sm text-gray-900 truncate">{item.province}</td>
              <td className="px-6 py-4 text-sm font-medium space-x-2">
                {can('station', 'update') && canEndpoint('PUT', `/api/stations/${item.id}`) && (
                  <EditButton onClick={() => openModal(item)} title="Edit Station" />
                )}
                {can('station', 'delete') && canEndpoint('DELETE', `/api/stations/${item.id}`) && (
                  <DeleteButton onClick={() => handleDelete(item.id)} title="Delete Station" />
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
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-visible">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] rounded-t-lg"></div>
                  <div className="flex items-center space-x-2 mb-3 mt-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <StationIcon className="w-4 h-4 text-[#1e377c]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900">Station Information</h3>
                    </div>
                    {/* Reference Search */}
                    {!editing && (
                      <div className="relative w-64">
                        <input
                          placeholder="Cari dari Referensi BMKG..."
                          value={refSearch}
                          onChange={e => { setRefSearch(e.target.value); setShowRefDropdown(true); }}
                          onFocus={() => setShowRefDropdown(true)}
                          onBlur={() => setTimeout(() => setShowRefDropdown(false), 200)}
                          className="w-full px-3 py-1.5 text-xs border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 bg-blue-50/50"
                        />
                        {showRefDropdown && refSearch.length > 2 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {isLoadingRef ? (
                              <div className="p-2 text-xs text-gray-500 text-center">Loading...</div>
                            ) : refStations.length > 0 ? (
                              refStations.map(ref => (
                                <div
                                  key={ref.station_id}
                                  onMouseDown={() => selectRefStation(ref)}
                                  className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                >
                                  <div className="font-semibold text-xs text-gray-900">{ref.station_name}</div>
                                  <div className="text-[10px] text-gray-500">{ref.kabupaten_name}, {ref.propinsi_name}</div>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 text-xs text-gray-500 text-center">No results</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Station ID / WMO ID', value: form.station_id || '', onChange: (e: any) => setForm({ ...form, station_id: e.target.value }), type: 'text', required: false, placeholder: 'Ex: 96745 or STN001' },
                      { label: 'Name *', value: form.name, onChange: (e: any) => setForm({ ...form, name: e.target.value }), type: 'text', required: true },
                      {
                        label: 'Type',
                        value: form.type_id || '',
                        onChange: (e: any) => setForm({ ...form, type_id: e.target.value ? parseInt(e.target.value) : null }),
                        type: 'select',
                        required: false,
                        options: [
                          { value: '', label: 'Pilih Type' },
                          { value: '1', label: 'Meteorologi' },
                          { value: '2', label: 'Klimatologi' },
                          { value: '3', label: 'Geofisika' }
                        ]
                      },
                      {
                        label: 'Time Zone *',
                        value: form.time_zone || '',
                        onChange: (e: any) => setForm({ ...form, time_zone: e.target.value }),
                        type: 'select',
                        required: true,
                        options: [
                          { value: '', label: 'Pilih Zona Waktu' },
                          { value: 'UTC+07:00', label: 'WIB (UTC+07:00)' },
                          { value: 'UTC+08:00', label: 'WITA (UTC+08:00)' },
                          { value: 'UTC+09:00', label: 'WIT (UTC+09:00)' },
                          { value: 'UTC+00:00', label: 'UTC (UTC+00:00)' }
                        ]
                      },
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
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Location Details - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3 mt-2">
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
                      { label: 'Latitude', value: form.latitude || '', onChange: (e: any) => setForm({ ...form, latitude: e.target.value }), type: 'text', required: false },
                      { label: 'Longitude', value: form.longitude || '', onChange: (e: any) => setForm({ ...form, longitude: e.target.value }), type: 'text', required: false },
                      { label: 'Elevation (m)', value: form.elevation || '', onChange: (e: any) => setForm({ ...form, elevation: e.target.value }), type: 'text', required: false },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        <input
                          required={field.required}
                          type={field.type}
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        />
                      </div>
                    ))}

                    {/* Region Input with Datalist */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Region *</label>
                      <input
                        list="region-options"
                        value={form.region}
                        onChange={(e) => setForm({ ...form, region: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        placeholder="Select or type region..."
                        required
                      />
                      <datalist id="region-options">
                        <option value="Wilayah I" />
                        <option value="Wilayah II" />
                        <option value="Wilayah III" />
                        <option value="Wilayah IV" />
                        <option value="Wilayah V" />
                        <option value="Laboratorium Kantor Pusat" />
                        <option value="Direktorat Instrumen Kalibrasi" />
                      </datalist>
                    </div>

                    {/* Province Dropdown */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Province *</label>
                      <select
                        value={form.province} // Needs to handle text value, but sync with ID
                        onChange={(e) => {
                          const selectedOpt = e.target.selectedOptions[0];
                          const id = selectedOpt.getAttribute('data-id') || '';
                          setForm({ ...form, province: e.target.value, regency: '' });
                          setSelectedProvId(id);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        required
                      >
                        <option value="">Select Province</option>
                        {provinces.map(p => (
                          <option key={p.id} value={p.name} data-id={p.id}>{p.name}</option>
                        ))}
                        {/* Fallback for existing value not in list */}
                        {form.province && !provinces.some(p => p.name === form.province) && (
                          <option value={form.province}>{form.province}</option>
                        )}
                      </select>
                    </div>

                    {/* Regency Dropdown */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Regency *</label>
                      <select
                        value={form.regency}
                        onChange={(e) => setForm({ ...form, regency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                        required
                        disabled={!form.province}
                      >
                        <option value="">Select Regency</option>
                        {regencies.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                        {/* Fallback for existing value not in list */}
                        {form.regency && !regencies.some(r => r.name === form.regency) && (
                          <option value={form.regency}>{form.regency}</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Created By Information - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3 mt-2">
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
          </div >
        </div >
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          durationMs={3000}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-yellow-50 rounded-full">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{confirmState.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{confirmState.message}</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmState({ isOpen: false, id: null, title: 'Konfirmasi', message: '' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  )
}
