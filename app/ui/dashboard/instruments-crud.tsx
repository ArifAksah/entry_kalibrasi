'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useInstruments } from '../../../hooks/useInstruments'
import { useAuth } from '../../../contexts/AuthContext'
import { Instrument, InstrumentInsert, Station } from '../../../lib/supabase'
import { usePermissions } from '../../../hooks/usePermissions'
import { useStations } from '../../../hooks/useStations'
import Alert from '../../../components/ui/Alert'
import { useAlert } from '../../../hooks/useAlert'
import Loading from '../../../components/ui/Loading'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import CustomSelect from '../../../components/ui/CustomSelect'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'
import { useUnits } from '../../../hooks/useUnits'

/**
 * Parses correction data from any historical DB format into a uniform array of
 * { setpoint: string, correction: string, u95: string } objects.
 *
 * Handles all formats:
 * 1. New schema: separate columns setpoint[], correction_std[], u95_std[]
 * 2. Old format: correction_std = [{setpoint, correction, u95}] (array of objects)
 * 3. Old format: correction_std = {koreksi: [...]} (object with "koreksi" key, no setpoint)
 * 4. Old format: correction_std = ["0.01", "0.02", ...] (primitive array, no setpoint)
 * 5. Sensor API: pre-built correction_data = [{setpoint, correction, u95}]
 */
function parseCorrectionData(cert: any): Array<{ setpoint: string; correction: string; u95: string }> {
  // Priority 1: correction_data already built as objects (from sensors API)
  if (Array.isArray(cert.correction_data) && cert.correction_data.length > 0 && typeof cert.correction_data[0] === 'object') {
    return cert.correction_data.map((d: any) => ({
      setpoint: String(d.setpoint ?? ''),
      correction: String(d.correction ?? ''),
      u95: String(d.u95 ?? '')
    }));
  }

  // Priority 2: New schema — separate setpoint[] + correction_std[] columns
  if (Array.isArray(cert.setpoint) && cert.setpoint.length > 0 && Array.isArray(cert.correction_std)) {
    return cert.setpoint.map((s: any, idx: number) => ({
      setpoint: String(s ?? ''),
      correction: String((cert.correction_std as any[])[idx] ?? ''),
      u95: String((Array.isArray(cert.u95_std) ? (cert.u95_std as any[])[idx] : '') ?? '')
    }));
  }

  // Priority 3: correction_std exists, try to parse it
  if (cert.correction_std) {
    const cs = cert.correction_std;

    // 3a: array of objects with known keys
    if (Array.isArray(cs) && cs.length > 0 && typeof cs[0] === 'object' && cs[0] !== null) {
      return cs.map((d: any) => ({
        setpoint: String(d.setpoint ?? ''),
        correction: String(d.correction ?? d.koreksi ?? ''),
        u95: String(d.u95 ?? d.u95_std ?? '')
      }));
    }

    // 3b: object (non-array) — e.g. {koreksi: [...], setpoint: [...]}
    if (!Array.isArray(cs) && typeof cs === 'object' && cs !== null) {
      const koreksiArr: any[] = cs.koreksi ?? cs.correction ?? cs.correction_std ?? [];
      const setpointArr: any[] = cs.setpoint ?? [];
      const u95Arr: any[] = cs.u95 ?? cs.u95_std ?? [];
      if (koreksiArr.length > 0) {
        return koreksiArr.map((k: any, idx: number) => ({
          setpoint: String(setpointArr[idx] ?? ''),
          correction: String(k ?? ''),
          u95: String(u95Arr[idx] ?? '')
        }));
      }
    }

    // 3c: primitive array — just correction values, no setpoint
    if (Array.isArray(cs) && cs.length > 0) {
      return cs.map((c: any) => ({
        setpoint: '',
        correction: String(c ?? ''),
        u95: ''
      }));
    }
  }

  return [];
}


const InstrumentsCRUD: React.FC = () => {
  const { instruments, loading, error, addInstrument, updateInstrument, deleteInstrument, fetchInstruments } = useInstruments()
  const { stations, loading: stationsLoading, fetchStations } = useStations()
  const { user } = useAuth()
  const { can, canEndpoint, role } = usePermissions()
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const { units, fetchUnits: fetchUnitsList } = useUnits()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<InstrumentInsert & { instrument_type_id?: number | null }>({
    manufacturer: '',
    type: '',
    serial_number: '',
    name: '',
    station_id: null,
    memiliki_lebih_satu: false,
    instrument_names_id: null,
    instrument_type_id: null,
  })

  // Lookup tables for dropdowns
  const [instrumentNames, setInstrumentNames] = useState<Array<{ id: number; name: string }>>([])
  const [instrumentTypes, setInstrumentTypes] = useState<Array<{ id: number; name: string }>>([])
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'instruments' | 'certStandard'>('instruments')
  const [filterType, setFilterType] = useState<'all' | 'uut' | 'standard'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stationSearch, setStationSearch] = useState('')
  const [showStationDropdown, setShowStationDropdown] = useState(false)




  // State untuk sensor form (kondisional) - sekarang array untuk multiple sensors
  const [sensorForms, setSensorForms] = useState<Array<{
    id: string;
    sensor_name_id: number | null;
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
    certificates?: Array<any>;
  }>>([])
  const [isLoadingSensors, setIsLoadingSensors] = useState(false)
  const [isStandardInstrument, setIsStandardInstrument] = useState(false)

  // State for Certificate Management
  const [selectedSensorForCert, setSelectedSensorForCert] = useState<string>('')
  const [editingSensorIndex, setEditingSensorIndex] = useState<number | null>(null)
  const [certList, setCertList] = useState<any[]>([])
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)
  const [editingCert, setEditingCert] = useState<any>(null)
  const [editingCertIndex, setEditingCertIndex] = useState<number | null>(null) // Track index for local array updates
  const [certForm, setCertForm] = useState({
    no_certificate: '',
    calibration_date: '',
    drift: 0,
    range: '',
    resolution: 0,
    u95_general: 0,
    correction_data: [] as Array<{ setpoint: string, correction: string, u95: string }>
  })

  // Fetch certificates when sensor selected in Cert Management tab
  useEffect(() => {
    if (activeTab === 'certStandard' && selectedSensorForCert) {
      const fetchCerts = async () => {
        try {
          const res = await fetch(`/api/cert-standards?sensor_id=${selectedSensorForCert}`)
          if (res.ok) {
            const data = await res.json()
            setCertList(data)
          }
        } catch (e) { console.error(e) }
      }
      fetchCerts()
    }
  }, [activeTab, selectedSensorForCert])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchInstruments({
      q: debouncedSearch,
      page: currentPage,
      pageSize,
      type: activeTab === 'certStandard' ? 'standard' : (filterType === 'all' ? undefined : filterType),
      userId: role !== 'admin' ? user?.id : undefined
    })
  }, [debouncedSearch, currentPage, activeTab, filterType, role, user, fetchInstruments])


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

  // Ensure sensor form exists for Single Instrument (Standard OR Non-Standard)
  useEffect(() => {
    if (!form.memiliki_lebih_satu && !isLoadingSensors) {
      // If single instrument, ensure exactly 1 sensor form exists
      if (sensorForms.length === 0) {
        addSensor(isStandardInstrument);
      } else if (sensorForms.length > 1) {
        setSensorForms([sensorForms[0]]);
      }

      // Sync is_standard property
      if (sensorForms.length > 0 && sensorForms[0].is_standard !== isStandardInstrument) {
        // Update the single sensor's standard status
        setSensorForms(prev => prev.map((s, i) => i === 0 ? { ...s, is_standard: isStandardInstrument } : s));
      }
    }
  }, [form.memiliki_lebih_satu, isLoadingSensors, isStandardInstrument, sensorForms.length]);

  // Debug sensorForms changes
  useEffect(() => {
    console.log('sensorForms updated:', sensorForms)
  }, [sensorForms]);

  // Fetch stations based on role
  useEffect(() => {
    const initStations = async () => {
      // Wait for role to be determined
      if (!role) return

      try {
        if (role === 'admin' || can('station', 'delete')) {
          // Admin sees all stations
          fetchStations({ pageSize: 1000 })
        } else {
          // Restricted user: fetch only assigned stations
          // We need the user object
          const { data: { user } } = await import('../../../lib/supabase').then(m => m.supabase.auth.getUser())
          if (user) {
            console.log('Fetching filtered stations for user:', user.id)
            fetchStations({ userId: user.id, pageSize: 1000 })
          }
        }
      } catch (e) {
        console.error('Failed to init stations:', e)
      }
    }


    if (role) {
      initStations()
      fetchUnitsList()
      // Fetch instrument_names for dropdown
      fetch('/api/instrument-names').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setInstrumentNames(data)
      }).catch(() => { })
      // Fetch instrument_types (Analog/Digital) for dropdown
      fetch('/api/instrument-types').then(r => r.json()).then(data => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        setInstrumentTypes(list)
      }).catch(() => { })
    }
  }, [role, can, fetchStations, fetchUnitsList])

  // Auto-select station for restricted users with single assignment
  useEffect(() => {
    // Only auto-select if:
    // 1. User is restricted (not admin and cannot delete/create stations)
    // 2. Exact 1 station is available
    // 3. Not editing (creating new implementation) OR editing but no station set yet (rare)
    // 4. No station is currently selected in form
    const isRestricted = role !== 'admin' && !can('station', 'delete')
    if (isRestricted && stations.length === 1 && !form.station_id) {
      const station = stations[0];
      setForm(prev => ({ ...prev, station_id: station.id }));
      setStationSearch(station.name);
    }
  }, [role, can, stations, form.station_id]);



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return instruments
    return instruments.filter(it => `${it.manufacturer} ${it.type} ${it.serial_number} ${it.name} ${it.station?.name ?? ''}`.toLowerCase().includes(q))
  }, [instruments, search])

  // Datalist for units
  const unitOptions = (
    <datalist id="unit-options">
      {units.map((u: any) => (
        <option key={u.id} value={u.unit} />
      ))}
    </datalist>
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered])
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage])

  const openModal = async (item?: Instrument) => {
    if (item) {
      setEditing(item)
      const formData = {
        manufacturer: item.manufacturer,
        type: item.type,
        serial_number: item.serial_number,
        name: item.name,
        station_id: item.station_id,
        memiliki_lebih_satu: item.memiliki_lebih_satu || false,
        instrument_names_id: (item as any).instrument_names_id || null,
        instrument_type_id: (item as any).instrument_type_id || null,
      }
      setForm(formData)

      // Load existing sensors if instrument has multi sensor
      // Do this AFTER setting the form to avoid race conditions
      // Load existing sensors for ALL instruments (Single or Multi)
      // Standard instruments (even Single) have sensors to store certificates
      setIsLoadingSensors(true)
      try {
        console.log('Loading sensors for instrument:', item.id)
        const res = await fetch(`/api/instruments/${item.id}/sensors`)
        console.log('Sensor API response status:', res.status)
        if (res.ok) {
          const sensors = await res.json()
          console.log('Loaded sensors:', sensors)
          // Ensure sensors array is not empty before setting
          if (Array.isArray(sensors) && sensors.length > 0) {
            console.log('Setting sensorForms with', sensors.length, 'sensors')
            setSensorForms(sensors)
          } else {
            console.log('No sensors found, setting empty array')
            setSensorForms([])
          }
        } else {
          const errorText = await res.text()
          console.error('Failed to load sensors:', res.status, res.statusText, errorText)
          setSensorForms([])
        }
      } catch (error) {
        console.error('Error loading sensors:', error)
        setSensorForms([])
      } finally {
        setIsLoadingSensors(false)
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
        instrument_names_id: null,
        instrument_type_id: null,
      })
      setSensorForms([])
    }
    setIsModalOpen(true)
  }

  // Effect to set up form defaults when opening modal
  useEffect(() => {
    if (isModalOpen && !editing && sensorForms.length === 0) {
      // logic for defaults
      // We don't necessarily default to standard unless user explicitly checks it now
    }
  }, [isModalOpen, editing])

  // Sync isStandardInstrument when editing
  useEffect(() => {
    if (isModalOpen && editing) {
      // Check if ANY loaded sensor is standard to determine if instrument is "Standard Mode"
      // or check activeTab context
      if (sensorForms.length > 0 && sensorForms.some(s => s.is_standard)) {
        setIsStandardInstrument(true)
      } else {
        // If editing standard instrument but sensors not yet loaded, we might default to activeTab if strict
        if (activeTab === 'certStandard' || filterType === 'standard') setIsStandardInstrument(true)
        else setIsStandardInstrument(false)
      }
    }
  }, [isModalOpen, editing, sensorForms.length])

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
    // Reset sensor forms
    setSensorForms([])
    setIsLoadingSensors(false)
  }

  // Fungsi untuk menambah sensor baru
  const addSensor = (isStandardOverride?: boolean) => {
    const isStandard = typeof isStandardOverride === 'boolean' ? isStandardOverride : isStandardInstrument;
    const newSensor = {
      id: `sensor_${Date.now()}`,
      sensor_name_id: null,
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
      is_standard: isStandard,
      certificates: []
    }
    setSensorForms(prev => [...prev, newSensor])
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
      // PREPARE SENSORS DATA
      // If Single Instrument -> Force Sync with Instrument Details
      let effectiveSensors = [...sensorForms];

      if (!form.memiliki_lebih_satu) {
        // Construct Synced Sensor
        const existingId = (editing && sensorForms.length > 0) ? sensorForms[0].id : `sensor_${Date.now()}`;
        const defaultCalibration: any = (sensorForms.length > 0) ? sensorForms[0] : {};

        const syncedSensor = {
          id: existingId,
          // FORCE SYNC IDENTITY
          nama_sensor: form.name,
          merk_sensor: form.manufacturer,
          tipe_sensor: form.type,
          serial_number_sensor: form.serial_number,
          // PRESERVE CALIBRATION DATA IF STANDARD, OR DEFAULTS
          // PRESERVE CALIBRATION DATA IF STANDARD, OR DEFAULTS
          range_capacity: (defaultCalibration.range_capacity || ''),
          range_capacity_unit: (defaultCalibration.range_capacity_unit || ''),
          graduating: (defaultCalibration.graduating || ''),
          graduating_unit: (defaultCalibration.graduating_unit || ''),
          funnel_diameter: (isStandardInstrument ? defaultCalibration.funnel_diameter : 0) || 0,
          funnel_diameter_unit: (isStandardInstrument ? defaultCalibration.funnel_diameter_unit : '') || '',
          volume_per_tip: (isStandardInstrument ? defaultCalibration.volume_per_tip : '') || '',
          volume_per_tip_unit: (isStandardInstrument ? defaultCalibration.volume_per_tip_unit : '') || '',
          funnel_area: (isStandardInstrument ? defaultCalibration.funnel_area : 0) || 0,
          funnel_area_unit: (isStandardInstrument ? defaultCalibration.funnel_area_unit : '') || '',
          is_standard: isStandardInstrument,
          certificates: defaultCalibration.certificates || []
        };
        effectiveSensors = [syncedSensor as any]; // Cast to any to match type signature if needed
      }

      if (editing) {
        await updateInstrument(editing.id, form)

        // Handle sensor data submission
        if (editing.id) {
          // Get existing sensors
          const existingRes = await fetch(`/api/instruments/${editing.id}/sensors`)
          const existingSensors = existingRes.ok ? await existingRes.json() : []

          // Delete existing sensors NOT in effectiveSensors
          for (const existingSensor of existingSensors) {
            const stillExists = effectiveSensors.some(sf => sf.id === existingSensor.id.toString())
            if (!stillExists) {
              await fetch(`/api/instruments/${editing.id}/sensors?sensorId=${existingSensor.id}`, {
                method: 'DELETE'
              })
            }
          }

          // Upsert effective sensors
          for (const sensorForm of effectiveSensors) {
            if (sensorForm.id.startsWith('sensor_')) {
              await fetch(`/api/instruments/${editing.id}/sensors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sensorForm)
              })
            } else {
              await fetch(`/api/instruments/${editing.id}/sensors`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sensorForm)
              })
            }
          }
        }
        showSuccess('Instrument updated successfully')

      } else {
        const newInstrument = await addInstrument(form)
        showSuccess('Instrument created successfully')

        // For new instruments, always create the sensor (Single or Multi)
        if (newInstrument && effectiveSensors.length > 0) {
          for (const sensorForm of effectiveSensors) {
            await fetch(`/api/instruments/${(newInstrument as any).id}/sensors`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sensorForm)
            })
          }
        }
      }
      // Refresh the list after successful operation
      fetchInstruments({
        q: search,
        page: currentPage,
        pageSize,
        type: activeTab === 'certStandard' ? 'standard' : (filterType === 'all' ? undefined : filterType),
        userId: role !== 'admin' ? user?.id : undefined
      })

      closeModal()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save instrument'
      showError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this instrument?')) return
    try {
      await deleteInstrument(id)
      showSuccess('Instrument deleted successfully')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete instrument'
      showError(msg)
    }
  }

  if (loading) {
    return (
      <Loading />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Instruments', href: '#' }, { label: 'Manager' }]} />
      </div>
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => { setActiveTab('instruments'); setCurrentPage(1); }}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'instruments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Daftar Instrumen
          </button>
          <button
            onClick={() => { setActiveTab('certStandard'); }}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'certStandard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Sertifikat Standar
          </button>
        </nav>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          {activeTab === 'instruments' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 font-medium">Filter:</span>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as any); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Instrumen</option>
                <option value="uut">Instrumen UUT</option>
                <option value="standard">Instrumen Standar</option>
              </select>
            </div>
          )}
          <h2 className="text-xl font-bold text-gray-800 border-l border-gray-300 pl-4">
            {activeTab === 'instruments' ? 'Daftar Instrumen' : 'Sertifikat Standar'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'instruments' && (
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Cari instrumen..."
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          )}

          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {can('instrument', 'create') && activeTab === 'instruments' && (
            <button
              onClick={() => openModal()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Baru
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}



      {/* Content for Certificate Management Tab */}
      {
        activeTab === 'certStandard' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Alat Standar (Sensor)</label>
              <select
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={selectedSensorForCert}
                onChange={(e) => setSelectedSensorForCert(e.target.value)}
              >
                <option value="">-- Pilih Sensor --</option>
                {/* Collect all standard sensors from loaded instruments (this is a simplification, might need separate fetch) */}
                {instruments.flatMap(i => (i.sensor || []).filter(s => s.is_standard).map(s => (
                  <option key={`${i.id}-${s.id}`} value={s.id}>
                    {s.name} - {s.type} ({s.serial_number}) - (Ref: {i.name})
                  </option>
                )))}
              </select>
            </div>

            {selectedSensorForCert && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Daftar Sertifikat</h3>
                  <button
                    onClick={() => {
                      setEditingCert(null)
                      setCertForm({
                        no_certificate: '',
                        calibration_date: new Date().toISOString().split('T')[0],
                        drift: 0,
                        range: '',
                        resolution: 0,
                        u95_general: 0,
                        correction_data: [{ setpoint: '', correction: '', u95: '' }]
                      })
                      setIsCertModalOpen(true)
                    }}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
                  >
                    + Tambah Sertifikat
                  </button>
                </div>

                {certList.length === 0 ? (
                  <p className="text-gray-500 italic">Belum ada sertifikat untuk sensor ini.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Sertifikat</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Kalibrasi</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drift</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">U95</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {certList.map((cert) => (
                          <tr key={cert.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cert.no_certificate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.calibration_date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.drift}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.u95_general}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={async () => {
                                  if (!confirm('Hapus sertifikat?')) return;
                                  await fetch(`/api/cert-standards/${cert.id}`, { method: 'DELETE' });
                                  setCertList(p => p.filter(c => c.id !== cert.id));
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                Hapus
                              </button>
                              <button
                                onClick={() => {
                                  const reconstructedData = parseCorrectionData(cert);

                                  setCertForm({
                                    no_certificate: cert.no_certificate,
                                    calibration_date: cert.calibration_date,
                                    drift: cert.drift,
                                    range: cert.range,
                                    resolution: cert.resolution,
                                    u95_general: cert.u95_general,
                                    correction_data: reconstructedData.length > 0 ? reconstructedData : [{ setpoint: '', correction: '', u95: '' }]
                                  });
                                  setEditingCert(cert); // For API updates
                                  setIsCertModalOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 ml-4"
                              >
                                Detail / Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }

      {/* Modal for Certificate */}
      {
        isCertModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCert ? 'Edit Sertifikat' : 'Tambah Sertifikat Standar'}
                </h3>
                <button onClick={() => setIsCertModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // Get sensor_id from context:
                  // - If editing from Instrument Modal: use actual DB sensor ID from sensorForms
                  // - If editing from Certificate Standard Tab: use selectedSensorForCert
                  const activeSensorId = editingSensorIndex !== null
                    ? (() => {
                      const sf = sensorForms[editingSensorIndex];
                      // sf.id may be a temp string like 'sensor_123' or a real DB id
                      const parsed = parseInt(sf?.id);
                      return isNaN(parsed) ? null : parsed;
                    })()
                    : parseInt(selectedSensorForCert);

                  const payload = {
                    sensor_id: activeSensorId,
                    no_certificate: certForm.no_certificate,
                    calibration_date: certForm.calibration_date,
                    drift: Number(certForm.drift),
                    range: certForm.range,
                    resolution: Number(certForm.resolution),
                    u95_general: Number(certForm.u95_general),
                    correction_data: certForm.correction_data, // JSONB or JSON column
                    id: (editingSensorIndex !== null && editingCertIndex !== null)
                      ? sensorForms[editingSensorIndex]?.certificates?.[editingCertIndex]?.id
                      : undefined
                  }


                  if (editingSensorIndex !== null) {
                    // Update local sensorForms (Instrument Modal)

                    // Check if we are updating an existing certificate with an ID
                    const existingCertId = (editingCertIndex !== null)
                      ? sensorForms[editingSensorIndex]?.certificates?.[editingCertIndex]?.id
                      : undefined;

                    if (existingCertId) {
                      // Immediate API Update for existing certificate
                      const res = await fetch(`/api/cert-standards/${existingCertId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });

                      if (res.ok) {
                        const updated = await res.json();

                        setSensorForms(prev => prev.map((s, i) => {
                          if (i === editingSensorIndex) {
                            const currentCerts = s.certificates || [];
                            const updatedCerts = [...currentCerts];
                            updatedCerts[editingCertIndex!] = {
                              ...updated,
                              // Use the payload's correction_data as it is already the correct array of objects
                              // and matches what was just successfully saved.
                              correction_data: payload.correction_data
                            };
                            return { ...s, certificates: updatedCerts };
                          }
                          return s;
                        }));
                        setIsCertModalOpen(false);
                        setEditingSensorIndex(null);
                        setEditingCertIndex(null);
                        showSuccess('Sertifikat berhasil diperbarui');
                      } else {
                        const err = await res.json();
                        showError(err.error || 'Gagal memperbarui sertifikat');
                      }
                    } else {
                      // Local update for new (unsaved) certificates
                      setSensorForms(prev => prev.map((s, i) => {
                        if (i === editingSensorIndex) {
                          const currentCerts = s.certificates || [];
                          if (editingCertIndex !== null) {
                            // Update existing local-only cert
                            const updatedCerts = [...currentCerts];
                            updatedCerts[editingCertIndex] = payload;
                            return { ...s, certificates: updatedCerts };
                          } else {
                            // Add new cert
                            return { ...s, certificates: [...currentCerts, payload] };
                          }
                        }
                        return s
                      }))
                      setIsCertModalOpen(false)
                      setEditingSensorIndex(null)
                      setEditingCertIndex(null)
                    }
                  } else {
                    // API Updates (Certificate Standard Tab)
                    if (editingCert) {
                      // Update existing API cert
                      const res = await fetch(`/api/cert-standards/${editingCert.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      if (res.ok) {
                        const updated = await res.json();
                        setCertList(p => p.map(c => c.id === editingCert.id ? updated : c));
                        setIsCertModalOpen(false);
                        setEditingCert(null);
                        showSuccess('Sertifikat berhasil diperbarui');
                      } else {
                        const err = await res.json();
                        showError(err.error);
                      }
                    } else {
                      // Create new API cert
                      const res = await fetch('/api/cert-standards', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });

                      if (res.ok) {
                        const newCert = await res.json();
                        setCertList(p => [newCert, ...p]);
                        setIsCertModalOpen(false);
                        showSuccess('Sertifikat berhasil ditambahkan');
                      } else {
                        const err = await res.json();
                        showError(err.error);
                      }
                    }
                  }
                } catch (err: any) { showError(err.message) }
              }}>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">No. Sertifikat</label>
                      <input required type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.no_certificate} onChange={e => setCertForm({ ...certForm, no_certificate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tgl Kalibrasi</label>
                      <input required type="date" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.calibration_date} onChange={e => setCertForm({ ...certForm, calibration_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Range</label>
                      <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.range} onChange={e => setCertForm({ ...certForm, range: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resolusi</label>
                      <input type="number" step="any" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.resolution} onChange={e => setCertForm({ ...certForm, resolution: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Drift</label>
                      <input type="number" step="any" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.drift} onChange={e => setCertForm({ ...certForm, drift: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">U95 General</label>
                      <input type="number" step="any" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={certForm.u95_general} onChange={e => setCertForm({ ...certForm, u95_general: parseFloat(e.target.value) })} />
                    </div>
                  </div>

                  {/* Correction Table */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tabel Koreksi & Ketidakpastian</label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Setpoint</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Koreksi</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">U95</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {certForm.correction_data.map((rawRow, idx) => {
                            // Defensive check: Handle primitive strings if they sneak into state
                            const row = (rawRow && typeof rawRow === 'object')
                              ? rawRow
                              : { setpoint: '', correction: String(rawRow || ''), u95: '' };

                            return (
                              <tr key={idx}>
                                <td className="px-2 py-1">
                                  <input type="text" className="w-full border-gray-300 rounded text-sm" placeholder="ex: 800"
                                    value={row.setpoint}
                                    onChange={e => {
                                      const newData = [...certForm.correction_data];
                                      // Ensure we are working with an object
                                      if (typeof newData[idx] !== 'object' || newData[idx] === null) {
                                        newData[idx] = { setpoint: '', correction: String(newData[idx] || ''), u95: '' };
                                      }
                                      newData[idx].setpoint = e.target.value;
                                      setCertForm({ ...certForm, correction_data: newData });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <input type="text" className="w-full border-gray-300 rounded text-sm" placeholder="ex: 0.02"
                                    value={row.correction}
                                    onChange={e => {
                                      const newData = [...certForm.correction_data];
                                      // Ensure we are working with an object
                                      if (typeof newData[idx] !== 'object' || newData[idx] === null) {
                                        newData[idx] = { setpoint: '', correction: String(newData[idx] || ''), u95: '' };
                                      }
                                      newData[idx].correction = e.target.value;
                                      setCertForm({ ...certForm, correction_data: newData });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <input type="text" className="w-full border-gray-300 rounded text-sm" placeholder="ex: 0.14"
                                    value={row.u95}
                                    onChange={e => {
                                      const newData = [...certForm.correction_data];
                                      // Ensure we are working with an object
                                      if (typeof newData[idx] !== 'object' || newData[idx] === null) {
                                        newData[idx] = { setpoint: '', correction: String(newData[idx] || ''), u95: '' };
                                      }
                                      newData[idx].u95 = e.target.value;
                                      setCertForm({ ...certForm, correction_data: newData });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <button type="button" onClick={() => {
                                    const newData = certForm.correction_data.filter((_, i) => i !== idx);
                                    setCertForm({ ...certForm, correction_data: newData });
                                  }} className="text-red-500 hover:text-red-700">
                                    &times;
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <button type="button"
                        onClick={() => setCertForm({ ...certForm, correction_data: [...certForm.correction_data, { setpoint: '', correction: '', u95: '' }] })}
                        className="w-full py-2 bg-gray-50 text-xs text-blue-600 font-medium hover:bg-gray-100 border-t"
                      >
                        + Tambah Baris
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 text-right flex justify-end gap-3">
                  <button type="button" onClick={() => setIsCertModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Batal
                  </button>
                  <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Existing Table Code but wrapped to only show when activeTab is not certStandard */}
      {
        activeTab !== 'certStandard' && (
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
                        <div className="flex items-center">
                          <span className="font-medium">{item.name}</span>
                          {item.sensor?.some(s => s.is_standard) && (
                            <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Standard
                            </span>
                          )}
                        </div>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.memiliki_lebih_satu
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}>
                          {item.memiliki_lebih_satu ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {can('instrument', 'update') && canEndpoint('PUT', `/api/instruments/${item.id}`) && (
                          <EditButton onClick={() => openModal(item)} title="Edit Instrument" />
                        )}
                        {can('instrument', 'delete') && canEndpoint('DELETE', `/api/instruments/${item.id}`) && (
                          <DeleteButton onClick={() => handleDelete(item.id)} title="Delete Instrument" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg shadow">
        <div className="text-sm text-gray-600">Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span></div>
        <div className="inline-flex items-center gap-2">
          <button className={`px-3 py-1 rounded border ${currentPage === 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</button>
          <button className={`px-3 py-1 rounded border ${currentPage === 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</button>
          <button className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
          <button className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</button>
        </div>
      </div>

      {/* Modal dengan scroll dan layout yang lebih baik */}
      {
        isModalOpen && can('instrument', editing ? 'update' : 'create') && (
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
                  {unitOptions}
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
                          <CustomSelect
                            options={instrumentNames.map(n => ({ value: n.id, label: n.name }))}
                            value={form.instrument_names_id}
                            onChange={(val) => setForm({ ...form, instrument_names_id: val ? Number(val) : null })}
                            placeholder="-- Pilih Nama Instrumen --"
                            clearable={false}
                          />
                        </div>
                        {/* Instrument Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipe Instrumen <span className="text-gray-400 font-normal text-xs">(opsional)</span>
                          </label>
                          <div className="flex gap-3">
                            {/* Tidak dipilih */}
                            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all duration-150 ${!(form as any).instrument_type_id
                              ? 'border-gray-400 bg-gray-100'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}>
                              <input
                                type="radio"
                                name="instrument_type_id"
                                value=""
                                checked={!(form as any).instrument_type_id}
                                onChange={() => setForm({ ...form, instrument_type_id: null } as any)}
                                className="sr-only"
                              />
                              <span className="text-sm font-medium text-gray-500">Tidak dipilih</span>
                            </label>
                            {/* Render dari instrumentTypes */}
                            {instrumentTypes.map(t => (
                              <label key={t.id} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all duration-150 ${(form as any).instrument_type_id === t.id
                                ? t.name === 'Digital'
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                                }`}>
                                <input
                                  type="radio"
                                  name="instrument_type_id"
                                  value={t.id}
                                  checked={(form as any).instrument_type_id === t.id}
                                  onChange={() => setForm({ ...form, instrument_type_id: t.id } as any)}
                                  className="sr-only"
                                />
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${(form as any).instrument_type_id === t.id
                                  ? t.name === 'Digital' ? 'bg-green-500' : 'bg-orange-500'
                                  : 'bg-gray-300'
                                  }`} />
                                <span className="text-sm font-semibold">{t.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Alias - disimpan ke kolom name */}
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Alias <span className="text-gray-400 font-normal text-xs">(nama khusus alat, wajib)</span>
                          </label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="Contoh: AWS Lapangan 3, Termometer Ruang Server..."
                            required
                          />
                          <p className="text-xs text-gray-400 mt-1">Nama unik untuk membedakan alat ini dari alat sejenis</p>
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
                                {role === 'admin' && (
                                  <div
                                    className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                                    onMouseDown={() => {
                                      setForm({ ...form, station_id: null });
                                      setStationSearch('');
                                    }}
                                  >
                                    <span className="text-gray-500">No station selected</span>
                                  </div>
                                )}
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

                        {/* Checkbox Instrument Standard */}
                        <div className="lg:col-span-2 mt-2">
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="is_standard_instrument"
                                checked={isStandardInstrument}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setIsStandardInstrument(isChecked);
                                  // Update ALL sensors to match this setting
                                  setSensorForms(prev => prev.map(s => ({ ...s, is_standard: isChecked })));
                                }}
                                className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                              <label htmlFor="is_standard_instrument" className="text-sm font-medium text-gray-700">
                                Jadikan Sebagai Alat Standar
                              </label>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 ml-8">
                              Jika dicentang, semua sensor yang ditambahkan otomatis dianggap sebagai <strong>Sensor Standar</strong> (memiliki sertifikat).
                              Jika tidak multi-sensor, sertifikat akan ditambahkan langsung ke alat ini.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Single Non-Standard Sensor Form (When NOT Multi-Sensor AND NOT Standard) */}
                    {!form.memiliki_lebih_satu && !isStandardInstrument && sensorForms.length > 0 && (
                      <div className="bg-white rounded-lg p-6 border border-gray-200 mt-6 shadow-sm">
                        <div className="flex items-center mb-6">
                          <div className="bg-blue-100 rounded-full p-2 mr-3">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">Spesifikasi Alat</h4>
                            <p className="text-sm text-gray-500">Lengkapi data teknis (Range & Resolution) untuk alat ini.</p>
                          </div>
                        </div>

                        {sensorForms.map((sensor) => (
                          <div key={sensor.id}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Range Capacity</label>
                                <div className="flex gap-2">
                                  <input
                                    value={sensor.range_capacity}
                                    onChange={(e) => updateSensor(sensor.id, 'range_capacity', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: 0-100"
                                  />
                                  <input
                                    value={sensor.range_capacity_unit}
                                    onChange={(e) => updateSensor(sensor.id, 'range_capacity_unit', e.target.value)}
                                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                                    placeholder="Unit"
                                    list="unit-options"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Graduating / Resolution</label>
                                <div className="flex gap-2">
                                  <input
                                    value={sensor.graduating}
                                    onChange={(e) => updateSensor(sensor.id, 'graduating', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: 0.01"
                                  />
                                  <input
                                    value={sensor.graduating_unit}
                                    onChange={(e) => updateSensor(sensor.id, 'graduating_unit', e.target.value)}
                                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                                    placeholder="Unit"
                                    list="unit-options"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Single Standard Sensor Form (When NOT Multi-Sensor but IS Standard) */}
                    {!form.memiliki_lebih_satu && isStandardInstrument && sensorForms.length > 0 && (
                      <div className="bg-white rounded-lg p-6 border border-orange-200 mt-6 shadow-sm">
                        <div className="flex items-center mb-6">
                          <div className="bg-orange-100 rounded-full p-2 mr-3">
                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">Spesifikasi & Sertifikat Standar</h4>
                            <p className="text-sm text-gray-500">Lengkapi data teknis dan sertifikat untuk alat standar ini.</p>
                          </div>
                        </div>

                        {sensorForms.map((sensor, index) => (
                          <div key={sensor.id}> {/* Should be only 1 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              {/* Range & Graduating REMOVED for Standard Instrument - Handled in Certificate */}
                              <div className="col-span-2">
                                <p className="text-sm text-gray-500 italic">
                                  Untuk alat standar, Range dan Resolusi diinputkan pada detail Sertifikat Standar dibawah ini.
                                </p>
                              </div>
                            </div>

                            {/* Certificate Section */}
                            <div className="mt-6 pt-6 border-t border-gray-100">
                              <div className="flex justify-between items-center mb-4">
                                <h6 className="text-sm font-semibold text-gray-800 flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Sertifikat Standar
                                </h6>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCertForm({
                                      no_certificate: '',
                                      calibration_date: '',
                                      drift: 0,
                                      range: '',
                                      resolution: 0,
                                      u95_general: 0,
                                      correction_data: []
                                    });
                                    setEditingSensorIndex(index);
                                    setIsCertModalOpen(true);
                                  }}
                                  className="text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors shadow-sm flex items-center"
                                >
                                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Tambah Sertifikat
                                </button>
                              </div>

                              {sensor.certificates && sensor.certificates.length > 0 ? (
                                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Sertifikat</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Kalibrasi</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {sensor.certificates.map((cert: any, certIdx: number) => (
                                        <tr key={certIdx}>
                                          <td className="px-4 py-2 text-sm text-gray-900">{cert.no_certificate}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{cert.calibration_date}</td>
                                          <td className="px-4 py-2 text-right text-sm font-medium">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!confirm('Hapus sertifikat?')) return;

                                                if (cert.id) {
                                                  try {
                                                    const res = await fetch(`/api/cert-standards/${cert.id}`, { method: 'DELETE' });
                                                    if (!res.ok) throw new Error('Failed to delete');

                                                    setSensorForms(prev => prev.map((s, i) => {
                                                      if (i === index && s.certificates) {
                                                        const newCerts = [...s.certificates];
                                                        newCerts.splice(certIdx, 1);
                                                        return { ...s, certificates: newCerts };
                                                      }
                                                      return s;
                                                    }));
                                                    showSuccess('Sertifikat berhasil dihapus');
                                                  } catch (e) {
                                                    console.error(e);
                                                    showError('Gagal menghapus sertifikat');
                                                  }
                                                } else {
                                                  setSensorForms(prev => prev.map((s, i) => {
                                                    if (i === index && s.certificates) {
                                                      const newCerts = [...s.certificates];
                                                      newCerts.splice(certIdx, 1);
                                                      return { ...s, certificates: newCerts };
                                                    }
                                                    return s;
                                                  }));
                                                }
                                              }}
                                              className="text-red-600 hover:text-red-900"
                                            >
                                              Hapus
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const reconstructedData = parseCorrectionData(cert);

                                                setCertForm({
                                                  no_certificate: cert.no_certificate,
                                                  calibration_date: cert.calibration_date,
                                                  drift: cert.drift,
                                                  range: cert.range,
                                                  resolution: cert.resolution,
                                                  u95_general: cert.u95_general,
                                                  correction_data: reconstructedData.length > 0 ? reconstructedData : [{ setpoint: '', correction: '', u95: '' }]
                                                });
                                                setEditingSensorIndex(index);
                                                setEditingCertIndex(certIdx);
                                                setIsCertModalOpen(true);
                                              }}
                                              className="text-blue-600 hover:text-blue-900 ml-4"
                                            >
                                              Detail / Edit
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                  <p className="text-sm text-gray-500">Belum ada sertifikat. Klik tombol Tambah Sertifikat diatas.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sensor Information - Conditional */}
                    {form.memiliki_lebih_satu && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                        <div className="flex items-center justify-between mb-6 sticky top-0 z-20 bg-gradient-to-r from-blue-50 to-indigo-50 -mx-6 px-6 py-3 border-b border-blue-200 shadow-sm">
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
                            onClick={() => addSensor(activeTab === 'certStandard' || filterType === 'standard')}
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
                                  {/* Nama Sensor dropdown → simpan sensor_name_id */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Nama Sensor
                                    </label>
                                    <CustomSelect
                                      options={instrumentNames.map(n => ({ value: n.id, label: n.name }))}
                                      value={sensor.sensor_name_id}
                                      onChange={(val) => updateSensor(sensor.id, 'sensor_name_id', val ? Number(val) : null)}
                                      placeholder="-- Pilih Nama Sensor --"
                                      clearLabel="— Tidak dipilih"
                                    />
                                  </div>
                                  {/* Alias Sensor → simpan ke kolom name */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Alias Sensor <span className="text-gray-400 font-normal text-xs">(nama khusus sensor)</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={sensor.nama_sensor}
                                      onChange={(e) => updateSensor(sensor.id, 'nama_sensor', e.target.value)}
                                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="Contoh: Sensor Suhu Ruang A..."
                                    />
                                  </div>
                                  {/* Merk Sensor */}
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
                                      list="unit-options"
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
                                      list="unit-options"
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
                                      list="unit-options"
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
                                      list="unit-options"
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
                                      list="unit-options"
                                    />
                                  </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
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

                                  {sensor.is_standard && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCertForm({
                                          no_certificate: '',
                                          calibration_date: '',
                                          drift: 0,
                                          range: '',
                                          resolution: 0,
                                          u95_general: 0,
                                          correction_data: []
                                        });
                                        setEditingSensorIndex(index);
                                        setEditingCertIndex(null); // Ensure creation mode
                                        setIsCertModalOpen(true);
                                      }}
                                      className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors font-medium flex items-center border border-blue-200"
                                    >
                                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      Tambah Sertifikat
                                    </button>
                                  )}
                                </div>

                                {/* Nested Certificate Management for Standard Sensors */}
                                {sensor.is_standard && sensor.certificates && sensor.certificates.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-100">
                                    <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Daftar Sertifikat</h6>
                                    {/* List of pending certificates */}
                                    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Sertifikat</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Kalibrasi</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {sensor.certificates.map((cert: any, certIdx: number) => (
                                            <tr key={certIdx}>
                                              <td className="px-4 py-2 text-sm text-gray-900">{cert.no_certificate}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900">{cert.calibration_date}</td>
                                              <td className="px-4 py-2 text-right text-sm font-medium">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSensorForms(prev => prev.map((s, i) => {
                                                      if (i === index && s.certificates) {
                                                        const newCerts = [...s.certificates];
                                                        newCerts.splice(certIdx, 1);
                                                        return { ...s, certificates: newCerts };
                                                      }
                                                      return s;
                                                    }))
                                                  }}
                                                  className="text-red-600 hover:text-red-900"
                                                >
                                                  Hapus
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const reconstructedData = parseCorrectionData(cert);
                                                    setCertForm({
                                                      no_certificate: cert.no_certificate,
                                                      calibration_date: cert.calibration_date,
                                                      drift: cert.drift,
                                                      range: cert.range,
                                                      resolution: cert.resolution,
                                                      u95_general: cert.u95_general,
                                                      correction_data: reconstructedData.length > 0 ? reconstructedData : [{ setpoint: '', correction: '', u95: '' }]
                                                    });
                                                    setEditingSensorIndex(index);
                                                    setEditingCertIndex(certIdx);
                                                    setIsCertModalOpen(true);
                                                  }}
                                                  className="text-blue-600 hover:text-blue-900 ml-4"
                                                >
                                                  Detail / Edit
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
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
            </div >
          </div >
        )
      }
    </div >
  )
}

export default InstrumentsCRUD