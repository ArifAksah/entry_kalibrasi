'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificates } from '../../../hooks/useCertificates'
import { useCertificateVerification } from '../../../hooks/useCertificateVerification'
import { Certificate, CertificateInsert, Station, Instrument, Sensor } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
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

const PrinterIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

const SettingsIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const CheckCircleIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const RefreshIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const CloseIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const PlusIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const FileTextIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const CertificateIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)

const InstrumentIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
)

const SensorIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const SearchIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

// Komponen Background Batik Elegan
const BatikBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {/* Pattern batik transparan */}
    <div className="absolute top-0 left-0 w-full h-full opacity-5">
      <div className="absolute top-4 left-4 w-32 h-32 border-2 border-[#1e377c] rounded-full"></div>
      <div className="absolute top-4 right-4 w-24 h-24 border border-[#1e377c] rotate-45"></div>
      <div className="absolute bottom-4 left-4 w-20 h-20 border border-[#1e377c] rounded-full"></div>
      <div className="absolute bottom-4 right-4 w-28 h-28 border-2 border-[#1e377c] rotate-12"></div>
    </div>
    {/* Garis-garis dekoratif */}
    <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
    <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gradient-to-b from-transparent via-[#1e377c] to-transparent opacity-10"></div>
  </div>
)

// Versi lebih sederhana - Search di bawah, list di atas
const SearchableDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  className = ""
}: {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: Array<{ id: string | number; name: string; [key: string]: any }>
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(search.toLowerCase()) ||
    (option.station_id && option.station_id.toLowerCase().includes(search.toLowerCase()))
  )

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent text-sm"
      >
        {selectedOption ? (
          <span className="text-gray-900">{selectedOption.name} {selectedOption.station_id ? `(${selectedOption.station_id})` : ''}</span>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
          ▼
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Container utama dengan flex column-reverse */}
            <div className="flex flex-col-reverse h-60">
              
              {/* SEARCH INPUT - Tetap di BAWAH */}
              <div className="p-2 border-t border-gray-100 bg-gray-50 sticky bottom-0">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm bg-white"
                    autoFocus
                  />
                </div>
              </div>

              {/* OPTIONS LIST - Ditampilkan di ATAS search input */}
              <div className="overflow-y-auto flex-1">
                {filteredOptions.length > 0 ? (
                  <div className="flex flex-col-reverse"> {/* Membalik urutan items */}
                    {filteredOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onChange(option.id)
                          setIsOpen(false)
                          setSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 first:border-b-0 text-sm"
                      >
                        <div className="font-medium text-gray-900">{option.name}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">
                    Tidak ada data ditemukan
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const CertificatesCRUD: React.FC = () => {
  const { certificates, loading, error, addCertificate, updateCertificate, deleteCertificate } = useCertificates()
  const { completeRepair, resetVerification } = useCertificateVerification()
  const { user } = useAuth()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [sensors, setSensors] = useState<Array<{ id: number; name?: string | null }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  const [form, setForm] = useState<CertificateInsert>({
    no_certificate: '',
    no_order: '',
    no_identification: '',
    authorized_by: null,
    verifikator_1: null as any,
    verifikator_2: null as any,
    issue_date: '',
    station: null,
    instrument: null,
  })

  // Derived instrument details (read-only preview)
  const [instrumentPreview, setInstrumentPreview] = useState<{ manufacturer?: string; type?: string; serial?: string; other?: string }>({})

  // Local UI state for calibration results blocks
  type KV = { key: string; value: string }
  type TableRow = { key: string; unit: string; value: string }
  type TableSection = { title: string; rows: TableRow[] }
  type ResultItem = {
    sensorId: number | null
    startDate: string
    endDate: string
    place: string
    environment: KV[]
    table: TableSection[]
    notesForm: { 
      traceable_to_si_through: string; 
      reference_document: string; 
      calibration_methode: string; 
      others: string;
      standardInstruments: number[]
    }
    sensorDetails?: Partial<Sensor>
  }
  
  const [results, setResults] = useState<ResultItem[]>([
    { 
      sensorId: null, 
      startDate: '', 
      endDate: '', 
      place: '', 
      environment: [], 
      table: [], 
      notesForm: { 
        traceable_to_si_through: '', 
        reference_document: '', 
        calibration_methode: '', 
        others: '', 
        standardInstruments: [] 
      } 
    },
  ])
  
  const addResult = () => setResults(prev => [...prev, { 
    sensorId: null, 
    startDate: '', 
    endDate: '', 
    place: '', 
    environment: [], 
    table: [], 
    notesForm: { 
      traceable_to_si_through: '', 
      reference_document: '', 
      calibration_methode: '', 
      others: '', 
      standardInstruments: [] 
    } 
  }])
  
  const updateResult = (idx: number, patch: Partial<ResultItem>) => 
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const applySensorToResult = (idx: number, sensorId: number | null) => {
    const sensor = sensors.find((s: any) => s.id === sensorId) as unknown as Sensor | undefined
    updateResult(idx, {
      sensorId: sensorId ?? null,
      sensorDetails: sensor ? {
        id: sensor.id,
        manufacturer: sensor.manufacturer,
        type: sensor.type,
        serial_number: sensor.serial_number,
        range_capacity: sensor.range_capacity,
        range_capacity_unit: sensor.range_capacity_unit,
        graduating: sensor.graduating,
        graduating_unit: sensor.graduating_unit,
        funnel_diameter: sensor.funnel_diameter,
        funnel_diameter_unit: sensor.funnel_diameter_unit,
        funnel_area: sensor.funnel_area,
        funnel_area_unit: sensor.funnel_area_unit,
        volume_per_tip: sensor.volume_per_tip,
        volume_per_tip_unit: sensor.volume_per_tip_unit,
        name: sensor.name,
        created_at: sensor.created_at,
      } : undefined,
    })
  }

  // Picker modal states
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [noteEditIndex, setNoteEditIndex] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState<{ traceable_to_si_through: string; reference_document: string; calibration_methode: string; others: string; standardInstruments: number[] }>({ 
    traceable_to_si_through: '', 
    reference_document: '', 
    calibration_methode: '', 
    others: '', 
    standardInstruments: [] 
  })
  const [standardPickerIndex, setStandardPickerIndex] = useState<number | null>(null)
  const [standardSearch, setStandardSearch] = useState('')
  const [envEditIndex, setEnvEditIndex] = useState<number | null>(null)
  const [envDraft, setEnvDraft] = useState<KV[]>([])
  const [tableEditIndex, setTableEditIndex] = useState<number | null>(null)
  const [tableDraft, setTableDraft] = useState<TableSection[]>([])

  // Fetch data dengan error handling yang diperbaiki
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Starting to fetch data...');
        
        const [stationsRes, instrumentsRes, sensorsRes, personelRes] = await Promise.all([
          fetch('/api/stations'),
          fetch('/api/instruments'),
          fetch('/api/sensors'),
          fetch('/api/personel'),
        ]);

        // Handle stations response
        if (stationsRes.ok) {
          const stationsData = await stationsRes.json();
          console.log('Stations data:', stationsData);
          setStations(Array.isArray(stationsData) ? stationsData : []);
        } else {
          console.error('Stations fetch failed:', stationsRes.status, stationsRes.statusText);
        }

        // Handle instruments response
        if (instrumentsRes.ok) {
          const instrumentsData = await instrumentsRes.json();
          console.log('Instruments data:', instrumentsData);
          setInstruments(Array.isArray(instrumentsData) ? instrumentsData : []);
        } else {
          console.error('Instruments fetch failed:', instrumentsRes.status, instrumentsRes.statusText);
        }

        // Handle sensors response
        if (sensorsRes.ok) {
          const sensorsData = await sensorsRes.json();
          console.log('Sensors data:', sensorsData);
          setSensors(Array.isArray(sensorsData) ? sensorsData : []);
        } else {
          console.error('Sensors fetch failed:', sensorsRes.status, sensorsRes.statusText);
        }

        // Handle personel response - DIPERBAIKI dengan logging detail
        if (personelRes.ok) {
          const personelData = await personelRes.json();
          console.log('Raw personel response:', personelData);
          
          // Cek berbagai kemungkinan format response
          let finalPersonelData = [];
          
          if (Array.isArray(personelData)) {
            finalPersonelData = personelData;
          } else if (personelData && Array.isArray(personelData.data)) {
            // Format: { data: [...] }
            finalPersonelData = personelData.data;
          } else if (personelData && personelData.users) {
            // Format: { users: [...] }
            finalPersonelData = personelData.users;
          } else if (personelData && typeof personelData === 'object') {
            // Jika object, convert ke array
            finalPersonelData = Object.values(personelData);
          }
          
          console.log('Processed personel data:', finalPersonelData);
          setPersonel(finalPersonelData);
          
        } else {
          console.error('Personel fetch failed:', {
            status: personelRes.status,
            statusText: personelRes.statusText,
            url: '/api/personel'
          });
          
          // Fallback data untuk development
          const fallbackPersonel = [
            { id: '1', name: 'Admin User' },
            { id: '2', name: 'Quality Manager' },
            { id: '3', name: 'Senior Technician' }
          ];
          console.warn('Using fallback personel data');
          setPersonel(fallbackPersonel);
        }

      } catch (e) {
        console.error('Failed to fetch data:', e);
        
        // Fallback data jika semua fetch gagal
        const fallbackPersonel = [
          { id: '1', name: 'Admin User' },
          { id: '2', name: 'Quality Manager' },
          { id: '3', name: 'Senior Technician' }
        ];
        setPersonel(fallbackPersonel);
      }
    };

    fetchData();
  }, []);

  // When instrument changes, update preview fields
  useEffect(() => {
    if (!form.instrument) { 
      setInstrumentPreview({}); 
      return;
    }
    
    const inst = instruments.find(i => i.id === form.instrument);
    if (!inst) { 
      setInstrumentPreview({}); 
      return;
    }
    
    setInstrumentPreview({
      manufacturer: (inst as any).manufacturer || '',
      type: (inst as any).type || '',
      serial: (inst as any).serial_number || '',
    });
  }, [form.instrument, instruments]);

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentCertificates = certificates.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(certificates.length / itemsPerPage)

  const openModal = (item?: Certificate) => {
    if (item) {
      setEditing(item)
      setForm({
        no_certificate: item.no_certificate,
        no_order: item.no_order,
        no_identification: item.no_identification,
        authorized_by: item.authorized_by,
        verifikator_1: (item as any).verifikator_1 ?? null,
        verifikator_2: (item as any).verifikator_2 ?? null,
        issue_date: item.issue_date,
        station: item.station,
        instrument: item.instrument,
      })
      const savedResults = (item as any).results || []
      setResults(savedResults.length > 0 ? savedResults : [{
        sensorId: null, 
        startDate: '', 
        endDate: '', 
        place: '', 
        environment: [], 
        table: [], 
        notesForm: { 
          traceable_to_si_through: '', 
          reference_document: '', 
          calibration_methode: '', 
          others: '', 
          standardInstruments: [] 
        }
      }])
    } else {
      setEditing(null)
      setForm({
        no_certificate: '',
        no_order: '',
        no_identification: '',
        authorized_by: null,
        verifikator_1: null as any,
        verifikator_2: null as any,
        issue_date: '',
        station: null,
        instrument: null,
      })
      setResults([{
        sensorId: null, 
        startDate: '', 
        endDate: '', 
        place: '', 
        environment: [], 
        table: [], 
        notesForm: { 
          traceable_to_si_through: '', 
          reference_document: '', 
          calibration_methode: '', 
          others: '', 
          standardInstruments: [] 
        }
      }])
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.no_certificate || !form.no_order || !form.no_identification || !form.issue_date) return
    
    if (!(form as any).verifikator_1 || !(form as any).verifikator_2) {
      alert('Verifikator 1 dan Verifikator 2 harus dipilih')
      return
    }
    
    setIsSubmitting(true)
    try {
      const payload = { ...form, results }
      if (editing) {
        await updateCertificate(editing.id, payload as any)
      } else {
        await addCertificate(payload as any)
      }
      closeModal()
    } catch (e) {
      console.error('Error submitting certificate:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this certificate?')) return
    try { 
      await deleteCertificate(id) 
    } catch (e) {
      console.error('Error deleting certificate:', e)
    }
  }

  const handleCompleteRepair = async (certificate: Certificate) => {
    if (!confirm('Tandai perbaikan sertifikat ini sebagai selesai?')) return
    
    const result = await completeRepair(certificate.id, 'Repair completed')
    
    if (result.success) {
      alert('Perbaikan berhasil diselesaikan!')
      window.location.reload()
    } else {
      alert('Gagal menyelesaikan perbaikan: ' + (result.error || 'Unknown error'))
    }
  }

  const handleResetVerification = async (certificate: Certificate) => {
    if (!confirm('Reset verifikasi untuk sertifikat ini? Ini akan menghapus semua verifikasi yang ada.')) return
    
    const result = await resetVerification(certificate.id)
    
    if (result.success) {
      alert('Verifikasi berhasil direset!')
      window.location.reload()
    } else {
      alert('Gagal mereset verifikasi: ' + (result.error || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e377c]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Header dengan background putih dan aksen biru elegan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 relative overflow-hidden">
        <BatikBackground />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <Breadcrumb items={[{ label: 'Documents', href: '#' }, { label: 'Certificates' }]} />
          </div>
          {can('certificate','create') && (
            <button 
              onClick={() => openModal()} 
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] text-white rounded-lg hover:from-[#2a4a9d] hover:to-[#1e377c] transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="font-semibold">Create New</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabel dengan card elegan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Certificate No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Order No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Identification</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Issue Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Station</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Instrument</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Verification</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Repair</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentCertificates.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.no_certificate}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.no_order}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.no_identification}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(item.issue_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.station ? stations.find(s => s.id === item.station)?.name || 'Unknown' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.instrument ? instruments.find(i => i.id === item.instrument)?.name || 'Unknown' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">V1:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                          (item as any).verifikator_1_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_1_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {(item as any).verifikator_1_status || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">V2:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                          (item as any).verifikator_2_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_2_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {(item as any).verifikator_2_status || 'pending'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px]">
                    <div className="truncate" title={(item as any).verification_notes || (item as any).rejection_reason || '-'}>
                      {(item as any).verification_notes || (item as any).rejection_reason || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                      (item as any).repair_status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                      (item as any).repair_status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      (item as any).repair_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {(item as any).repair_status || 'none'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium space-x-1">
                    <a 
                      href={`/certificates/${item.id}/print`} 
                      target="_blank" 
                      className="inline-flex items-center p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200"
                      title="Print Certificate"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </a>
                    
                    {can('certificate','update') && canEndpoint('PUT', `/api/certificates/${item.id}`) && 
                     (item as any).repair_status !== 'pending' && (item as any).repair_status !== 'completed' && (
                      <button 
                        onClick={() => openModal(item)} 
                        className="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                        title="Edit Certificate"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    )}
                    
                    {can('certificate','delete') && canEndpoint('DELETE', `/api/certificates/${item.id}`) && (
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="inline-flex items-center p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
                        title="Delete Certificate"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                    
                    {(item as any).repair_status === 'none' && ((item as any).verifikator_1_status === 'rejected' || (item as any).verifikator_2_status === 'rejected') && (
                      <button 
                        onClick={() => openModal(item)} 
                        className="inline-flex items-center p-1.5 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg transition-all duration-200 border border-transparent hover:border-orange-200"
                        title="Request Repair"
                      >
                        <SettingsIcon className="w-4 h-4" />
                      </button>
                    )}
                    {(item as any).repair_status === 'pending' && (
                      <button 
                        onClick={() => handleCompleteRepair(item)} 
                        className="inline-flex items-center p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200"
                        title="Complete Repair"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                      </button>
                    )}
                    {(item as any).repair_status === 'completed' && (
                      <button 
                        onClick={() => handleResetVerification(item)} 
                        className="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                        title="Reset Verification"
                      >
                        <RefreshIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination dengan desain elegan */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="text-xs text-gray-600">
              Showing <span className="font-semibold">{indexOfFirstItem + 1}</span> to <span className="font-semibold">{Math.min(indexOfLastItem, certificates.length)}</span> of <span className="font-semibold">{certificates.length}</span> entries
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-gray-400 transition-all duration-200"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    currentPage === page
                      ? 'bg-[#1e377c] text-white shadow-md'
                      : 'border border-gray-300 text-gray-700 hover:bg-white hover:border-gray-400'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-gray-400 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal dengan desain sertifikat mewah */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal dengan gradient elegan */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <CertificateIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editing ? 'Edit Certificate' : 'Create New Certificate'}
                    </h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      {editing ? 'Update existing certificate details' : 'Fill in the certificate information below'}
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
                {/* Data Sertifikat - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <FileTextIcon className="w-4 h-4 text-[#1e377c]" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Certificate Data</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'No. Sertifikat *', value: form.no_certificate, onChange: (e: any) => setForm({ ...form, no_certificate: e.target.value }), type: 'text', required: true },
                      { label: 'No. Order *', value: form.no_order, onChange: (e: any) => setForm({ ...form, no_order: e.target.value }), type: 'text', required: true },
                      { label: 'No. Identifikasi *', value: form.no_identification, onChange: (e: any) => setForm({ ...form, no_identification: e.target.value }), type: 'text', required: true },
                      { label: 'Tanggal Terbit *', value: form.issue_date, onChange: (e: any) => setForm({ ...form, issue_date: e.target.value }), type: 'date', required: true },
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
                    
                    {/* Select fields */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Stasiun</label>
                      <SearchableDropdown
                        value={form.station}
                        onChange={(value) => setForm({ ...form, station: value as number | null })}
                        options={stations.map(s => ({ id: s.id, name: s.name, station_id: s.station_id }))}
                        placeholder="Pilih Stasiun"
                        searchPlaceholder="Cari stasiun..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Authorized By</label>
                      <select 
                        value={form.authorized_by ?? ''} 
                        onChange={e => setForm({ ...form, authorized_by: e.target.value || null })} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                      >
                        <option value="">Pilih personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Verifikator 1 *</label>
                      <select 
                        required 
                        value={(form as any).verifikator_1 ?? ''} 
                        onChange={e => setForm({ ...form, verifikator_1: e.target.value || null } as any)} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                      >
                        <option value="">Pilih personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Verifikator 2 *</label>
                      <select 
                        required 
                        value={(form as any).verifikator_2 ?? ''} 
                        onChange={e => setForm({ ...form, verifikator_2: e.target.value || null } as any)} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                      >
                        <option value="">Pilih personel</option>
                        {personel.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Data Instrumen - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <InstrumentIcon className="w-4 h-4 text-[#1e377c]" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Instrument Data</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Nama Instrumen</label>
                      <select 
                        value={form.instrument || ''} 
                        onChange={e=>setForm({ ...form, instrument: e.target.value ? parseInt(e.target.value) : null })} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm"
                      >
                        <option value="">Pilih nama</option>
                        {instruments.map(i => (
                          <option key={i.id} value={i.id}>
                            {(i as any).name || 'Instrument'}{(i as any).type ? ` - ${(i as any).type}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {[
                      { label: 'Pabrikan', value: instrumentPreview.manufacturer || '', disabled: true },
                      { label: 'Tipe', value: instrumentPreview.type || '', disabled: true },
                      { label: 'Serial Number', value: instrumentPreview.serial || '', disabled: true },
                    ].map((field, index) => (
                      <div key={index} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                        <input
                          value={field.value}
                          disabled={field.disabled}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                        />
                      </div>
                    ))}

                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Lainnya</label>
                      <textarea 
                        value={instrumentPreview.other || ''} 
                        onChange={e=>setInstrumentPreview(prev=>({ ...prev, other: e.target.value }))} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] focus:border-transparent transition-all duration-200 bg-white text-sm" 
                        rows={2} 
                      />
                    </div>
                  </div>
                </div>

                {/* Hasil Kalibrasi Sensor - Card Elegan */}
                <div className="bg-white rounded-lg shadow border border-gray-100 p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e377c] to-[#2a4a9d]"></div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <SensorIcon className="w-4 h-4 text-[#1e377c]" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">Sensor Calibration Results</h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={addResult} 
                      className="flex items-center gap-1 px-2 py-1.5 bg-[#1e377c] text-white rounded-lg hover:bg-[#2a4a9d] transition-all duration-200 shadow text-xs font-semibold"
                    >
                      <PlusIcon className="w-3 h-3" />
                      <span>Add Result</span>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {results.map((r, idx) => (
                      <div key={idx} className="border border-gray-200 bg-gray-50/50 rounded-lg p-3 hover:bg-white transition-all duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wide">Sensor #{idx + 1}</h4>
                          <select 
                            value={r.sensorId || ''} 
                            onChange={e=>applySensorToResult(idx, e.target.value ? parseInt(e.target.value) : null)} 
                            className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1e377c]"
                          >
                            <option value="">Pilih Sensor</option>
                            {sensors.map(s => (
                              <option key={s.id} value={s.id}>
                                ID {s.id}{s.name ? ` - ${s.name}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                          {[
                            { label: 'Tanggal Mulai', value: r.startDate, onChange: (e: any) => updateResult(idx, { startDate: e.target.value }), type: 'date' },
                            { label: 'Tanggal Selesai', value: r.endDate, onChange: (e: any) => updateResult(idx, { endDate: e.target.value }), type: 'date' },
                            { label: 'Tempat Kalibrasi', value: r.place, onChange: (e: any) => updateResult(idx, { place: e.target.value }), type: 'text' },
                          ].map((field, fieldIdx) => (
                            <div key={fieldIdx} className="space-y-1">
                              <label className="block text-xs font-medium text-gray-600">{field.label}</label>
                              <input 
                                type={field.type}
                                value={field.value} 
                                onChange={field.onChange} 
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white" 
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: 'Kondisi Lingkungan', onClick: () => { setEnvDraft(r.environment.length ? r.environment : [{ key: '', value: '' }]); setEnvEditIndex(idx) } },
                            { label: 'Tabel Hasil', onClick: () => { setTableDraft(r.table.length ? r.table : [{ title: '', rows: [{ key: '', unit: '', value: '' }] }]); setTableEditIndex(idx) } },
                            { label: 'Catatan', onClick: () => { setNoteDraft({ ...r.notesForm, standardInstruments: r.notesForm.standardInstruments || [] }); setNoteEditIndex(idx) } },
                          ].map((button, btnIdx) => (
                            <button 
                              key={btnIdx}
                              type="button" 
                              onClick={button.onClick}
                              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                            >
                              {button.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
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
                    ) : editing ? 'Update Certificate' : 'Create Certificate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Environment Modal dengan tema seragam */}
      {envEditIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <SettingsIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Kondisi Lingkungan</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Isi kondisi lingkungan untuk Sensor #{envEditIndex + 1}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnvEditIndex(null)}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
              <div className="space-y-3">
                {envDraft.map((row, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Key</label>
                      <input 
                        value={row.key} 
                        onChange={e => {
                          const v = [...envDraft]; 
                          v[i] = {...v[i], key: e.target.value}; 
                          setEnvDraft(v)
                        }} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                        placeholder="Contoh: Suhu"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Value</label>
                      <input 
                        value={row.value} 
                        onChange={e => {
                          const v = [...envDraft]; 
                          v[i] = {...v[i], value: e.target.value}; 
                          setEnvDraft(v)
                        }} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                        placeholder="Contoh: 25°C"
                      />
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => setEnvDraft(prev => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#1e377c] hover:bg-blue-50 transition-all duration-200 text-sm text-gray-600 hover:text-[#1e377c]"
                >
                  <PlusIcon className="w-4 h-4" />
                  Tambah Baris Kondisi Lingkungan
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50/50">
              <button 
                onClick={() => setEnvEditIndex(null)} 
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
              >
                Batal
              </button>
              <button 
                onClick={() => { 
                  if (envEditIndex === null) return; 
                  updateResult(envEditIndex, { environment: envDraft.filter(r => r.key || r.value) }); 
                  setEnvEditIndex(null) 
                }} 
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg transition-all duration-200 shadow hover:shadow-lg"
              >
                Simpan Kondisi Lingkungan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Result Modal dengan tema seragam */}
      {tableEditIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <FileTextIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Tabel Hasil Kalibrasi</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Isi tabel hasil untuk Sensor #{tableEditIndex + 1}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTableEditIndex(null)}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
              <div className="space-y-4">
                {tableDraft.map((section, si) => (
                  <div key={si} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <div className="space-y-1 mb-3">
                      <label className="block text-xs font-semibold text-gray-700">Judul Bagian</label>
                      <input 
                        value={section.title} 
                        onChange={e => { 
                          const v = [...tableDraft]; 
                          v[si] = {...v[si], title: e.target.value}; 
                          setTableDraft(v) 
                        }} 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                        placeholder="Contoh: Hasil Pengukuran"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      {section.rows.map((row, ri) => (
                        <div key={ri} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border border-gray-100 rounded bg-gray-50">
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Parameter</label>
                            <input 
                              placeholder="Key" 
                              value={row.key} 
                              onChange={e => { 
                                const v = [...tableDraft]; 
                                v[si].rows[ri] = {...row, key: e.target.value}; 
                                setTableDraft(v) 
                              }} 
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Unit</label>
                            <input 
                              placeholder="Unit" 
                              value={row.unit} 
                              onChange={e => { 
                                const v = [...tableDraft]; 
                                v[si].rows[ri] = {...row, unit: e.target.value}; 
                                setTableDraft(v) 
                              }} 
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Nilai</label>
                            <input 
                              placeholder="Value" 
                              value={row.value} 
                              onChange={e => { 
                                const v = [...tableDraft]; 
                                v[si].rows[ri] = {...row, value: e.target.value}; 
                                setTableDraft(v) 
                              }} 
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white"
                            />
                          </div>
                        </div>
                      ))}
                      
                      <button 
                        onClick={() => { 
                          const v = [...tableDraft]; 
                          v[si].rows = [...v[si].rows, { key: '', unit: '', value: '' }]; 
                          setTableDraft(v) 
                        }} 
                        className="flex items-center gap-1 px-2 py-1 text-xs border border-dashed border-gray-300 rounded hover:border-[#1e377c] hover:bg-blue-50 text-gray-600 hover:text-[#1e377c] transition-all duration-200"
                      >
                        <PlusIcon className="w-3 h-3" />
                        Tambah Baris Data
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => setTableDraft(prev => [...prev, { title: '', rows: [{ key: '', unit: '', value: '' }] }])}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#1e377c] hover:bg-blue-50 transition-all duration-200 text-sm text-gray-600 hover:text-[#1e377c] w-full justify-center"
                >
                  <PlusIcon className="w-4 h-4" />
                  Tambah Bagian Tabel Baru
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50/50">
              <button 
                onClick={() => setTableEditIndex(null)} 
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
              >
                Batal
              </button>
              <button 
                onClick={() => { 
                  if (tableEditIndex === null) return; 
                  const cleaned = tableDraft.map(sec => ({
                    ...sec, 
                    rows: sec.rows.filter(r => r.key || r.unit || r.value)
                  })).filter(sec => sec.title || sec.rows.length); 
                  updateResult(tableEditIndex, { table: cleaned }); 
                  setTableEditIndex(null) 
                }} 
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg transition-all duration-200 shadow hover:shadow-lg"
              >
                Simpan Tabel Hasil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal dengan tema seragam */}
      {noteEditIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <CertificateIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Catatan Kalibrasi</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Isi catatan untuk Sensor #{noteEditIndex + 1}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setNoteEditIndex(null)}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Traceable to SI Through</label>
                  <input 
                    value={noteDraft.traceable_to_si_through} 
                    onChange={e => setNoteDraft(prev => ({ ...prev, traceable_to_si_through: e.target.value }))} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                    placeholder="Traceable to SI through..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Reference Document</label>
                  <input 
                    value={noteDraft.reference_document} 
                    onChange={e => setNoteDraft(prev => ({ ...prev, reference_document: e.target.value }))} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                    placeholder="Reference document..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Calibration Method</label>
                  <input 
                    value={noteDraft.calibration_methode} 
                    onChange={e => setNoteDraft(prev => ({ ...prev, calibration_methode: e.target.value }))} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                    placeholder="Calibration method..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Others</label>
                  <textarea 
                    rows={2}
                    value={noteDraft.others} 
                    onChange={e => setNoteDraft(prev => ({ ...prev, others: e.target.value }))} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                    placeholder="Other notes..."
                  />
                </div>
                
                <div className="md:col-span-2 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Instrumen Standar</h4>
                    <button 
                      type="button" 
                      onClick={() => setNoteDraft(prev => ({ 
                        ...prev, 
                        standardInstruments: [...(prev.standardInstruments || []), 0] 
                      }))} 
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-[#1e377c] text-[#1e377c] rounded hover:bg-[#1e377c] hover:text-white transition-all duration-200"
                    >
                      <PlusIcon className="w-3 h-3" />
                      Tambah Instrumen Standar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(noteDraft.standardInstruments || []).map((sid, i) => {
                      const s = sensors.find(ss => ss.id === sid) as any
                      return (
                        <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-blue-50">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">Standar #{i + 1}</div>
                            <div className="text-gray-600 text-xs mt-0.5">
                              {s ? (
                                `${s.name || s.type || 'Sensor'}${s.serial_number ? ` — SN ${s.serial_number}` : ''}`
                              ) : (
                                'Belum ada sensor dipilih'
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => setStandardPickerIndex(i)} 
                              className="px-2 py-1 text-xs border border-[#1e377c] text-[#1e377c] rounded hover:bg-[#1e377c] hover:text-white transition-all duration-200"
                            >
                              Pilih Sensor
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setNoteDraft(prev => ({ 
                                ...prev, 
                                standardInstruments: prev.standardInstruments.filter((_, idx) => idx !== i) 
                              }))} 
                              className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all duration-200"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50/50">
              <button 
                onClick={() => setNoteEditIndex(null)} 
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
              >
                Batal
              </button>
              <button 
                onClick={() => { 
                  if (noteEditIndex === null) return; 
                  updateResult(noteEditIndex, { notesForm: { ...noteDraft } }); 
                  setNoteEditIndex(null) 
                }} 
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg transition-all duration-200 shadow hover:shadow-lg"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Sensor Picker Modal dengan tema seragam */}
      {standardPickerIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
            {/* Header Modal */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <SensorIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Pilih Instrumen Standar</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Pilih sensor standar untuk kalibrasi
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStandardPickerIndex(null)}
                  className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-gradient-to-br from-white to-gray-50/30">
              <div className="space-y-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    value={standardSearch} 
                    onChange={e => setStandardSearch(e.target.value)} 
                    placeholder="Cari standar (nama / pabrikan / tipe / serial)" 
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                  />
                </div>
                
                <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {sensors
                    .filter(s => (s as any).is_standard)
                    .filter(s => {
                      const q = standardSearch.toLowerCase()
                      return !q || `${(s as any).name||''} ${(s as any).manufacturer||''} ${(s as any).type||''} ${(s as any).serial_number||''}`.toLowerCase().includes(q)
                    })
                    .map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => { 
                          if (standardPickerIndex === null) return;
                          setNoteDraft(prev => {
                            const arr = [...(prev.standardInstruments||[])]
                            arr[standardPickerIndex] = s.id as any
                            return { ...prev, standardInstruments: arr }
                          })
                          setStandardPickerIndex(null)
                        }} 
                        className="w-full text-left px-3 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-200"
                      >
                        <div className="font-medium text-gray-900 text-sm">
                          {(s as any).name || (s as any).type || 'Sensor'} — {(s as any).type || ''}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {(s as any).manufacturer || ''} • SN {(s as any).serial_number || '-'}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50/50">
              <button 
                onClick={() => setStandardPickerIndex(null)} 
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 border border-gray-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CertificatesCRUD