'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useInstruments } from '../../../hooks/useInstruments'
import { Instrument, InstrumentInsert, Station } from '../../../lib/supabase'
import { usePermissions } from '../../../hooks/usePermissions'
import { useStations } from '../../../hooks/useStations'

const InstrumentsCRUD: React.FC = () => {
  const { instruments, loading, error, addInstrument, updateInstrument, deleteInstrument, fetchInstruments } = useInstruments()
  const { stations, loading: stationsLoading } = useStations()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<InstrumentInsert>({
    manufacturer: '',
    type: '',
    serial_number: '',
    name: '',
    station_id: null,
    memiliki_lebih_satu: false,
  })
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stationSearch, setStationSearch] = useState('')
  const [showStationDropdown, setShowStationDropdown] = useState(false)
  
  // State untuk sensor form (kondisional) - sekarang array untuk multiple sensors
  const [sensorForms, setSensorForms] = useState<Array<{
    id: string;
    nama_sensor: string;
    merk_sensor: string;
    tipe_sensor: string;
    serial_number_sensor: string;
    range_capacity: string;
    range_capacity_unit: string;
    graduating: string;
    graduating_unit: string;
    funnel_diameter: number;
    funnel_diameter_unit: string;
    volume_per_tip: string;
    volume_per_tip_unit: string;
    funnel_area: number;
    funnel_area_unit: string;
    is_standard: boolean;
  }>>([])
  
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchInstruments({ q: debouncedSearch, page: currentPage, pageSize })
  }, [debouncedSearch, currentPage])

  useEffect(() => {
    // Set initial station search value if editing an instrument with a station
    if (editing && editing.station_id) {
      const station = stations.find(s => s.id === editing.station_id);
      if (station) {
        setStationSearch(station.name);
      }
    } else {
      setStationSearch('');
    }
  }, [editing, stations]);

  // Reset sensor forms when memiliki_lebih_satu is unchecked
  useEffect(() => {
    if (!form.memiliki_lebih_satu) {
      console.log('Resetting sensor forms because memiliki_lebih_satu is false')
      setSensorForms([]);
    }
  }, [form.memiliki_lebih_satu]);

  // Debug sensorForms changes
  useEffect(() => {
    console.log('sensorForms updated:', sensorForms)
  }, [sensorForms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return instruments
    return instruments.filter(it => `${it.manufacturer} ${it.type} ${it.serial_number} ${it.name} ${it.station?.name ?? ''}`.toLowerCase().includes(q))
  }, [instruments, search])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered])
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage])

  const openModal = async (item?: Instrument) => {
    if (item) {
      setEditing(item)
      setForm({
        manufacturer: item.manufacturer,
        type: item.type,
        serial_number: item.serial_number,
        name: item.name,
        station_id: item.station_id,
        memiliki_lebih_satu: item.memiliki_lebih_satu || false,
      })
      
      // Load existing sensors if instrument has multi sensor
      if (item.memiliki_lebih_satu) {
        try {
          console.log('Loading sensors for instrument:', item.id)
          const res = await fetch(`/api/instruments/${item.id}/sensors`)
          console.log('Sensor API response status:', res.status)
          if (res.ok) {
            const sensors = await res.json()
            console.log('Loaded sensors:', sensors)
            setSensorForms(sensors)
          } else {
            console.error('Failed to load sensors:', res.status, res.statusText)
            setSensorForms([])
          }
        } catch (error) {
          console.error('Error loading sensors:', error)
          setSensorForms([])
        }
      } else {
        setSensorForms([])
      }
    } else {
      setEditing(null)
      setForm({ 
        manufacturer: '', 
        type: '', 
        serial_number: '', 
        name: '', 
        station_id: null,
        memiliki_lebih_satu: false,
      })
      setSensorForms([])
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
    // Reset sensor forms
    setSensorForms([])
  }

  // Fungsi untuk menambah sensor baru
  const addSensor = () => {
    const newSensor = {
      id: `sensor_${Date.now()}`,
      nama_sensor: '',
      merk_sensor: '',
      tipe_sensor: '',
      serial_number_sensor: '',
      range_capacity: '',
      range_capacity_unit: '',
      graduating: '',
      graduating_unit: '',
      funnel_diameter: 0,
      funnel_diameter_unit: '',
      volume_per_tip: '',
      volume_per_tip_unit: '',
      funnel_area: 0,
      funnel_area_unit: '',
      is_standard: false
    }
    setSensorForms([...sensorForms, newSensor])
  }

  // Fungsi untuk menghapus sensor
  const removeSensor = async (sensorId: string) => {
    // If it's an existing sensor (numeric ID), delete from database
    if (!isNaN(Number(sensorId)) && editing?.id) {
      try {
        console.log('Deleting sensor from database:', sensorId)
        await fetch(`/api/instruments/${editing.id}/sensors?sensorId=${sensorId}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('Error deleting sensor:', error)
      }
    }
    
    setSensorForms(sensorForms.filter(sensor => sensor.id !== sensorId))
  }

  // Fungsi untuk update sensor
  const updateSensor = (sensorId: string, field: string, value: any) => {
    setSensorForms(sensorForms.map(sensor => 
      sensor.id === sensorId ? { ...sensor, [field]: value } : sensor
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.manufacturer || !form.type || !form.serial_number || !form.name) return
    setIsSubmitting(true)
    try {
      if (editing) {
        await updateInstrument(editing.id, form)
        
        // Handle sensor data for multi-sensor instruments
        if (form.memiliki_lebih_satu && editing.id) {
          // Get existing sensors
          const existingRes = await fetch(`/api/instruments/${editing.id}/sensors`)
          const existingSensors = existingRes.ok ? await existingRes.json() : []
          
          // Delete existing sensors that are not in the current form
          for (const existingSensor of existingSensors) {
            const stillExists = sensorForms.some(sf => sf.id === existingSensor.id.toString())
            if (!stillExists) {
              await fetch(`/api/instruments/${editing.id}/sensors?sensorId=${existingSensor.id}`, {
                method: 'DELETE'
              })
            }
          }
          
          // Add new sensors (only those with prefixed IDs are new)
          for (const sensorForm of sensorForms) {
            if (sensorForm.id.startsWith('sensor_')) {
              // New sensor - create it
              await fetch(`/api/instruments/${editing.id}/sensors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sensorForm)
              })
            }
            // Note: Existing sensors (with numeric IDs) are already in the database
            // and don't need to be updated unless we implement update functionality
          }
        }
      } else {
        const newInstrument = await addInstrument(form)
        
        // Handle sensor data for new multi-sensor instruments
        if (form.memiliki_lebih_satu && newInstrument && sensorForms.length > 0) {
          for (const sensorForm of sensorForms) {
            await fetch(`/api/instruments/${(newInstrument as any).id}/sensors`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sensorForm)
            })
          }
        }
      }
      closeModal()
    } catch (e) {
      // handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this instrument?')) return
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
        <h2 className="text-2xl font-bold text-gray-900">Instruments</h2>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Search instruments..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {can('instrument','create') && (
            <button 
              onClick={() => openModal()} 
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm"
            >
              Add New
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instrument Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manufacturer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serial No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Station
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Multi Sensor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paged.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.manufacturer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.serial_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.station?.name ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.memiliki_lebih_satu 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.memiliki_lebih_satu ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {can('instrument','update') && canEndpoint('PUT', `/api/instruments/${item.id}`) && (
                      <button
                        onClick={() => openModal(item)}
                        className="text-blue-600 hover:text-blue-900 transition-colors duration-200 font-medium"
                      >
                        Edit
                      </button>
                    )}
                    {can('instrument','delete') && canEndpoint('DELETE', `/api/instruments/${item.id}`) && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900 transition-colors duration-200 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg shadow">
        <div className="text-sm text-gray-600">Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span></div>
        <div className="inline-flex items-center gap-2">
          <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(1)}>First</button>
          <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>Prev</button>
          <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}>Next</button>
          <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(totalPages)}>Last</button>
        </div>
      </div>

      {/* Modal dengan scroll dan layout yang lebih baik */}
      {isModalOpen && can('instrument', editing ? 'update' : 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-6xl h-[90vh]">
            {/* Ambient Light Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-xl blur-lg -z-10"></div>
            
            {/* Modal Container */}
            <div className="bg-white rounded-xl shadow-2xl relative flex flex-col h-full">
              {/* Header dengan gradient - Fixed */}
              <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                  {editing ? 'Edit Instrument' : 'Add New Instrument'}
                </h3>
                    <p className="text-blue-200 text-sm mt-1">
                      {editing ? 'Update existing instrument information' : 'Create new instrument with optional sensor details'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-white hover:text-gray-300 transition-colors duration-200 p-1"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-6 space-y-8" id="instrument-form">
                  {/* Instrument Information Section */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Informasi Alat
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Instrument Name *
                    </label>
                    <input 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter instrument name" 
                      required 
                    />
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Manufacturer *
                    </label>
                    <input 
                      value={form.manufacturer} 
                      onChange={e => setForm({ ...form, manufacturer: e.target.value })} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter manufacturer name"
                      required 
                    />
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type *
                    </label>
                    <input 
                      value={form.type} 
                      onChange={e => setForm({ ...form, type: e.target.value })} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter instrument type"
                      required 
                    />
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Serial Number *
                    </label>
                    <input 
                      value={form.serial_number} 
                      onChange={e => setForm({ ...form, serial_number: e.target.value })} 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter serial number"
                      required 
                    />
                  </div>
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                      Station
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search station..."
                        value={stationSearch}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        onChange={(e) => {
                          setStationSearch(e.target.value);
                          setShowStationDropdown(true);
                        }}
                        onFocus={() => setShowStationDropdown(true)}
                        onBlur={() => {
                          // Delay hiding dropdown to allow for click events
                          setTimeout(() => setShowStationDropdown(false), 200);
                        }}
                        disabled={stationsLoading}
                      />
                      {showStationDropdown && (
                        <div 
                          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                        >
                          <div 
                                className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                            onMouseDown={() => {
                              setForm({ ...form, station_id: null });
                              setStationSearch('');
                            }}
                          >
                                <span className="text-gray-500">No station selected</span>
                          </div>
                          {stations
                            .filter(s => s.name.toLowerCase().includes(stationSearch.toLowerCase()))
                            .map(s => (
                              <div 
                                key={s.id} 
                                    className="p-3 hover:bg-gray-100 cursor-pointer"
                                onMouseDown={() => {
                                  setForm({ ...form, station_id: s.id });
                                  setStationSearch(s.name);
                                }}
                              >
                                {s.name}
                              </div>
                            ))
                          }
                        </div>
                      )}
                          {form.station_id && (
                            <div className="mt-2 flex items-center text-sm text-green-600">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Selected: {stations.find(s => s.id === form.station_id)?.name || ''}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="memiliki_lebih_satu"
                              checked={form.memiliki_lebih_satu || false}
                              onChange={(e) => setForm({ ...form, memiliki_lebih_satu: e.target.checked })}
                              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="memiliki_lebih_satu" className="text-sm font-medium text-gray-700">
                              Memiliki Lebih Satu Sensor
                            </label>
                          </div>
                          <p className="text-xs text-gray-600 mt-2 ml-8">
                            Centang jika alat ini memiliki lebih dari satu sensor. Form sensor akan muncul untuk diisi.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Sensor Information - Conditional */}
                {form.memiliki_lebih_satu && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <div className="bg-blue-100 rounded-full p-2 mr-3">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-blue-900">Informasi Sensor</h4>
                          <p className="text-sm text-blue-700">Kelola sensor untuk alat ini ({sensorForms.length} sensor)</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addSensor}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center text-sm font-medium"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Tambah Sensor
                      </button>
                    </div>
                    
                    {sensorForms.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        <p className="text-gray-500 text-sm">Belum ada sensor. Klik "Tambah Sensor" untuk menambahkan sensor pertama.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {sensorForms.map((sensor, index) => (
                          <div key={sensor.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="text-md font-semibold text-gray-800 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                                Sensor {index + 1}
                              </h5>
                              <button
                                type="button"
                                onClick={() => removeSensor(sensor.id)}
                                className="text-red-600 hover:text-red-800 transition-colors duration-200 p-1"
                                title="Hapus sensor ini"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Nama Sensor
                                </label>
                                <input
                                  type="text"
                                  value={sensor.nama_sensor}
                                  onChange={(e) => updateSensor(sensor.id, 'nama_sensor', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter sensor name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Merk Sensor
                                </label>
                                <input
                                  type="text"
                                  value={sensor.merk_sensor}
                                  onChange={(e) => updateSensor(sensor.id, 'merk_sensor', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter sensor manufacturer"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Tipe Sensor
                                </label>
                                <input
                                  type="text"
                                  value={sensor.tipe_sensor}
                                  onChange={(e) => updateSensor(sensor.id, 'tipe_sensor', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter sensor type"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Serial Number Sensor
                                </label>
                                <input
                                  type="text"
                                  value={sensor.serial_number_sensor}
                                  onChange={(e) => updateSensor(sensor.id, 'serial_number_sensor', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter sensor serial number"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Range Capacity
                                </label>
                                <input
                                  type="text"
                                  value={sensor.range_capacity}
                                  onChange={(e) => updateSensor(sensor.id, 'range_capacity', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter range capacity"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Range Capacity Unit
                                </label>
                                <input
                                  type="text"
                                  value={sensor.range_capacity_unit}
                                  onChange={(e) => updateSensor(sensor.id, 'range_capacity_unit', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter unit"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Graduating
                                </label>
                                <input
                                  type="text"
                                  value={sensor.graduating}
                                  onChange={(e) => updateSensor(sensor.id, 'graduating', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter graduating value"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Graduating Unit
                                </label>
                                <input
                                  type="text"
                                  value={sensor.graduating_unit}
                                  onChange={(e) => updateSensor(sensor.id, 'graduating_unit', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter unit"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Funnel Diameter
                                </label>
                                <input
                                  type="number"
                                  value={sensor.funnel_diameter}
                                  onChange={(e) => updateSensor(sensor.id, 'funnel_diameter', parseFloat(e.target.value) || 0)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter diameter"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Funnel Diameter Unit
                                </label>
                                <input
                                  type="text"
                                  value={sensor.funnel_diameter_unit}
                                  onChange={(e) => updateSensor(sensor.id, 'funnel_diameter_unit', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter unit"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Volume Per Tip
                                </label>
                                <input
                                  type="text"
                                  value={sensor.volume_per_tip}
                                  onChange={(e) => updateSensor(sensor.id, 'volume_per_tip', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter volume per tip"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Volume Per Tip Unit
                                </label>
                                <input
                                  type="text"
                                  value={sensor.volume_per_tip_unit}
                                  onChange={(e) => updateSensor(sensor.id, 'volume_per_tip_unit', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter unit"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Funnel Area
                                </label>
                                <input
                                  type="number"
                                  value={sensor.funnel_area}
                                  onChange={(e) => updateSensor(sensor.id, 'funnel_area', parseFloat(e.target.value) || 0)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter area"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Funnel Area Unit
                                </label>
                                <input
                                  type="text"
                                  value={sensor.funnel_area_unit}
                                  onChange={(e) => updateSensor(sensor.id, 'funnel_area_unit', e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter unit"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    id={`is_standard_${sensor.id}`}
                                    checked={sensor.is_standard}
                                    onChange={(e) => updateSensor(sensor.id, 'is_standard', e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label htmlFor={`is_standard_${sensor.id}`} className="text-sm font-medium text-gray-700">
                                    Is Standard
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </form>
                </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all duration-200 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="instrument-form"
                    disabled={isSubmitting}
                    className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 shadow-sm"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {editing ? 'Updating...' : 'Creating...'}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        {editing ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Update Instrument
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Create Instrument
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InstrumentsCRUD