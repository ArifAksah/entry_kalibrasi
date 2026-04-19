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
import UnitSelect from '../../../components/ui/UnitSelect'
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

const SearchableDropdown = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  className = '',
}: {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: Array<{ id: string | number; name: string; description?: string }>
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const selectedOption = options.find(option => option.id === value)
  const filteredOptions = options.filter(option => {
    const q = searchTerm.toLowerCase()
    return option.name.toLowerCase().includes(q) || (option.description || '').toLowerCase().includes(q)
  })

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption?.name || placeholder}
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 top-full mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{option.name}</div>
                    {option.description && <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">Tidak ada data ditemukan</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
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
    resolution?: number | null;
    funnel_diameter: number;
    funnel_diameter_unit: string;
    volume_per_tip: string;
    volume_per_tip_unit: string;
    funnel_area: number;
    funnel_area_unit: string;
    is_standard: boolean;
    tracebility?: string;
    certificates?: Array<any>;
    drift?: number;
    u95_general?: number;
    correction_data?: Array<{ setpoint: string, correction: string, u95: string }>;
  }>>([])
  const [isLoadingSensors, setIsLoadingSensors] = useState(false)
  const [isStandardInstrument, setIsStandardInstrument] = useState(false)
  // Global certificates for standard instrument
  // Each cert has sensorData[] — drift/u95/correction_data belong to each sensor
  const [globalCertificates, setGlobalCertificates] = useState<Array<{
    no_certificate: string,
    calibration_date: string,
    expanded?: boolean,
    sensorData: Array<{
      sensorLocalId: string,   // matches sensorForms[i].id
      drift: number,
      u95_general: number,
      correction_data: Array<{setpoint: string, correction: string, u95: string}>,
      dbCertId?: number        // certificate_standard.id for this sensor+cert row
    }>
  }>>([])
  const [newGlobalCert, setNewGlobalCert] = useState({
    no_certificate: '',
    calibration_date: '',
  })
  const [newGlobalCertError, setNewGlobalCertError] = useState('')

  // State for Certificate Management
  const [standardSensors, setStandardSensors] = useState<Array<{
    id: number;
    name: string;
    manufacturer: string;
    type: string;
    serial_number: string;
    range_capacity: string;
    range_capacity_unit: string;
    instrument: { id: number; name: string; manufacturer: string; type: string; serial_number: string } | null;
  }>>([])  
  const [selectedSensorForCert, setSelectedSensorForCert] = useState<string>('')
  const [editingSensorIndex, setEditingSensorIndex] = useState<number | null>(null)
  const [certList, setCertList] = useState<any[]>([])
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)
  const [editingCert, setEditingCert] = useState<any>(null)
  const [editingCertIndex, setEditingCertIndex] = useState<number | null>(null) // Track index for local array updates
  const [certForm, setCertForm] = useState({
    no_certificate: '',
    calibration_date: '',
    drift: 0 as number,
    range: '',
    resolution: 0 as number,
    u95_general: 0 as number,
    correction_data: [] as Array<{ setpoint: string, correction: string, u95: string }>
  })

  // Fetch all standard sensors when entering certStandard tab
  useEffect(() => {
    if (activeTab === 'certStandard') {
      fetch('/api/sensors/standard')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setStandardSensors(data)
        })
        .catch(e => console.error('Failed to fetch standard sensors:', e))
    }
  }, [activeTab])

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
    } else if (activeTab === 'certStandard' && !selectedSensorForCert) {
      setCertList([])
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
            
            // Build per-cert, per-sensor data structure
            // Group all sensor certificates by no_certificate
            const certsMap = new Map<string, any>();

            const processedSensors = sensors.map((sensor: any) => {
              const range_capacity = sensor.range_capacity || '';
              const resolution = sensor.resolution || 0;

              if (sensor.certificates && sensor.certificates.length > 0) {
                sensor.certificates.forEach((c: any) => {
                  if (!certsMap.has(c.no_certificate)) {
                    certsMap.set(c.no_certificate, {
                      no_certificate: c.no_certificate,
                      calibration_date: c.calibration_date,
                      expanded: false,
                      sensorData: []
                    });
                  }
                  certsMap.get(c.no_certificate).sensorData.push({
                    sensorLocalId: sensor.id.toString(),
                    drift: c.drift || 0,
                    u95_general: c.u95_general || 0,
                    correction_data: c.correction_data || [],
                    dbCertId: c.id
                  });
                });
              }

              return { ...sensor, range_capacity, resolution };
            });

            setSensorForms(processedSensors)
            setGlobalCertificates(Array.from(certsMap.values()))
            // Directly set isStandardInstrument based on loaded sensors (fixes race condition)
            const anyStandard = processedSensors.some((s: any) => s.is_standard);
            setIsStandardInstrument(anyStandard);
          } else {
            console.log('No sensors found, setting empty array')
            setSensorForms([])
            setGlobalCertificates([])
            setIsStandardInstrument(false);
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

  // isStandardInstrument is now set directly inside openModal after sensors load.
  // No useEffect needed here — removing to fix race condition.

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
      tracebility: '',
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
        const res = await fetch(`/api/instruments/${editing.id}/sensors?sensorId=${sensorId}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          const errMsg = errData?.error || `Gagal menghapus sensor (HTTP ${res.status})`
          showError(errMsg)
          console.error('Error deleting sensor:', errMsg)
          return // DO NOT remove from local state if server delete failed
        }
      } catch (error) {
        console.error('Error deleting sensor:', error)
        showError('Gagal menghapus sensor: koneksi bermasalah')
        return
      }
    }

    // Only remove from local state if delete succeeded (or it's a new unsaved sensor)
    setSensorForms(prev => prev.filter(sensor => sensor.id !== sensorId))
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
          drift: defaultCalibration.drift || 0,
          u95_general: defaultCalibration.u95_general || 0,
          resolution: defaultCalibration.resolution || 0,
          correction_data: defaultCalibration.correction_data || [],
          is_standard: isStandardInstrument,
          tracebility: defaultCalibration.tracebility || '',
          certificates: defaultCalibration.certificates || []
        };
        effectiveSensors = [syncedSensor as any]; // Cast to any to match type signature if needed
      }

      // MERGE GLOBAL CERTIFICATES — each cert × each sensor has its own drift/u95/correction_data
      if (isStandardInstrument && globalCertificates.length > 0) {
        effectiveSensors = effectiveSensors.map(sensor => {
          const mergedCerts = globalCertificates.map(gc => {
            // Find this sensor's specific data within the cert
            const sd = gc.sensorData?.find((d: any) => d.sensorLocalId === sensor.id) ||
              { drift: 0, u95_general: 0, correction_data: [], dbCertId: undefined };
            return {
              id: sd.dbCertId,
              no_certificate: gc.no_certificate,
              calibration_date: gc.calibration_date,
              drift: Number(sd.drift) || 0,
              range: sensor.range_capacity || '',
              resolution: Number(sensor.resolution) || 0,
              u95_general: Number(sd.u95_general) || 0,
              correction_data: sd.correction_data || []
            };
          });
          return { ...sensor, certificates: mergedCerts };
        });
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
              const delRes = await fetch(`/api/instruments/${editing.id}/sensors?sensorId=${existingSensor.id}`, {
                method: 'DELETE'
              })
              if (!delRes.ok) {
                const errData = await delRes.json().catch(() => ({}))
                console.error('Failed to delete sensor during save:', errData?.error)
                // Continue saving other sensors even if one delete fails
              }
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

      

      
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 font-medium">Filter:</span>
            <SearchableDropdown
              value={filterType}
              onChange={(val) => {
                setFilterType((val || 'all') as 'all' | 'uut' | 'standard')
                setCurrentPage(1)
              }}
              options={[
                { id: 'all', name: 'Semua Instrumen' },
                { id: 'uut', name: 'Instrumen UUT' },
                { id: 'standard', name: 'Instrumen Standar' },
              ]}
              placeholder="Pilih filter"
              searchPlaceholder="Cari filter..."
              className="w-48"
            />
          </div>
          <h2 className="text-xl font-bold text-gray-800 border-l border-gray-300 pl-4">
            Daftar Instrumen
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Cari instrumen..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />

          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {can('instrument', 'create') && (
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



      
      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
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
                          <SearchableDropdown
                            options={instrumentNames.map(n => ({ id: n.id, name: n.name }))}
                            value={form.instrument_names_id ?? null}
                            onChange={(val) => setForm({ ...form, instrument_names_id: val ? Number(val) : null })}
                            placeholder="Pilih Nama Instrumen"
                            searchPlaceholder="Cari nama instrumen..."
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
                        {/* Manufacturer | Type | Serial Number — satu baris */}
                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        {/* Global Certificates for Standard Instrument */}
                        {isStandardInstrument && (
                          <div className="lg:col-span-2 mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4 border-b pb-3">
                              <div>
                                <h4 className="text-md font-semibold text-gray-800">Daftar Sertifikat</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Tiap sertifikat berisi data teknis (drift, U95, koreksi) per sensor.</p>
                              </div>
                            </div>
                            
                            {/* Existing certificate cards */}
                            <div className="space-y-3 mb-5">
                              {globalCertificates.map((cert, certIdx) => (
                                <div key={certIdx} className="border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                                  {/* Certificate header */}
                                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50">
                                    <div className="flex items-center gap-3 text-sm">
                                      <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div>
                                        <span className="font-bold text-gray-900">{cert.no_certificate}</span>
                                        <span className="text-gray-500 ml-3 text-xs">{cert.calibration_date}</span>
                                      </div>
                                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{cert.sensorData?.length || 0} sensor</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button type="button"
                                        onClick={() => setGlobalCertificates(prev => prev.map((c, i) => i === certIdx ? {...c, expanded: !c.expanded} : c))}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                                        {cert.expanded ? '▲ Tutup' : '▼ Lihat / Edit Data Sensor'}
                                      </button>
                                      <button type="button"
                                        onClick={() => { if(confirm('Hapus sertifikat ini beserta seluruh datanya?')) setGlobalCertificates(prev => prev.filter((_,i) => i !== certIdx)); }}
                                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                                        Hapus
                                      </button>
                                    </div>
                                  </div>

                                  {/* Editable cert header (inline) */}
                                  {cert.expanded && (
                                    <div className="px-4 py-3 bg-amber-50/60 border-t border-orange-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Nomor Sertifikat</label>
                                        <input type="text" value={cert.no_certificate}
                                          onChange={e => setGlobalCertificates(prev => prev.map((c,i) => i===certIdx ? {...c, no_certificate: e.target.value} : c))}
                                          className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-orange-400 focus:border-orange-400 bg-white"/>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Kalibrasi</label>
                                        <input type="date" value={cert.calibration_date}
                                          onChange={e => setGlobalCertificates(prev => prev.map((c,i) => i===certIdx ? {...c, calibration_date: e.target.value} : c))}
                                          className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-orange-400 focus:border-orange-400 bg-white"/>
                                      </div>
                                    </div>
                                  )}

                                  {/* Per-sensor data cards — full sensor form integrated inside cert card */}
                                  {cert.expanded && (
                                    <div className="border-t border-orange-100 bg-white">
                                      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sensor Yang Dikalibrasi</p>
                                        <button type="button"
                                          onClick={() => {
                                            const newSensorId = `sensor_${Date.now()}`;
                                            const newSensor = {
                                              id: newSensorId,
                                              sensor_name_id: null,
                                              nama_sensor: '',
                                              merk_sensor: '',
                                              tipe_sensor: '',
                                              serial_number_sensor: '',
                                              range_capacity: '',
                                              range_capacity_unit: '',
                                              graduating: '',
                                              graduating_unit: '',
                                              resolution: null,
                                              funnel_diameter: 0,
                                              funnel_diameter_unit: '',
                                              volume_per_tip: '',
                                              volume_per_tip_unit: '',
                                              funnel_area: 0,
                                              funnel_area_unit: '',
                                              is_standard: true,
                                              tracebility: '',
                                              certificates: []
                                            };
                                            setSensorForms(prev => [...prev, newSensor]);
                                            setGlobalCertificates(prev => prev.map((c, ci) => {
                                              if (ci !== certIdx) return c;
                                              return { ...c, sensorData: [...(c.sensorData || []), { sensorLocalId: newSensorId, drift: 0, u95_general: 0, correction_data: [] }] };
                                            }));
                                          }}
                                          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                          + Tambah Sensor
                                        </button>
                                      </div>
                                      {(!cert.sensorData || cert.sensorData.length === 0) && (
                                        <p className="px-4 pb-4 text-xs text-gray-400 italic">Belum ada sensor. Klik "+ Tambah Sensor" untuk menambahkan sensor ke sertifikat ini.</p>
                                      )}
                                      <div className="px-4 pb-4 space-y-5">
                                      {(cert.sensorData || []).map((sd: any, sIdx: number) => {
                                        const sensor = sensorForms.find(s => s.id === sd.sensorLocalId) || {
                                          id: sd.sensorLocalId, sensor_name_id: null,
                                          nama_sensor: '', merk_sensor: '', tipe_sensor: '',
                                          serial_number_sensor: '', range_capacity: '', range_capacity_unit: '',
                                          graduating: '', graduating_unit: '', resolution: null,
                                          funnel_diameter: 0, funnel_diameter_unit: '',
                                          volume_per_tip: '', volume_per_tip_unit: '',
                                          funnel_area: 0, funnel_area_unit: '', is_standard: true, tracebility: ''
                                        };

                                        const updateSensorIdentity = (field: string, value: any) => {
                                          setSensorForms(prev => prev.map(s => s.id === sd.sensorLocalId ? { ...s, [field]: value } : s));
                                        };

                                        const updateSensorData = (field: string, value: any) => {
                                          setGlobalCertificates(prev => prev.map((c, ci) => {
                                            if (ci !== certIdx) return c;
                                            const ex = c.sensorData?.find((d: any) => d.sensorLocalId === sd.sensorLocalId);
                                            if (ex) return { ...c, sensorData: c.sensorData.map((d: any) => d.sensorLocalId === sd.sensorLocalId ? { ...d, [field]: value } : d) };
                                            return { ...c, sensorData: [...(c.sensorData || []), { sensorLocalId: sd.sensorLocalId, drift: 0, u95_general: 0, correction_data: [], [field]: value }] };
                                          }));
                                        };

                                        const isRainSensor = instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('hujan') ||
                                          instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('rain');

                                        return (
                                          <div key={sd.sensorLocalId} className="border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                                            {/* Sensor header with delete */}
                                            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between border-b border-blue-100">
                                              <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                </svg>
                                                <span className="text-sm font-semibold text-blue-900">
                                                  Sensor {sIdx + 1}{sensor.nama_sensor ? ` — ${sensor.nama_sensor}` : ''}
                                                </span>
                                              </div>
                                              <button type="button"
                                                onClick={async () => {
                                                  // Delete from DB first (if existing sensor with numeric ID)
                                                  await removeSensor(sd.sensorLocalId);
                                                  // After removeSensor succeeds, also clean up globalCertificates
                                                  // removeSensor already filtered from sensorForms; we mirror that here
                                                  setGlobalCertificates(prev => prev.map((c, ci) => {
                                                    if (ci !== certIdx) return c;
                                                    return { ...c, sensorData: c.sensorData.filter((d: any) => d.sensorLocalId !== sd.sensorLocalId) };
                                                  }));
                                                }}
                                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="Hapus sensor ini">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                            </div>
                                            <div className="p-4 space-y-4">
                                              {/* Identitas Sensor */}
                                              <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identitas Sensor</p>
                                                <div className="space-y-3">
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Sensor</label>
                                                    <SearchableDropdown
                                                      options={[
                                                        { id: '', name: 'Tidak dipilih' },
                                                        ...instrumentNames.map(n => ({ id: n.id, name: n.name })),
                                                      ]}
                                                      value={sensor.sensor_name_id}
                                                      onChange={(val) => updateSensorIdentity('sensor_name_id', val ? Number(val) : null)}
                                                      placeholder="Pilih Nama Sensor"
                                                      searchPlaceholder="Cari nama sensor..."
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Alias Sensor</label>
                                                    <input type="text" value={sensor.nama_sensor}
                                                      onChange={e => updateSensorIdentity('nama_sensor', e.target.value)}
                                                      className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                      placeholder="Contoh: Sensor Suhu Ruang A..."/>
                                                  </div>
                                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Merk</label>
                                                      <input type="text" value={sensor.merk_sensor}
                                                        onChange={e => updateSensorIdentity('merk_sensor', e.target.value)}
                                                        className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                        placeholder="Manufacturer"/>
                                                    </div>
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                                                      <input type="text" value={sensor.tipe_sensor}
                                                        onChange={e => updateSensorIdentity('tipe_sensor', e.target.value)}
                                                        className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                        placeholder="Tipe sensor"/>
                                                    </div>
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                                                      <input type="text" value={sensor.serial_number_sensor}
                                                        onChange={e => updateSensorIdentity('serial_number_sensor', e.target.value)}
                                                        className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                        placeholder="SN"/>
                                                    </div>
                                                  </div>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Range Capacity</label>
                                                      <div className="flex gap-2">
                                                        <input type="text" value={sensor.range_capacity}
                                                          onChange={e => updateSensorIdentity('range_capacity', e.target.value)}
                                                          className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                          placeholder="Ex: 0-100"/>
                                                        <div className="w-24"><UnitSelect units={units} value={sensor.range_capacity_unit} onChange={val => updateSensorIdentity('range_capacity_unit', val)} placeholder="Unit"/></div>
                                                      </div>
                                                    </div>
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Graduating</label>
                                                      <div className="flex gap-2">
                                                        <input type="text" value={sensor.graduating}
                                                          onChange={e => updateSensorIdentity('graduating', e.target.value)}
                                                          className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                          placeholder="Ex: 0.01"/>
                                                        <div className="w-24"><UnitSelect units={units} value={sensor.graduating_unit} onChange={val => updateSensorIdentity('graduating_unit', val)} placeholder="Unit"/></div>
                                                      </div>
                                                    </div>
                                                    <div className="sm:col-span-1">
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Resolution <span className="text-gray-400 font-normal">(untuk perhitungan U95)</span></label>
                                                      <input type="number" step="any" value={sensor.resolution ?? ''}
                                                        onChange={e => updateSensorIdentity('resolution', e.target.value === '' ? null : parseFloat(e.target.value))}
                                                        className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                        placeholder="Ex: 0.01"/>
                                                    </div>
                                                    <div className="sm:col-span-1">
                                                      <label className="block text-xs font-medium text-gray-600 mb-1">Traceability</label>
                                                      <input type="text" value={sensor.tracebility || ''}
                                                        onChange={e => updateSensorIdentity('tracebility', e.target.value)}
                                                        className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                        placeholder="Ex: KAN / BMKG"/>
                                                    </div>
                                                  </div>
                                                  {isRainSensor && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                      <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Funnel Diameter</label>
                                                        <div className="flex gap-2">
                                                          <input type="number" value={sensor.funnel_diameter} onChange={e => updateSensorIdentity('funnel_diameter', parseFloat(e.target.value)||0)} className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white" placeholder="0"/>
                                                          <div className="w-20"><UnitSelect units={units} value={sensor.funnel_diameter_unit} onChange={val => updateSensorIdentity('funnel_diameter_unit', val)} placeholder="Unit"/></div>
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Volume Per Tip</label>
                                                        <div className="flex gap-2">
                                                          <input type="text" value={sensor.volume_per_tip} onChange={e => updateSensorIdentity('volume_per_tip', e.target.value)} className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white" placeholder="volume"/>
                                                          <div className="w-20"><UnitSelect units={units} value={sensor.volume_per_tip_unit} onChange={val => updateSensorIdentity('volume_per_tip_unit', val)} placeholder="Unit"/></div>
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Funnel Area</label>
                                                        <div className="flex gap-2">
                                                          <input type="number" value={sensor.funnel_area} onChange={e => updateSensorIdentity('funnel_area', parseFloat(e.target.value)||0)} className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white" placeholder="0"/>
                                                          <div className="w-20"><UnitSelect units={units} value={sensor.funnel_area_unit} onChange={val => updateSensorIdentity('funnel_area_unit', val)} placeholder="Unit"/></div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              {/* Data Kalibrasi */}
                                              <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200">
                                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">Data Kalibrasi</p>
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Drift</label>
                                                    <input type="number" step="any" value={sd.drift}
                                                      onChange={e => updateSensorData('drift', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                      className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-amber-400 focus:border-amber-400 bg-white"
                                                      placeholder="Ex: -0.05"/>
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">U95 General</label>
                                                    <input type="number" step="any" value={sd.u95_general}
                                                      onChange={e => updateSensorData('u95_general', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                      className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-amber-400 focus:border-amber-400 bg-white"
                                                      placeholder="Ex: 0.02"/>
                                                  </div>
                                                </div>
                                                <div className="flex justify-between items-center mb-2">
                                                  <span className="text-xs font-semibold text-gray-600">Tabel Koreksi &amp; Ketidakpastian</span>
                                                  <button type="button"
                                                    onClick={() => updateSensorData('correction_data', [...(sd.correction_data || []), {setpoint:'',correction:'',u95:''}])}
                                                    className="text-xs bg-white hover:bg-amber-50 text-amber-700 px-2.5 py-1 rounded border border-amber-300 transition-colors">
                                                    + Tambah Baris
                                                  </button>
                                                </div>
                                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                                                    <thead className="bg-gray-50"><tr>
                                                      <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Setpoint</th>
                                                      <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Koreksi</th>
                                                      <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">U95</th>
                                                      <th className="px-3 py-1.5 w-10"></th>
                                                    </tr></thead>
                                                    <tbody className="bg-white divide-y divide-gray-100">
                                                      {(!sd.correction_data || sd.correction_data.length === 0) ? (
                                                        <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-400 italic">Klik "+ Tambah Baris" untuk menambah titik koreksi.</td></tr>
                                                      ) : sd.correction_data.map((row: any, rIdx: number) => (
                                                        <tr key={rIdx}>
                                                          <td className="px-2 py-1"><input type="number" step="any" value={row.setpoint}
                                                            onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],setpoint:e.target.value}; updateSensorData('correction_data',nd); }}
                                                            className="w-full border border-gray-300 rounded p-1"/></td>
                                                          <td className="px-2 py-1"><input type="number" step="any" value={row.correction}
                                                            onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],correction:e.target.value}; updateSensorData('correction_data',nd); }}
                                                            className="w-full border border-gray-300 rounded p-1"/></td>
                                                          <td className="px-2 py-1"><input type="number" step="any" value={row.u95}
                                                            onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],u95:e.target.value}; updateSensorData('correction_data',nd); }}
                                                            className="w-full border border-gray-300 rounded p-1"/></td>
                                                          <td className="px-2 py-1 text-center">
                                                            <button type="button" onClick={() => updateSensorData('correction_data', sd.correction_data.filter((_: any, ri: number) => ri !== rIdx))} className="text-red-400 hover:text-red-600">
                                                              <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Form Tambah Sertifikat Baru */}
                            <div className="border border-dashed border-blue-300 rounded-xl p-4 bg-blue-50/40">
                              <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">+ Tambah Sertifikat Baru</p>
                              <p className="text-xs text-gray-500 mb-3">Buat sertifikat baru, lalu klik <strong>"+ Tambah Sensor"</strong> di dalam card sertifikat untuk mendaftarkan sensor berikut data kalibrasinya (Drift, U95, Koreksi).</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="col-span-1">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Nomor Sertifikat <span className="text-red-400">*</span></label>
                                  <input type="text" value={newGlobalCert.no_certificate}
                                    onChange={e => setNewGlobalCert({...newGlobalCert, no_certificate: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                                    placeholder="Ex: 123/CERT/2026"/>
                                </div>
                                <div className="col-span-1">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Kalibrasi <span className="text-red-400">*</span></label>
                                  <input type="date" value={newGlobalCert.calibration_date}
                                    onChange={e => setNewGlobalCert({...newGlobalCert, calibration_date: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"/>
                                </div>
                              </div>

                              {newGlobalCertError && (
                                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                  {newGlobalCertError}
                                </p>
                              )}
                              <button type="button" className="mt-3 w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => {
                                  if (!newGlobalCert.no_certificate || !newGlobalCert.calibration_date) {
                                    setNewGlobalCertError('Mohon isi Nomor dan Tanggal Sertifikat terlebih dahulu.');
                                    return;
                                  }
                                  setNewGlobalCertError('');
                                  // Start with empty sensorData — user adds sensors inside the cert card
                                  setGlobalCertificates(prev => [...prev, {
                                    no_certificate: newGlobalCert.no_certificate,
                                    calibration_date: newGlobalCert.calibration_date,
                                    expanded: true,
                                    sensorData: []
                                  }]);
                                  setNewGlobalCert({ no_certificate: '', calibration_date: '' });
                                }}>
                                + Tambah Sertifikat
                              </button>
                            </div>

                            {globalCertificates.length === 0 && (
                              <p className="text-sm text-gray-400 italic text-center mt-3">Belum ada sertifikat. Isi Nomor dan Tanggal lalu klik Tambah Sertifikat.</p>
                            )}
                          </div>
                        )}

                      </div>
                    </div>

                    {/* Multi-Sensor Non-Standard: Informasi Sensor */}
                    {form.memiliki_lebih_satu && !isStandardInstrument && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 mt-6">
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
                            onClick={() => addSensor(false)}
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

                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nama Sensor</label>
                                    <SearchableDropdown
                                      options={[
                                        { id: '', name: 'Tidak dipilih' },
                                        ...instrumentNames.map(n => ({ id: n.id, name: n.name })),
                                      ]}
                                      value={sensor.sensor_name_id}
                                      onChange={(val) => updateSensor(sensor.id, 'sensor_name_id', val ? Number(val) : null)}
                                      placeholder="Pilih Nama Sensor"
                                      searchPlaceholder="Cari nama sensor..."
                                    />
                                  </div>
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
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Merk Sensor</label>
                                      <input type="text" value={sensor.merk_sensor}
                                        onChange={(e) => updateSensor(sensor.id, 'merk_sensor', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter sensor manufacturer"/>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Sensor</label>
                                      <input type="text" value={sensor.tipe_sensor}
                                        onChange={(e) => updateSensor(sensor.id, 'tipe_sensor', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter sensor type"/>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number Sensor</label>
                                      <input type="text" value={sensor.serial_number_sensor}
                                        onChange={(e) => updateSensor(sensor.id, 'serial_number_sensor', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter sensor serial number"/>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Range Capacity</label>
                                      <div className="flex gap-2">
                                        <input type="text" value={sensor.range_capacity}
                                          onChange={(e) => updateSensor(sensor.id, 'range_capacity', e.target.value)}
                                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                          placeholder="Ex: 0-100"/>
                                        <div className="w-28">
                                          <UnitSelect units={units} value={sensor.range_capacity_unit}
                                            onChange={(val) => updateSensor(sensor.id, 'range_capacity_unit', val)} placeholder="Unit"/>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Graduating</label>
                                      <div className="flex gap-2">
                                        <input type="text" value={sensor.graduating}
                                          onChange={(e) => updateSensor(sensor.id, 'graduating', e.target.value)}
                                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                          placeholder="Ex: 0.01"/>
                                        <div className="w-28">
                                          <UnitSelect units={units} value={sensor.graduating_unit}
                                            onChange={(val) => updateSensor(sensor.id, 'graduating_unit', val)} placeholder="Unit"/>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Resolution <span className="text-gray-400 text-xs font-normal">(untuk perhitungan U95)</span></label>
                                      <input type="number" step="any" value={sensor.resolution ?? ''}
                                        onChange={(e) => updateSensor(sensor.id, 'resolution', e.target.value === '' ? null : parseFloat(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Ex: 0.01"/>
                                    </div>
                                  </div>
                                  {(instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('hujan') ||
                                    instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('rain')) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Funnel Diameter</label>
                                        <div className="flex gap-2">
                                          <input type="number" value={sensor.funnel_diameter}
                                            onChange={(e) => updateSensor(sensor.id, 'funnel_diameter', parseFloat(e.target.value) || 0)}
                                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="0"/>
                                          <div className="w-24"><UnitSelect units={units} value={sensor.funnel_diameter_unit} onChange={(val) => updateSensor(sensor.id, 'funnel_diameter_unit', val)} placeholder="Unit"/></div>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Volume Per Tip</label>
                                        <div className="flex gap-2">
                                          <input type="text" value={sensor.volume_per_tip}
                                            onChange={(e) => updateSensor(sensor.id, 'volume_per_tip', e.target.value)}
                                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="volume"/>
                                          <div className="w-24"><UnitSelect units={units} value={sensor.volume_per_tip_unit} onChange={(val) => updateSensor(sensor.id, 'volume_per_tip_unit', val)} placeholder="Unit"/></div>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Funnel Area</label>
                                        <div className="flex gap-2">
                                          <input type="number" value={sensor.funnel_area}
                                            onChange={(e) => updateSensor(sensor.id, 'funnel_area', parseFloat(e.target.value) || 0)}
                                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="0"/>
                                          <div className="w-24"><UnitSelect units={units} value={sensor.funnel_area_unit} onChange={(val) => updateSensor(sensor.id, 'funnel_area_unit', val)} placeholder="Unit"/></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}


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
                                  <div className="w-28">
                                    <UnitSelect
                                      units={units}
                                      value={sensor.range_capacity_unit}
                                      onChange={(val) => updateSensor(sensor.id, 'range_capacity_unit', val)}
                                      placeholder="Unit"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Graduating</label>
                                <div className="flex gap-2">
                                  <input
                                    value={sensor.graduating}
                                    onChange={(e) => updateSensor(sensor.id, 'graduating', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: 0.01"
                                  />
                                  <div className="w-28">
                                    <UnitSelect
                                      units={units}
                                      value={sensor.graduating_unit}
                                      onChange={(val) => updateSensor(sensor.id, 'graduating_unit', val)}
                                      placeholder="Unit"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution <span className="text-gray-400 text-xs font-normal">(untuk perhitungan U95)</span></label>
                                <input
                                  type="number"
                                  step="any"
                                  value={sensor.resolution ?? ''}
                                  onChange={(e) => updateSensor(sensor.id, 'resolution', e.target.value === '' ? null : parseFloat(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Ex: 0.01"
                                />
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
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Range Capacity</label>
                                <div className="flex gap-2">
                                  <input
                                    value={sensor.range_capacity}
                                    onChange={(e) => updateSensor(sensor.id, 'range_capacity', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: 0-100"
                                  />
                                  <div className="w-28">
                                    <UnitSelect
                                      units={units}
                                      value={sensor.range_capacity_unit}
                                      onChange={(val) => updateSensor(sensor.id, 'range_capacity_unit', val)}
                                      placeholder="Unit"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Graduating</label>
                                <div className="flex gap-2">
                                  <input
                                    value={sensor.graduating}
                                    onChange={(e) => updateSensor(sensor.id, 'graduating', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: 0.01"
                                  />
                                  <div className="w-28">
                                    <UnitSelect
                                      units={units}
                                      value={sensor.graduating_unit}
                                      onChange={(val) => updateSensor(sensor.id, 'graduating_unit', val)}
                                      placeholder="Unit"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution <span className="text-gray-400 text-xs font-normal">(untuk perhitungan U95)</span></label>
                                <input
                                  type="number"
                                  step="any"
                                  value={sensor.resolution ?? ''}
                                  onChange={(e) => updateSensor(sensor.id, 'resolution', e.target.value === '' ? null : parseFloat(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Ex: 0.01"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
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
