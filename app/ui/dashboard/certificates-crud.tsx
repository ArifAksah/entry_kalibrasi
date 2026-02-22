'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificates } from '../../../hooks/useCertificates'
import { useCertificateVerification } from '../../../hooks/useCertificateVerification'
import { Certificate, CertificateInsert, Station, Instrument, Sensor, CertStandard, CalibrationSession, RawData } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Alert from '../../../components/ui/Alert'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import { useRouter } from 'next/navigation'
import { EditIcon, DeleteIcon } from '../../../components/ui/ActionIcons'
import { read, utils } from 'xlsx'
import QCDataModal from '../../../components/features/QCDataModal'
import LHKSReport from '../../../components/features/LHKSReport'

// Keep TrashIcon for backward compatibility in this file
const TrashIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ImageIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const ViewIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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

const EyeIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const SearchIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

// Komponen Background Batik untuk Header
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

// Komponen Batik Background khusus untuk Modal Header dengan gambar
const ModalBatikHeader = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
    <div
      className="absolute top-0 left-0 w-full h-full bg-repeat-x"
      style={{
        backgroundImage: 'url("/batik_header.png")',
        backgroundSize: 'auto 100%',
      }}
    ></div>
  </div>
)

// Searchable Dropdown Component
const SearchableDropdown = ({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  className = "",
  id = ""
}: {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: Array<{ id: string | number; name: string;[key: string]: any }>
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option => {
    const searchLower = search.toLowerCase()
    return (
      option.name.toLowerCase().includes(searchLower) ||
      (option.station_id && String(option.station_id).toLowerCase().includes(searchLower)) ||
      (typeof option.id === 'string' && option.id.toLowerCase().includes(searchLower)) ||
      (option.nip && String(option.nip).toLowerCase().includes(searchLower))
    )
  })

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div className={`relative ${className}`} id={id}>
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
            <div className="flex flex-col h-auto max-h-60">
              <div className="p-3 border-b border-gray-100 bg-white sticky top-0 z-10">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm bg-gray-50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredOptions.length > 0 ? (
                  <div className="flex flex-col">
                    {filteredOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onChange(option.id)
                          setIsOpen(false)
                          setSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                      >
                        <div className="font-medium text-gray-900">{option.name}</div>
                        {option.station_id ? (
                          <div className="text-xs text-gray-500 mt-0.5">{option.station_id}</div>
                        ) : null}
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
  const { can, canEndpoint, role } = usePermissions()
  const { alert, showSuccess, showError, showWarning, hideAlert } = useAlert()
  const router = useRouter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [standardCerts, setStandardCerts] = useState<CertStandard[]>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string; nip?: string; role?: string }>>([])

  // QC Modal State
  const [showQCModal, setShowQCModal] = useState(false)
  const [qcModalCertificate, setQcModalCertificate] = useState<Certificate | null>(null)

  // LHKS Modal State
  const [showLHKSModal, setShowLHKSModal] = useState(false)
  const [lhksCertificate, setLhksCertificate] = useState<Certificate | null>(null)
  const [lhksRawData, setLhksRawData] = useState<any[]>([])

  const handlePrintLHKS = async (cert: Certificate) => {
    setLhksCertificate(cert)
    setLhksRawData([])

    if (cert.results && Array.isArray(cert.results) && cert.results.length > 0) {
      const sessionId = (cert.results[0] as any).session_id
      if (sessionId) {
        try {
          const res = await fetch(`/api/raw-data?session_id=${sessionId}`)
          const json = await res.json()
          setLhksRawData(json.data || [])
        } catch (e) {
          console.error("Failed to fetch raw data for LHKS", e)
        }
      }
    }
    setShowLHKSModal(true)
  }

  // New Layout States
  const [activeTab, setActiveTab] = useState<'lingkungan' | 'hasil' | 'catatan'>('lingkungan')
  const [sessionDetails, setSessionDetails] = useState({
    start_date: '',
    end_date: '',
    place: '',
    notes: ''
  })

  const [uploadedRawData, setUploadedRawData] = useState<any[]>([])

  const [rawMap, setRawMap] = useState({ timestamp: '', standard: '', uut: '' })
  const [viewingCorrectionStandard, setViewingCorrectionStandard] = useState<CertStandard | null>(null)

  // Global Standard Instrument Selection
  const [globalStandardInstrumentId, setGlobalStandardInstrumentId] = useState<number | null>(null)
  const [globalStandardCertificateNumber, setGlobalStandardCertificateNumber] = useState<string | null>(null)

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
    station_address: null as any,
  })

  // Derived instrument details (read-only preview)
  const [instrumentPreview, setInstrumentPreview] = useState<{ manufacturer?: string; type?: string; serial?: string; other?: string }>({})

  // Local UI state for calibration results blocks
  type KV = { key: string; value: string }
  type TableRow = { key: string; unit: string; value: string; extraValues?: string[] }
  type TableSection = { title: string; headers?: string[]; rows: TableRow[] }
  type ResultItem = {
    sensorId: number | null
    startDate: string
    endDate: string
    place: string
    environment: KV[]
    table: TableSection[]
    images: Array<{ url: string; caption: string }>
    notesForm: {
      traceable_to_si_through: string;
      reference_document: string;
      calibration_methode: string;
      others: string;
      standardInstruments: number[]
    }
    sensorDetails?: Partial<Sensor>
    standardInstrumentId?: number | null
    standardCertificateNumber?: string | null
    standardCertificateId?: number | null
  }

  const [results, setResults] = useState<ResultItem[]>([
    {
      sensorId: null,
      standardInstrumentId: null,
      standardCertificateNumber: null,
      standardCertificateId: null,

      startDate: '',
      endDate: '',
      place: '',
      environment: [],
      table: [],
      images: [],
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
    images: [],
    notesForm: {
      traceable_to_si_through: '',
      reference_document: '',
      calibration_methode: '',
      others: '',
      standardInstruments: []
    }
  }])

  const removeResult = (idx: number) => {
    if (results.length > 1 || rawData.length > 0) {
      if (confirm('Hapus input sensor ini? Data yang sudah diisi akan hilang.')) {
        setResults(prev => prev.filter((_, i) => i !== idx))
        if (rawData.length > idx) {
          setRawData(prev => prev.filter((_, i) => i !== idx))
        }
      }
    } else {
      showError('Minimal harus ada 1 input sensor.')
    }
  }

  const addImage = (resultIdx: number) => {
    setResults(prev => prev.map((r, i) =>
      i === resultIdx
        ? { ...r, images: [...(r.images || []), { url: '', caption: '' }] }
        : r
    ))
  }

  const removeImage = (resultIdx: number, imageIdx: number) => {
    setResults(prev => prev.map((r, i) =>
      i === resultIdx
        ? { ...r, images: (r.images || []).filter((_, idx) => idx !== imageIdx) }
        : r
    ))
  }

  const updateImage = (resultIdx: number, imageIdx: number, field: 'url' | 'caption', value: string) => {
    setResults(prev => prev.map((r, i) =>
      i === resultIdx
        ? {
          ...r,
          images: (r.images || []).map((img, idx) =>
            idx === imageIdx ? { ...img, [field]: value } : img
          )
        }
        : r
    ))
  }

  const updateResult = (idx: number, patch: Partial<ResultItem>) =>
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  // Helper function to get selected station type (normalized)
  // Returns lowercased, trimmed string; empty string when not set
  const getSelectedStationType = () => {
    const selectedStation = form.station ? stations.find(s => s.id === form.station) : undefined
    const raw = (selectedStation?.type ?? '').toString()
    return raw.trim().toLowerCase()
  }

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
      // Auto-fill calibration place based on sensor location or default
      place: sensor ? `Laboratorium Kalibrasi BMKG - ${sensor.name || sensor.type || 'Sensor'}` : '',
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

  // Raw Data State
  const [rawData, setRawData] = useState<{ name: string, data: any[][] }[]>([])
  const [showRawDataModal, setShowRawDataModal] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // New State for Raw Data Section (Part 4)
  const [rawDataFilename, setRawDataFilename] = useState<string | null>(null)
  const [rawPreviewSheetIndex, setRawPreviewSheetIndex] = useState(0)

  // Excel Import Handler
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionIndex: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      console.log('Imported Excel Data:', jsonData)
      setRawData([{ name: 'Table Import', data: jsonData }]) // Store raw data for viewing

      // Attempt to map to table rows (heuristic: skip header row)
      let rowsToProcess = jsonData
      let detectedHeaders: string[] | undefined = undefined

      if (rowsToProcess.length > 0) {
        // ... (existing header detection logic) ...
        const firstRow = rowsToProcess[0].map(cell => String(cell))
        const firstRowLower = firstRow.map(c => c.toLowerCase())

        if (firstRowLower.some(cell => cell.includes('parameter') || cell.includes('key') || cell.includes('unit') || cell.includes('nilai') || cell.includes('value'))) {
          detectedHeaders = firstRow
          rowsToProcess = rowsToProcess.slice(1)
        }
      }

      // If raw data is complex (like the user's screenshot with gaps), standard mapping might fail
      // But we still store it in rawData. 
      // We will try a smarter mapping: Filter out empty rows, keep all columns that have data

      const newRows: TableRow[] = rowsToProcess
        .filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && cell !== ''))
        .map(row => {
          // Flatten standard import: maintain current behavior for now
          // If the user wants to map "Time" (Col 0), "Std" (Col 4), "UUT" (Col 5)
          // We might need a column mapper UI later. For now, rely on "View Raw Data" to verify import.

          // Simple mapping: Col 0 -> Key, Col 1 -> Unit, Col 2 -> Value, Rest -> Extras
          // This matches the current table structure 
          const key = row[0] ? String(row[0]) : ''
          const unit = row[1] ? String(row[1]) : ''
          const value = row[2] ? String(row[2]) : ''
          const extraValues = row.slice(3).map(cell => cell ? String(cell) : '')

          return { key, unit, value, extraValues }
        })

      if (newRows.length > 0) {
        setTableDraft(prev => {
          const newDraft = [...prev]

          if (detectedHeaders && detectedHeaders.length > 0) {
            newDraft[sectionIndex].headers = detectedHeaders
          }

          newDraft[sectionIndex] = {
            ...newDraft[sectionIndex],
            rows: [...newDraft[sectionIndex].rows.filter(r => r.key || r.unit || r.value), ...newRows]
          }
          return newDraft
        })
      }

      showSuccess(`Berhasil mengimport data. Klik tombol mata untuk melihat raw data.`)


      showSuccess(`Berhasil mengimport ${newRows.length} baris data`)

      // Reset input
      e.target.value = ''
    } catch (error) {
      console.error('Error parsing Excel:', error)
      showError('Gagal membaca file Excel')
    } finally {
      setIsImporting(false)
    }
  }

  // Handler for Part 4: Raw Data Upload
  const handleRawDataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setRawDataFilename(file.name)
    setRawData([])

    try {
      const data = await file.arrayBuffer()
      const workbook = read(data)

      const sheetsData: { name: string, data: any[][] }[] = []
      const invalidSheets: string[] = []

      workbook.SheetNames.forEach(name => {
        const worksheet = workbook.Sheets[name]
        const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length > 0) {
          // Validation: Check headers (Flexible)
          const headers = (jsonData[0] as any[]).map(h => String(h).toLowerCase().trim())

          const hasTimestamp = headers.some(h => h.includes('timestamp') || h.includes('waktu') || h.includes('time') || h.includes('tanggal'))
          const hasStandard = headers.some(h => h.includes('standar') || h.includes('ref') || h.includes('master') || h.includes('std'))
          const hasUUT = headers.some(h => h.includes('uut') || h.includes('bacaan') || h.includes('reading') || h.includes('alat'))

          if (hasTimestamp && hasStandard && hasUUT) {
            sheetsData.push({ name, data: jsonData })
          } else {
            const missing = []
            if (!hasTimestamp) missing.push('Timestamp/Waktu')
            if (!hasStandard) missing.push('Standard/Ref')
            if (!hasUUT) missing.push('UUT/Reading')
            invalidSheets.push(`${name} (Missing: ${missing.join(', ')})`)
          }
        }
      })

      console.log('Raw Data Sheets:', sheetsData)
      setRawData(sheetsData)

      if (invalidSheets.length > 0) {
        showError(`Beberapa sheet ditolak karena format header tidak sesuai: \n${invalidSheets.join('\n')}`)
      }

      // Check if we should ask for confirmation (only if user has already selected sensors)
      const isDirty = results.length > 1 || results[0].sensorId !== null;
      let shouldProceed = true;

      if (sheetsData.length > 0) {
        if (isDirty) {
          shouldProceed = confirm(`Terdeteksi ${sheetsData.length} sheet valid. Apakah Anda ingin mereset input sensor dan menyesuaikan dengan jumlah sheet?`)
        }

        if (shouldProceed) {
          // ... proceed

          const newResults: ResultItem[] = sheetsData.map((sheet) => {
            // Helper to clean and parse float
            const parseVal = (val: any) => {
              if (typeof val === 'number') return val
              if (typeof val === 'string') return parseFloat(val.replace(',', '.'))
              return NaN
            }

            // AUTO-CALCULATE ENVIRONMENT CONDITIONS
            // Look for 'Suhu' and 'Kelembaban' columns in the sheet
            const headers = (sheet.data[0] as any[]).map(h => String(h).toLowerCase().trim())
            const tempIdx = headers.findIndex(h => h.includes('suhu') || h.includes('temp'))
            const humidIdx = headers.findIndex(h => h.includes('kelembaban') || h.includes('humidity') || h.includes('rh'))

            const envConditions: { key: string, value: string }[] = []

            if (tempIdx !== -1) {
              const values = sheet.data.slice(1).map(row => parseVal(row[tempIdx])).filter(v => !isNaN(v))
              if (values.length > 0) {
                const max = Math.max(...values)
                const min = Math.min(...values)
                // Formula: Mean ± (Max-Min)/2
                // Mean = (Max + Min) / 2
                // Uncertainty/HalfRange = (Max - Min) / 2
                const mean = (max + min) / 2
                const halfRange = (max - min) / 2

                // Format: "25.5 ± 0.5 °C" (Replace dot with comma for Indo format if needed, but keeping standard for now)
                // limit decimals to 1 or 2
                const valStr = `${mean.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ± ${halfRange.toLocaleString('id-ID', { maximumFractionDigits: 1 })} °C`
                envConditions.push({ key: 'Suhu', value: valStr })
              }
            }

            if (humidIdx !== -1) {
              const values = sheet.data.slice(1).map(row => parseVal(row[humidIdx])).filter(v => !isNaN(v))
              if (values.length > 0) {
                const max = Math.max(...values)
                const min = Math.min(...values)
                const mean = (max + min) / 2
                const halfRange = (max - min) / 2

                const valStr = `${mean.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ± ${halfRange.toLocaleString('id-ID', { maximumFractionDigits: 1 })} %RH`
                envConditions.push({ key: 'Kelembaban', value: valStr })
              }
            }

            // If no env columns found, populate with defaults
            if (envConditions.length === 0) {
              envConditions.push({ key: 'Suhu', value: '' })
              envConditions.push({ key: 'Kelembaban', value: '' })
            }


            return {
              sensorId: null,
              startDate: sessionDetails.start_date || '',
              endDate: sessionDetails.end_date || '',
              place: sessionDetails.place || '',
              environment: envConditions,
              table: [],
              images: [],
              notesForm: {
                traceable_to_si_through: '',
                reference_document: '',
                calibration_methode: '',
                others: '',
                standardInstruments: []
              }
            }
          })
          setResults(newResults)
          showSuccess(`Dibuat ${sheetsData.length} slot sensor berdasarkan sheet valid. Kondisi lingkungan ${sheetsData[0].data[0].some((h: any) => String(h).toLowerCase().includes('suhu')) ? 'dihitung otomatis' : 'disiapkan'}.`)
        }
      } else if (invalidSheets.length > 0) {
        showError('Tidak ada sheet yang valid untuk diproses.')
      } else {
        showSuccess(`Berhasil load ${sheetsData.length} sheet dari ${file.name}.`)
      }

    } catch (error) {
      console.error('Error parsing Raw Data Excel:', error)
      showError('Gagal membaca file Excel')
      setRawDataFilename(null)
    } finally {
      setIsImporting(false)
    }
  }


  // Fetch data

  // Deep-link support: open edit modal when visiting /certificates?edit=<id>
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const editId = params.get('edit')
      if (editId) {
        const idNum = parseInt(editId)
        if (!isNaN(idNum)) {
          const cert = certificates.find(c => c.id === idNum)
          if (cert) {
            openModal(cert)
          }
        }
      }
    } catch { }
  }, [certificates])

  // Check if edit came from certificate verification page
  const isEditFromVerification = () => {
    if (typeof window === 'undefined') return false
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('from') === 'verification'
    } catch {
      return false
    }
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all stations across pages to ensure every certificate can resolve station name
        const fetchAllStations = async () => {
          if (!role) return { data: [], total: 0, pageSize: 100, totalPages: 0 } // Wait for role

          let baseUrl = '/api/stations?pageSize=100'
          if (role !== 'admin' && user?.id) {
            baseUrl += `&user_id=${user.id}`
          }

          const first = await fetch(`${baseUrl}&page=1`)
          if (!first.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetch(`${baseUrl}&page=${p}`).then(r => r.ok ? r.json() : { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        // Fetch all instruments across pages
        // Fetch all instruments across pages
        const fetchAllInstruments = async () => {
          let baseUrl = '/api/instruments?pageSize=100'
          if (role !== 'admin' && user?.id) {
            baseUrl += `&user_id=${user.id}`
          }

          const first = await fetch(`${baseUrl}&page=1`)
          if (!first.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetch(`${baseUrl}&page=${p}`).then(r => r.ok ? r.json() : { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        // Fetch all sensors across pages
        const fetchAllSensors = async () => {
          const first = await fetch('/api/sensors?page=1&pageSize=100')
          if (!first.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetch(`/api/sensors?page=${p}&pageSize=100`).then(r => r.ok ? r.json() : { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        const [stationsAll, instrumentsAll, sensorsAll, personelRes, certStandardsRes] = await Promise.all([
          fetchAllStations(),
          fetchAllInstruments(),
          fetchAllSensors(),
          fetch('/api/personel'),
          fetch('/api/cert-standards'),
        ])

        setStations(Array.isArray(stationsAll) ? stationsAll : (stationsAll as any)?.data ?? [])
        setInstruments(Array.isArray(instrumentsAll) ? instrumentsAll : (instrumentsAll as any)?.data ?? [])
        setSensors(Array.isArray(sensorsAll) ? sensorsAll : (sensorsAll as any)?.data ?? [])

        if (personelRes.ok) {
          const p = await personelRes.json()
          setPersonel(Array.isArray(p) ? p : [])
        }

        // Handle standard certs
        try {
          if (certStandardsRes.ok) {
            const certs = await certStandardsRes.json()
            setStandardCerts(Array.isArray(certs) ? certs : [])
          }
        } catch (e) {
          console.error('Failed to load standard certs', e)
        }

      } catch (e) {
        console.error('Failed to fetch data:', e)
      }
    }
    fetchData()
  }, [user, role])

  // State specific for Standard Instrument selection
  // const [selectedStdSensorId, setSelectedStdSensorId] = useState<number | null>(null) -> Unused

  // REPLACED: Fetching standard certs is now done globally at startup to support the dropdown filter.
  // The previous useEffect here was clearing the list.
  /*
  useEffect(() => {
    if (!selectedStdSensorId) {
      setStandardCerts([]);
      return;
    }
    const fetchCerts = async () => {
      try {
        const res = await fetch(`/api/cert-standards?sensor_id=${selectedStdSensorId}`)
        if (res.ok) {
          const data = await res.json()
          setStandardCerts(Array.isArray(data) ? data : [])
        }
      } catch (e) { console.error(e) }
    }
    fetchCerts()
  }, [selectedStdSensorId])
  */

  // When instrument changes, update preview fields
  useEffect(() => {
    if (!form.instrument) {
      setInstrumentPreview({});
      return;
    }

    // Priority: check sensors list first (since dropdown uses sensors), then instruments
    const sensor = sensors.find(s => s.id === form.instrument);
    if (sensor) {
      setInstrumentPreview({
        manufacturer: sensor.manufacturer || '',
        type: sensor.type || '',
        serial: sensor.serial_number || '',
      });
      return;
    }

    const inst = instruments.find(i => i.id === form.instrument);
    if (inst) {
      setInstrumentPreview({
        manufacturer: (inst as any).manufacturer || '',
        type: (inst as any).type || '',
        serial: (inst as any).serial_number || '',
      });
      return;
    }

    setInstrumentPreview({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.instrument, sensors.length, instruments.length]);

  // Pagination + personalization: only show certificates assigned to the current user
  const isUserAssigned = (item: Certificate) => {
    const uid = user?.id ? String(user.id) : null
    if (!uid) return false
    const directFields = [
      (item as any).authorized_by,
      (item as any).verifikator_1,
      (item as any).verifikator_2,
    ]
    if (directFields.some(f => (f !== undefined && f !== null) && String(f) === uid)) return true

    // Support multiple possible creator field names coming from API/DB
    const creatorFieldCandidates = [
      'created_by', 'creator_id', 'creator', 'createdBy', 'user_id', 'owner', 'owner_id', 'sent_by', 'assignor'
    ] as const
    for (const key of creatorFieldCandidates) {
      const val = (item as any)[key]
      if (val !== undefined && val !== null && String(val) === uid) return true
    }
    return false
  }

  const allowedCertificates = certificates.filter(isUserAssigned)

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentCertificates = allowedCertificates.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(allowedCertificates.length / itemsPerPage)

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
        station_address: (item as any).station_address ?? (item.station ? stations.find(s => s.id === item.station)?.address ?? null : null),
      })
      const savedResults = (item as any).results || []
      setResults(savedResults.length > 0 ? savedResults : [{
        sensorId: null,
        startDate: '',
        endDate: '',
        place: '',
        environment: [],
        table: [],
        images: [],
        notesForm: {
          traceable_to_si_through: '',
          reference_document: '',
          calibration_methode: '',
          others: '',
          standardInstruments: []
        }
      }])

      // Fetch Raw Data if session_id is available (via the first result item usually, or we need to find it)
      // Actually, certificate doesn't have session_id directly on it in this interface, 
      // but we link via session_id in the DB. 
      // Wait, where is the session_id stored in the frontend object? 
      // It seems it's not directly in `Certificate` type here?
      // Let's check `Link Certificate to CalibrationSession` task.
      // We updated `saveSessionAndRawData` to return `sessionData.id`. 
      // But when fetching certificates, do we get `session_id`?
      // If `results` has it? No, results is jsonb.

      // We need to fetch raw data based on ... ?
      // If the certificate is linked to a session, the certificates table might have `session_id`.
      // Let's assume (item as any).session_id existence or try to fetch by certificate_id if backend supports it.
      // For now, let's try to see if (item as any).session_id exists or if we can fetch by certificate ID.

      // Actually, looking at previous code, `saveSessionAndRawData` saves session, then links it?
      // The `certificate` table has `session_id` column?
      // The `task.md` said: "- [ ] Add `session_id` column to `certificate` table." -> It was checked!
      // So `item.session_id` should exist.

      const sessionId = (item as any).session_id;
      if (sessionId) {
        fetch(`/api/raw-data?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.data && Array.isArray(data.data)) {
              // Group flat raw_data rows back into sheets structure
              // raw_data keys: session_id, timestamp, standard_data, uut_data, sensor_id_uut, sensor_id_std
              // We need to reconstruct: { name: string, data: any[][] }[]
              // Since we don't store sheet names in raw_data, we might have to genericize or guess.
              // Or, we just show "Loaded Data" as one sheet if we can't distinguish.
              // BUT, the raw_data table usually has `sensor_id_uut`. 
              // We can group by `sensor_id_uut`.

              const grouped: Record<number, any[]> = {};
              data.data.forEach((row: any) => {
                const key = row.sensor_id_uut || 'unknown';
                if (!grouped[key]) grouped[key] = [['Timestamp', 'Standard', 'UUT']]; // Headers
                grouped[key].push([
                  row.timestamp,
                  row.standard_data,
                  row.uut_data
                ]);
              });

              const reconstructedSheets = Object.keys(grouped).map((key, idx) => ({
                name: `Sensor ${key === 'unknown' ? 'Unknown' : key}`,
                data: grouped[key] as any[],
                sensor_id_uut: key === 'unknown' ? null : Number(key),
                sensor_id_std: data.data.find((d: any) => (d.sensor_id_uut == key))?.sensor_id_std
              }));

              if (reconstructedSheets.length > 0) {
                setRawData(reconstructedSheets);
                setRawDataFilename(`Session ${sessionId} Data`);
              }
            }
          })
          .catch(err => console.error("Failed to load raw data", err));
      } else {
        setRawData([]);
        setRawDataFilename(null);
      }
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
        station_address: null as any,
      })
      setResults([{
        sensorId: null,
        startDate: '',
        endDate: '',
        place: '',
        environment: [],
        table: [{ title: '', rows: [{ key: '', unit: '', value: '', extraValues: [] }] }], // Initialize with extraValues
        images: [],
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

    // Prevent multiple submissions
    if (submitDisabled || isSubmitting) return

    if (!form.no_certificate || !form.no_order || !form.no_identification || !form.issue_date) {
      showError('Semua field yang wajib diisi harus diisi')
      return
    }

    if (!(form as any).verifikator_1 || !(form as any).verifikator_2) {
      showError('Verifikator 1 dan Verifikator 2 harus dipilih')
      return
    }

    // Validasi: assignor, verifikator 1, dan verifikator 2 tidak boleh sama
    const assignor = form.authorized_by
    const verifikator1 = (form as any).verifikator_1
    const verifikator2 = (form as any).verifikator_2

    if (assignor && verifikator1 && assignor === verifikator1) {
      showError('Assignor tidak boleh sama dengan Verifikator 1')
      return
    }

    if (assignor && verifikator2 && assignor === verifikator2) {
      showError('Assignor tidak boleh sama dengan Verifikator 2')
      return
    }

    if (verifikator1 && verifikator2 && verifikator1 === verifikator2) {
      showError('Verifikator 1 tidak boleh sama dengan Verifikator 2')
      return
    }

    setIsSubmitting(true)
    setSubmitDisabled(true)

    try {
      const payload: any = { ...form, results }
      // Ensure creator is tracked so the creator can see their own certificates
      if (user?.id) {
        if (payload.sent_by == null) payload.sent_by = String(user.id)
        if (payload.created_by == null) payload.created_by = String(user.id)
      }

      // Update instrument name if instrument is selected
      if (form.instrument) {
        const selectedInstrument = instruments.find(i => i.id === form.instrument)
        if (selectedInstrument && (!selectedInstrument.name || selectedInstrument.name === 'Instrument')) {
          // Generate name from manufacturer + type + serial
          const generatedName = `${selectedInstrument.manufacturer || 'Unknown'} ${selectedInstrument.type || 'Instrument'} ${selectedInstrument.serial_number || ''}`.trim()

          try {
            await fetch(`/api/instruments/${form.instrument}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...selectedInstrument,
                name: generatedName
              })
            })
            console.log('Updated instrument name:', generatedName)
          } catch (error) {
            console.error('Failed to update instrument name:', error)
          }
        }
      }


      // Helper to save session and raw data (reused for create and update)
      const saveSessionAndRawData = async () => {
        try {
          const sessionPayload = {
            station_id: form.station,
            instrument_id: form.instrument, // Pass instrument ID for uut_instrument_id
            start_date: sessionDetails.start_date || new Date().toISOString(), // Ensure start_date (mapped to tgl_kalibrasi)
            end_date: sessionDetails.end_date,
            place: sessionDetails.place,
            notes: sessionDetails.notes,
            status: 'draft'
          }

          const sessionRes = await fetch('/api/calibration-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionPayload)
          })

          if (sessionRes.ok) {
            const sessionData = await sessionRes.json()
            console.log('Session Created/Found:', sessionData)

            // If Raw Data exists, save it linked to Session
            if (rawData.length > 0) {
              // Validate: Ensure all sheets have a selected UUT Sensor
              const missingUUT = rawData.some((_, idx) => !results[idx]?.sensorId);
              if (missingUUT) {
                showError("Mohon pilih Sensor UUT untuk setiap sheet data mentah sebelum menyimpan.");
                return null;
              }

              const rawDataPayload = {
                session_id: sessionData.session_id, // Found correct PK is session_id
                data: rawData.map((sheet, idx) => {
                  // Resolve sensor_id_std (Sensor ID)
                  // standardInstrumentId and globalStandardInstrumentId are Instrument IDs (References to 'instrument' table)
                  // We need to find the 'sensor' (is_standard=true) ID belonging to that instrument.

                  let targetInstrumentId = results[idx]?.standardInstrumentId ?? globalStandardInstrumentId ?? null;
                  let stdSensorId: number | null = null;

                  if (targetInstrumentId) {
                    // 1. Try to get it from the selected Certificate (most accurate)
                    // Only valid if using global standard and verified certificate
                    if (globalStandardInstrumentId && targetInstrumentId === globalStandardInstrumentId && globalStandardCertificateNumber) {
                      const cert = standardCerts.find(c => c.no_certificate === globalStandardCertificateNumber);
                      if (cert) stdSensorId = cert.sensor_id;
                    }

                    // 2. Fallback: Find a sensor marked as standard in the selected instrument
                    if (!stdSensorId) {
                      const inst = instruments.find(i => i.id === targetInstrumentId);
                      // Ensure we are looking at the instrument object, it should have a 'sensor' array from the API
                      const stdSensor = inst?.sensor?.find((s: any) => s.is_standard);
                      if (stdSensor) {
                        stdSensorId = stdSensor.id;
                      } else {
                        // Fallback 3: If no sensor is marked standard (legacy data?), try to use the first sensor?
                        // Or log warning. For now, let's try just taking the first one if only 1 exists
                        if (inst?.sensor?.length === 1) {
                          stdSensorId = inst.sensor[0].id;
                        }
                      }
                    }
                  }

                  return {
                    name: sheet.name,
                    data: sheet.data,
                    sensor_id_uut: results[idx]?.sensorId ?? null,
                    sensor_id_std: stdSensorId,
                  }
                })
              };

              console.log('DEBUG: Sending Raw Data Payload:', JSON.stringify(rawDataPayload, null, 2));

              const rawRes = await fetch('/api/raw-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...rawDataPayload,
                  filename: 'import.xlsx',
                  uploaded_by: user?.id
                })
              })

              if (!rawRes.ok) {
                const errData = await rawRes.json().catch(() => ({}));
                console.error('Raw Data Validation Error:', errData);
                const errMsg = errData.error || errData.message || rawRes.statusText || 'Unknown Server Error';
                throw new Error(`Gagal menyimpan data mentah: ${errMsg} (Status: ${rawRes.status})`);
              }

              const rawResData = await rawRes.json();
              console.log('Raw Data saved linked to session:', sessionData.session_id, rawResData)
            }
            return sessionData.session_id
          }
        } catch (sessionErr) {
          console.error('Failed to save session/raw data', sessionErr)
        }
        return null
      }

      if (editing) {
        let sessionId: string | null = null;

        // Save Session & Raw Data if present
        if (rawData.length > 0) {
          sessionId = await saveSessionAndRawData()
        }

        // Inject session_id into results if we have a new session, or keep existing results
        // If sessionId is null, we use existing results (which might already have session_id or not)
        // If rawData was uploaded, we want to update the session_id
        const finalResults = sessionId
          ? results.map(r => ({ ...r, session_id: sessionId }))
          : results;

        // Update Certificate
        await updateCertificate(editing.id, { ...payload, results: finalResults } as any)

        showSuccess('Certificate berhasil diperbarui!')

        // If edit came from certificate verification, redirect back there
        if (isEditFromVerification()) {
          closeModal()
          router.push('/certificate-verification')
          return
        }
      } else {
        // Create Certificate

        // Create Calibration Session & Save Raw Data first
        const sessionId = await saveSessionAndRawData()

        // Inject session_id into results
        const finalResults = sessionId
          ? results.map(r => ({ ...r, session_id: sessionId }))
          : results;

        await addCertificate({ ...payload, results: finalResults } as any)
        showSuccess('Certificate & Session berhasil dibuat!')
      }
      closeModal()
    } catch (e) {
      console.error('Error submitting certificate:', e)
      const errorMessage = e instanceof Error ? e.message : 'Terjadi kesalahan saat menyimpan certificate'
      showError(errorMessage)
    } finally {
      setIsSubmitting(false)
      // Re-enable submit after 2 seconds to prevent rapid clicking
      setTimeout(() => setSubmitDisabled(false), 2000)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus certificate ini?')) return

    setIsDeleting(id)
    try {
      await deleteCertificate(id)
      showSuccess('Certificate berhasil dihapus!')
    } catch (e) {
      console.error('Error deleting certificate:', e)
      const errorMessage = e instanceof Error ? e.message : 'Terjadi kesalahan saat menghapus certificate'
      showError(errorMessage)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleCompleteRepair = async (certificate: Certificate) => {
    if (!confirm('Tandai perbaikan sertifikat ini sebagai selesai?')) return

    const result = await completeRepair(certificate.id, 'Repair completed')

    if (result.success) {
      showSuccess('Perbaikan berhasil diselesaikan!')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } else {
      showError('Gagal menyelesaikan perbaikan: ' + (result.error || 'Unknown error'))
    }
  }

  const handleResetVerification = async (certificate: Certificate) => {
    if (!confirm('Reset verifikasi untuk sertifikat ini? Ini akan menghapus semua verifikasi yang ada.')) return

    const result = await resetVerification(certificate.id)

    if (result.success) {
      showSuccess('Verifikasi berhasil direset!')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } else {
      showError('Gagal mereset verifikasi: ' + (result.error || 'Unknown error'))
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
      {/* Alert Component */}
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      {/* Header dengan background putih dan aksen biru elegan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 relative overflow-hidden">
        <BatikBackground />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <Breadcrumb items={[{ label: 'Documents', href: '#' }, { label: 'Certificates' }]} />
          </div>
          {can('certificate', 'create') && (
            <button
              onClick={() => openModal()}
              id="btn-add-certificate"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm ${isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c]'
                }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="font-semibold">Processing...</span>
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  <span className="font-semibold">Create New</span>
                </>
              )}
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Certificate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Station & Instrument</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Verification Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Workflow Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentCertificates.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {item.no_certificate}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.no_order} • {item.no_identification}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.issue_date).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">
                        {item.station ? stations.find(s => s.id === item.station)?.name || 'Unknown' : '-'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.instrument ? instruments.find(i => i.id === item.instrument)?.name || 'Unknown' : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">Verifikator 1:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${(item as any).verifikator_1_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_1_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                          {(item as any).verifikator_1_status || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">Verifikator 2:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${(item as any).verifikator_2_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_2_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                          {(item as any).verifikator_2_status || 'pending'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${item.status === 'draft' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      item.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        item.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                          item.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            item.status === 'completed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>
                      {item.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium space-x-1">
                    {/* Draft View Button - only show for draft status */}
                    {item.status === 'draft' && (
                      <a
                        href={`/draft-view?certificate=${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center p-1.5 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-all duration-200 border border-transparent hover:border-yellow-200"
                        title="View Draft"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}

                    <a
                      href={`/certificates/${item.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                      title="View Certificate"
                    >
                      <ViewIcon className="w-4 h-4" />
                    </a>

                    {/* View PDF Button - show if PDF is already generated (level 3 approved) */}
                    {item.pdf_path && (
                      <a
                        href={`/api/certificates/${item.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200"
                        title="View Saved PDF (Generated when Level 3 approved)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}

                    {/* Print LHKS Button */}
                    <button
                      onClick={() => handlePrintLHKS(item)}
                      className="inline-flex items-center p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200 border border-transparent hover:border-purple-200"
                      title="Print LHKS (Laporan Hasil Kalibrasi Sementara)"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </button>

                    {/* Download PDF Button - generate on-demand or download saved PDF */}
                    <button
                      onClick={async () => {
                        try {
                          // Use saved PDF endpoint if available, otherwise generate on-demand
                          const pdfEndpoint = item.pdf_path
                            ? `/api/certificates/${item.id}/pdf`
                            : `/api/certificates/${item.id}/download-pdf`

                          const response = await fetch(pdfEndpoint)
                          if (!response.ok) {
                            throw new Error('Failed to get PDF')
                          }

                          // Get filename from Content-Disposition header or use default
                          const contentDisposition = response.headers.get('Content-Disposition')
                          let filename = `Certificate_${item.no_certificate || item.id}.pdf`
                          if (contentDisposition) {
                            // Try to extract filename from Content-Disposition header
                            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
                            if (filenameMatch && filenameMatch[1]) {
                              filename = filenameMatch[1].replace(/['"]/g, '')
                              // Decode URI if needed
                              if (filename.includes('%')) {
                                filename = decodeURIComponent(filename)
                              }
                            }
                          }

                          // Ensure filename ends with .pdf
                          if (!filename.toLowerCase().endsWith('.pdf')) {
                            filename = `${filename}.pdf`
                          }

                          // Create blob with correct MIME type and download
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = filename
                          a.type = 'application/pdf'
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (err) {
                          console.error('Error downloading PDF:', err)
                          showError('Failed to download PDF. Please try again.')
                        }
                      }}
                      className="inline-flex items-center p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200"
                      title={item.pdf_path ? "Download Saved PDF" : "Generate and Download PDF"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>

                    <a
                      href={`/certificates/${item.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200"
                      title="Print Certificate"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </a>

                    {/* QC Check Button */}
                    <button
                      onClick={() => {
                        const sessionId = Array.isArray(item.results) && item.results.length > 0
                          ? (item.results[0] as any).session_id
                          : null;

                        if (sessionId) {
                          setQcModalCertificate(item);
                          setShowQCModal(true);
                        } else {
                          showError("Data QC tidak tersedia. Pastikan sertifikat ini memiliki data mentah yang tersimpan (session_id).");
                        }
                      }}
                      className="inline-flex items-center p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200 border border-transparent hover:border-indigo-200"
                      title="QC Check (Raw Data)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Edit Button - only show for draft status */}
                    {item.status === 'draft' && can('certificate', 'update') && (
                      <button
                        onClick={() => openModal(item)}
                        className="inline-flex items-center p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200 border border-transparent hover:border-purple-200"
                        title="Edit Certificate"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    )}

                    {can('certificate', 'delete') && canEndpoint('DELETE', `/api/certificates/${item.id}`) && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting === item.id}
                        className={`inline-flex items-center p-1.5 rounded-lg transition-all duration-200 border border-transparent ${isDeleting === item.id
                          ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                          : 'text-red-600 hover:text-red-800 hover:bg-red-50 hover:border-red-200'
                          }`}
                        title={isDeleting === item.id ? "Deleting..." : "Delete Certificate"}
                      >
                        {isDeleting === item.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                        ) : (
                          <DeleteIcon className="w-4 h-4" />
                        )}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${currentPage === page
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 overflow-hidden">
          <div className="w-full h-full bg-white shadow-xl overflow-hidden border border-[#1e377c] relative flex flex-col">
            {/* Header Modal - Info Sesi */}
            <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 overflow-hidden shrink-0">
              <ModalBatikHeader />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <CertificateIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">
                      Kalibrasi Sensor
                    </h2>
                    <div className="flex items-center text-blue-100 text-xs mt-1 space-x-2">
                      <span>Kalibrasi</span>
                      <span>/</span>
                      <span className="font-semibold text-white">{editing ? 'Edit Sesi' : 'Sesi Baru'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Opsional: Dropdown Pilih Sesi jika needed */}
                  <button
                    onClick={closeModal}
                    className="text-white hover:text-blue-200 transition-colors p-1.5 rounded-lg hover:bg-white/10 relative z-20"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
              <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto">

                {/* Bagian I – Data Sertifikat & Stasiun (Restored) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Data Sertifikat & Stasiun
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Stasiun & Alamat */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Stasiun</label>
                      <SearchableDropdown
                        id="form-station"
                        value={form.station}
                        onChange={(value) => {
                          const selectedId = (value as number | null)
                          const st = stations.find(s => s.id === selectedId)
                          setForm({
                            ...form,
                            station: selectedId,
                            station_address: st ? (st as any).address ?? null : null
                          })
                        }}
                        options={stations.map(s => ({ id: s.id, name: s.name, station_id: s.station_id }))}
                        placeholder="Pilih Stasiun"
                        searchPlaceholder="Cari stasiun..."
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Alamat Stasiun</label>
                      <textarea
                        value={(form as any).station_address || (form.station ? (stations.find(s => s.id === form.station)?.address ?? '') : '')}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
                        rows={2}
                      />
                    </div>

                    {/* Certificate Numbers */}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                        />
                      </div>
                    ))}

                    {/* Signatories */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Authorized By</label>
                      <SearchableDropdown
                        id="form-authorized-by"
                        value={form.authorized_by}
                        onChange={(value) => setForm({ ...form, authorized_by: value as string | null })}
                        options={personel
                          .filter(p => p.role === 'assignor')
                          .map(p => ({
                            id: p.id,
                            name: p.nip ? `${p.name} (${p.nip})` : p.name,
                            station_id: p.id.slice(0, 8),
                            nip: p.nip || ''
                          }))}
                        placeholder="Pilih personel"
                        searchPlaceholder="Cari authorized by..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Verifikator 1 *</label>
                      <SearchableDropdown
                        id="form-verifikator-1"
                        value={(form as any).verifikator_1 ?? null}
                        onChange={(value) => setForm({ ...form, verifikator_1: value as string | null } as any)}
                        options={personel
                          .filter(p => p.role === 'verifikator')
                          .map(p => ({
                            id: p.id,
                            name: p.nip ? `${p.name} (${p.nip})` : p.name,
                            station_id: p.id.slice(0, 8),
                            nip: p.nip || ''
                          }))}
                        placeholder="Pilih verifikator 1"
                        searchPlaceholder="Cari verifikator 1..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Verifikator 2 *</label>
                      <SearchableDropdown
                        id="form-verifikator-2"
                        value={(form as any).verifikator_2 ?? null}
                        onChange={(value) => setForm({ ...form, verifikator_2: value as string | null } as any)}
                        options={personel
                          .filter(p => p.role === 'verifikator')
                          .map(p => ({
                            id: p.id,
                            name: p.nip ? `${p.name} (${p.nip})` : p.name,
                            station_id: p.id.slice(0, 8),
                            nip: p.nip || ''
                          }))}
                        placeholder="Pilih verifikator 2"
                        searchPlaceholder="Cari verifikator 2..."
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian II – Detail Sesi Kalibrasi (Global Session Info) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Detail Sesi Kalibrasi (Global)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Tanggal Mulai</label>
                      <input
                        type="datetime-local"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                        value={sessionDetails.start_date}
                        onChange={e => setSessionDetails({ ...sessionDetails, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Tanggal Selesai</label>
                      <input
                        type="datetime-local"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                        value={sessionDetails.end_date}
                        onChange={e => setSessionDetails({ ...sessionDetails, end_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Tempat Kalibrasi</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                        placeholder="Laboratorium Kalibrasi BMKG..."
                        value={sessionDetails.place}
                        onChange={e => setSessionDetails({ ...sessionDetails, place: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian III – Unggah Data Mentah & Identitas Alat */}
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2 px-1">
                  <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                  Data Mentah & Identitas Alat
                </h3>

                {/* 0. Pilih Instrument (Parent) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Left Column: UUT Instrument */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative group hover:border-[#1e377c]/30 transition-all">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#1e377c] rounded-l-xl"></div>
                    <div className="flex items-center justify-between mb-4 pl-2">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <InstrumentIcon className="w-5 h-5 text-[#1e377c]" />
                        Pilih Instrument (UUT)
                      </h3>
                      <a href="/instruments" target="_blank" className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                        + Tambah Instrument Baru
                      </a>
                    </div>
                    <div className="space-y-1">
                      {/* DEBUGGER FOR MISSING INSTRUMENTS */}
                      {form.station && (
                        <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-[10px] font-mono mb-2 text-gray-700">
                          <strong>DEBUG INFO (Station ID: {String(form.station)})</strong>
                          <ul className="list-disc pl-4 mt-1">
                            {instruments
                              .filter(i => {
                                // Show ALL instruments that match the Station ID OR Name (to detect ID mismatch)
                                const sId = i.station?.id || (i as any).station_id;
                                // Basic loose check
                                return String(sId) === String(form.station);
                              })
                              .map(i => {
                                const isStandard = i.sensor?.some((s: any) => s.is_standard === true);
                                return (
                                  <li key={i.id} className={isStandard ? "text-red-600 font-bold" : "text-green-600"}>
                                    {i.name} (ID: {i.id}) - {isStandard ? "HIDDEN (Standard)" : "VISIBLE (UUT)"}
                                  </li>
                                );
                              })}
                          </ul>
                          <div className="mt-1 border-t border-yellow-200 pt-1">
                            Ref: {instruments.length} total fetched.
                          </div>
                        </div>
                      )}
                      <label className="text-xs font-semibold text-gray-600">Instrument *</label>
                      <SearchableDropdown
                        value={form.instrument}
                        onChange={(val) => {
                          setForm({ ...form, instrument: val as number });
                          // Reset child selections when parent changes
                          setResults(prev => prev.map((r, i) => i === 0 ? { ...r, sensorId: null, sensorDetails: undefined } : r));
                          setInstrumentPreview({});
                        }}
                        options={instruments
                          .filter(i => {
                            // Filter by Station
                            if (form.station) {
                              const stationId = i.station?.id || (i as any).station_id;
                              if (String(stationId) !== String(form.station)) return false;
                            }

                            // Filter UUT Only (Exclude Standards)
                            // Check if any sensor is marked as standard
                            const isStandard = i.sensor?.some((s: any) => s.is_standard === true);
                            return !isStandard;
                          })
                          .map(i => ({
                            id: i.id,
                            name: `${i.name} (${i.manufacturer} ${i.type} SN:${i.serial_number})`,
                            station_id: i.station?.name || ''
                          }))}
                        placeholder="Pilih Instrument..."
                        searchPlaceholder="Cari Instrument..."
                      />
                    </div>
                  </div>

                  {/* Right Column: Global Standard Instrument Selection */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative group hover:border-green-200 transition-all">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-600 rounded-l-xl"></div>
                    <div className="flex items-center justify-between mb-4 pl-2">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <CertificateIcon className="w-5 h-5 text-green-600" />
                        Alat Standar
                      </h3>
                      <button type="button" className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition-colors">
                        + Tambah Sertifikat
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Step 1: Instrument Standar (Global) */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">1. Pilih Instrument Standar *</label>
                        <SearchableDropdown
                          value={globalStandardInstrumentId}
                          onChange={(val) => {
                            setGlobalStandardInstrumentId(val as number);
                            setGlobalStandardCertificateNumber(null);
                            // Reset sensor selections in rows that depended on the old standard
                            setResults(prev => prev.map(r => ({
                              ...r,
                              standardCertificateId: null // Reset selected sensor
                            })));
                          }}
                          options={instruments
                            .filter(i => {
                              // Show ALL standard instruments regardless of station
                              return i.sensor?.some((s: any) => s.is_standard === true);
                            })
                            .map(i => ({
                              id: i.id,
                              name: `${i.name} (${i.manufacturer} ${i.type})`,
                              station_id: i.station?.name || ''
                            }))}
                          placeholder="Pilih Instrument Standar..."
                          searchPlaceholder="Cari Instrument Standar..."
                        />
                      </div>

                      {/* Step 2: Nomor Sertifikat (Global) */}
                      <div className={`space-y-1 transition-opacity ${!globalStandardInstrumentId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <label className="text-xs font-semibold text-gray-600">2. Pilih Nomor Sertifikat *</label>
                        <SearchableDropdown
                          value={globalStandardCertificateNumber}
                          onChange={(val) => {
                            setGlobalStandardCertificateNumber(val as string);
                            // Reset sensor selections
                            setResults(prev => prev.map(r => ({
                              ...r,
                              standardCertificateId: null
                            })));
                          }}
                          options={(() => {
                            if (!globalStandardInstrumentId) return [];
                            // Get certs for the selected instrument
                            const certsForInst = standardCerts.filter(c => {
                              const sensor = sensors.find(s => s.id === c.sensor_id);
                              return sensor && sensor.instrument_id === globalStandardInstrumentId;
                            });
                            // Group by number (normalize by trimming)
                            const uniqueNos = Array.from(new Set(certsForInst.map(c => c.no_certificate.trim())));
                            return uniqueNos.map(no => ({
                              id: no,
                              name: no,
                              station_id: `${certsForInst.find(c => c.no_certificate.trim() === no)?.calibration_date || ''}`
                            }));
                          })()}
                          placeholder={globalStandardInstrumentId ? "Pilih Nomor Sertifikat..." : "Pilih Instrument Terlebih Dahulu"}
                          searchPlaceholder="Cari Nomor Sertifikat..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Mentah Upload Positioned Here (Moved from Bottom) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                  <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <FileTextIcon className="w-5 h-5 text-gray-600" />
                    Data Mentah (Multi-sheet)
                  </h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-3">
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${rawDataFilename ? 'border-green-300 bg-green-50/30' : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'}`}>
                        <input
                          type="file"
                          className="hidden"
                          id="raw-upload"
                          accept=".xlsx,.csv"
                          onChange={handleRawDataUpload}
                          disabled={isImporting}
                        />
                        <label htmlFor="raw-upload" className="cursor-pointer flex flex-col items-center">
                          {isImporting ? (
                            <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                          ) : rawDataFilename ? (
                            <div className="p-3 bg-green-100 rounded-full shadow-sm mb-3">
                              <FileTextIcon className="w-6 h-6 text-green-600" />
                            </div>
                          ) : (
                            <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            </div>
                          )}

                          {isImporting ? (
                            <span className="text-sm font-semibold text-gray-700">Memproses file...</span>
                          ) : rawDataFilename ? (
                            <>
                              <span className="text-sm font-bold text-gray-800">{rawDataFilename}</span>
                              <span className="text-xs text-green-600 mt-1">Klik untuk ganti file</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-semibold text-gray-700">Klik untuk upload Excel/CSV</span>
                              <span className="text-xs text-gray-500 mt-1">Format: Multi-sheet (Sheet 1 = Sensor 1, dst)</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Detected Sheets List */}
                    <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center justify-between">
                        <span>Sensor Terdeteksi (Sheets)</span>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{rawData.length}</span>
                      </h4>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {rawData.length === 0 ? (
                          <div className="text-xs text-center text-gray-400 py-4 italic">Belum ada data diupload</div>
                        ) : (
                          rawData.map((sheet, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded shadow-sm">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-xs font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">#{i + 1}</span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-gray-800 truncate" title={sheet.name}>{sheet.name}</div>
                                  <div className="text-[10px] text-gray-500">{sheet.data.length} baris</div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Show preview button only if data loaded */}
                      {rawData.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowRawDataModal(true)}
                          className="w-full mt-4 bg-gray-800 text-white text-xs py-2 rounded-lg hover:bg-gray-700 font-semibold transition-colors"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <EyeIcon className="w-4 h-4" /> Lihat Preview Raw Data
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* DYNAMIC SENSOR INPUTS LOOP */}
                {results.map((result, resultIndex) => (
                  <div key={resultIndex} className="bg-gray-50/50 rounded-xl border border-gray-200 p-4 mb-6 relative">
                    {/* Loop Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#1e377c] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                          {resultIndex + 1}
                        </span>
                        <h4 className="text-sm font-bold text-gray-800">
                          Sensor #{resultIndex + 1}
                          {rawData[resultIndex] && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-normal">Sheet: {rawData[resultIndex].name}</span>}
                        </h4>
                      </div>
                      {results.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeResult(resultIndex)}
                          className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                          <TrashIcon className="w-3 h-3" /> Hapus Sensor
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 1. Alat UUT */}
                      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden group transition-all ${!form.instrument ? 'opacity-60 pointer-events-none grayscale' : 'hover:border-[#1e377c]/30'}`}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#1e377c]"></div>
                        <div className="flex items-center justify-between mb-4 pl-2">
                          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <SensorIcon className="w-5 h-5 text-[#1e377c]" />
                            Alat UUT (Unit Under Test)
                          </h3>
                          {/* Only show 'Tambah Sensor' if we want to support multiple sensors per sheet? No, usually 1 UUT per sheet line item. */}
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">Pilih Sensor UUT *</label>
                            <SearchableDropdown
                              value={result.sensorId || null}
                              onChange={(val) => {
                                if (!val) {
                                  applySensorToResult(resultIndex, null);
                                  return;
                                }
                                applySensorToResult(resultIndex, val as number);
                              }}
                              // Filter sensors based on selected instrument
                              options={sensors
                                .filter(s => form.instrument ? s.instrument_id === form.instrument : true) // Show only sensors belonging to instrument
                                .filter(s => !s.is_standard)
                                .map(s => ({
                                  id: s.id,
                                  name: s.name || `Sensor ${s.id}`,
                                  station_id: `${s.id}` // extra info
                                }))}
                              placeholder={form.instrument ? "Pilih Sensor UUT..." : "Pilih Instrument Terlebih Dahulu"}
                              searchPlaceholder="Cari Sensor..."
                            />
                          </div>

                          {/* Detail UUT Form (Editable) */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detail Sensor (Dapat Diedit)</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  // Use the sensor from results[resultIndex].sensorId
                                  const currentSensorId = result.sensorId;
                                  const sensor = sensors.find(s => s.id === currentSensorId);
                                  if (sensor) {
                                    applySensorToResult(resultIndex, currentSensorId);
                                  }
                                }}
                                className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                              >
                                Reset ke Default
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-gray-500">Pabrikan</label>
                                <input
                                  type="text"
                                  value={result.sensorDetails?.manufacturer || instrumentPreview.manufacturer || ''}
                                  onChange={e => updateResult(resultIndex, { sensorDetails: { ...result.sensorDetails, manufacturer: e.target.value } })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#1e377c]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-gray-500">Tipe</label>
                                <input
                                  type="text"
                                  value={result.sensorDetails?.type || instrumentPreview.type || ''}
                                  onChange={e => updateResult(resultIndex, { sensorDetails: { ...result.sensorDetails, type: e.target.value } })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#1e377c]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-gray-500">Serial Number</label>
                                <input
                                  type="text"
                                  value={result.sensorDetails?.serial_number || instrumentPreview.serial || ''}
                                  onChange={e => updateResult(resultIndex, { sensorDetails: { ...result.sensorDetails, serial_number: e.target.value } })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#1e377c]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-gray-500">Range/Kapasitas</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Nilai"
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#1e377c]"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Unit"
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#1e377c]"
                                  />
                                </div>
                              </div>
                              {/* ... more inputs can go here, simplified for now ... */}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Alat Standar */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden group hover:border-[#1e377c]/30 transition-all">
                        <div className="absolute top-0 right-0 w-1 h-full bg-green-600"></div>
                        <div className="flex items-center justify-between mb-4 pr-2">
                          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <CertificateIcon className="w-5 h-5 text-green-700" />
                            Alat Standar
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {/* Step 3: Pilih Sensor Standar (Now the ONLY step here) */}
                          <div className={`space-y-1 ${!globalStandardInstrumentId || !globalStandardCertificateNumber ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <label className="text-xs font-semibold text-gray-600">Pilih Sensor Standar *</label>
                            <SearchableDropdown
                              value={result.standardCertificateId || null}
                              onChange={(val) => {
                                const certId = val as number;
                                const selectedCert = standardCerts.find(c => c.id === certId);
                                const sensorId = selectedCert?.sensor_id;

                                updateResult(resultIndex, {
                                  // Sync global values into this result item ensures data integrity
                                  standardInstrumentId: globalStandardInstrumentId,
                                  standardCertificateNumber: globalStandardCertificateNumber,
                                  standardCertificateId: certId,
                                  notesForm: {
                                    ...result.notesForm,
                                    // Store the SENSOR ID in notesForm, as that's what backend expects for "standardInstruments"
                                    standardInstruments: sensorId ? [sensorId] : []
                                  }
                                });
                              }}
                              options={standardCerts
                                .filter(c => {
                                  if (!globalStandardInstrumentId || !globalStandardCertificateNumber) return false;
                                  return c.no_certificate.trim() === globalStandardCertificateNumber;
                                })
                                .map(c => {
                                  const s = sensors.find(sen => sen.id === c.sensor_id);
                                  const sensorName = s?.name || 'Sensor Unknown';
                                  const sensorType = s?.type || '';
                                  const sn = s?.serial_number || '-';

                                  // Format: "Temperature (HMP155)"
                                  const mainLabel = `${sensorName} ${sensorType ? `(${sensorType})` : ''}`;

                                  // Subtitle: "S/N: 12345 | Range: -80 to 60 degC | Drift: 0.01"
                                  const details = `S/N: ${sn} • Range: ${c.range || '-'} • Drift: ${c.drift ?? '-'}`;

                                  return {
                                    id: c.id,
                                    name: mainLabel,
                                    station_id: details
                                  };
                                })}
                              placeholder={globalStandardCertificateNumber ? "Pilih Sensor dari Sertifikat ini..." : "Pilih Alat Standar & Sertifikat di Atas"}
                              searchPlaceholder="Cari Sensor..."
                            />
                            {(!globalStandardInstrumentId || !globalStandardCertificateNumber) && (
                              <p className="text-[10px] text-red-500 italic mt-1">
                                * Silakan pilih Instrument Standar & Nomor Sertifikat di bagian atas terlebih dahulu.
                              </p>
                            )}
                          </div>

                          {(() => {
                            const selectedStandard = standardCerts.find(c => c.id === result.standardCertificateId);
                            return selectedStandard ? (
                              <div className="grid grid-cols-2 gap-3 bg-green-50/50 p-3 rounded-lg border border-green-100">
                                <div className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Detail Sertifikat & Sensor</div>
                                {[
                                  { label: 'No. Sertifikat', val: selectedStandard.no_certificate },
                                  { label: 'Tgl Kalibrasi', val: selectedStandard.calibration_date },
                                  { label: 'Drift', val: selectedStandard.drift },
                                  { label: 'U95', val: selectedStandard.u95_general },
                                ].map((f, i) => (
                                  <div key={i}>
                                    <label className="text-[10px] text-gray-500 block">{f.label}</label>
                                    <div className="text-sm font-medium text-gray-800 text-ellipsis overflow-hidden">{f.val}</div>
                                  </div>
                                ))}
                                <div className="col-span-2 mt-1">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCorrectionStandard(selectedStandard)}
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 focus:outline-none"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Lihat Tabel Koreksi
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-400">
                                Belum ada sensor standar dipilih
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* 3. Kondisi Lingkungan & Catatan (Per Sensor) */}
                    <div className="mt-6 border-t border-gray-200 pt-6 col-span-1 lg:col-span-2">
                      <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FileTextIcon className="w-5 h-5 text-gray-600" />
                        Kondisi Lingkungan & Catatan
                      </h4>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        {/* Environment Conditions */}
                        <div className="mb-6">
                          <h5 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Kondisi Lingkungan</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {result.environment.length > 0 ? (
                              result.environment.map((env, envIdx) => (
                                <div key={envIdx} className="space-y-1">
                                  <label className="block text-xs font-semibold text-gray-600">{env.key}</label>
                                  <input
                                    value={env.value}
                                    onChange={e => {
                                      const newEnv = [...result.environment];
                                      newEnv[envIdx] = { ...newEnv[envIdx], value: e.target.value };
                                      updateResult(resultIndex, { environment: newEnv });
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="col-span-2 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <p className="text-xs text-gray-500 italic">Belum ada data kondisi lingkungan. Upload Data Mentah untuk auto-generate atau tambah manual.</p>
                                <button
                                  type="button"
                                  onClick={() => updateResult(resultIndex, { environment: [{ key: 'Suhu', value: '' }, { key: 'Kelembaban', value: '' }] })}
                                  className="mt-2 text-xs text-blue-600 hover:underline"
                                >
                                  + Tambah Manual Default (Suhu/Kelembaban)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes & References */}
                        <div className="space-y-4">
                          <h5 className="text-xs font-bold text-gray-700 border-b pb-2 uppercase tracking-wide">Catatan & Referensi</h5>

                          {/* Standard Calibration Info - Auto Populated */}
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <h5 className="text-[10px] font-bold text-blue-800 mb-2 uppercase">Standar Kalibrasi (Auto)</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="block text-gray-500 text-[10px]">Nama</span>
                                <span className="font-semibold text-gray-700">
                                  {(() => {
                                    const stdId = result.standardInstrumentId ?? globalStandardInstrumentId;
                                    if (!stdId) return '-';
                                    const inst = instruments.find(i => i.id === stdId);
                                    const sensor = inst?.sensor?.find((s: any) => s.is_standard);
                                    return sensor?.name || inst?.name || '-';
                                  })()}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-500 text-[10px]">Merk/Manufaktur</span>
                                <span className="font-semibold text-gray-700">
                                  {(() => {
                                    const stdId = result.standardInstrumentId ?? globalStandardInstrumentId;
                                    const inst = instruments.find(i => i.id === stdId);
                                    const sensor = inst?.sensor?.find((s: any) => s.is_standard);
                                    return sensor?.manufacturer || (inst as any)?.manufacturer || '-';
                                  })()}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-500 text-[10px]">Tipe</span>
                                <span className="font-semibold text-gray-700">
                                  {(() => {
                                    const stdId = result.standardInstrumentId ?? globalStandardInstrumentId;
                                    const inst = instruments.find(i => i.id === stdId);
                                    const sensor = inst?.sensor?.find((s: any) => s.is_standard);
                                    return sensor?.type || (inst as any)?.type || '-';
                                  })()}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-500 text-[10px]">No. Seri</span>
                                <span className="font-semibold text-gray-700">
                                  {(() => {
                                    const stdId = result.standardInstrumentId ?? globalStandardInstrumentId;
                                    const inst = instruments.find(i => i.id === stdId);
                                    const sensor = inst?.sensor?.find((s: any) => s.is_standard);
                                    return sensor?.serial_number || (inst as any)?.serial_number || '-';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-gray-700">Tertelusur Ke SI melalui</label>
                              <input
                                list={`traceability-options-${resultIndex}`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                                value={result.notesForm?.traceable_to_si_through || ''}
                                onChange={e => updateResult(resultIndex, { notesForm: { ...result.notesForm, traceable_to_si_through: e.target.value } })}
                                placeholder="Pilih atau ketik referensi..."
                              />
                              <datalist id={`traceability-options-${resultIndex}`}>
                                <option value="LK-01-M" />
                                <option value="SNSU-BSN" />
                              </datalist>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-gray-700">Metode Kalibrasi</label>
                              <input
                                list={`method-options-${resultIndex}`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                                value={result.notesForm?.calibration_methode || ''}
                                onChange={e => updateResult(resultIndex, { notesForm: { ...result.notesForm, calibration_methode: e.target.value } })}
                                placeholder="Pilih atau ketik metode..."
                              />
                              <datalist id={`method-options-${resultIndex}`}>
                                <option value="Perbandingan Langsung" />
                              </datalist>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-gray-700">Dokumen Acuan</label>
                              <input
                                list={`ref-doc-options-${resultIndex}`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                                value={result.notesForm?.reference_document || ''}
                                onChange={e => updateResult(resultIndex, { notesForm: { ...result.notesForm, reference_document: e.target.value } })}
                                placeholder="Pilih atau ketik dokumen..."
                              />
                              <datalist id={`ref-doc-options-${resultIndex}`}>
                                <option value="JCGM 100:2008" />
                                <option value="ISO/IEC 17025:2017" />
                              </datalist>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-gray-700">Lainnya</label>
                              <input
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                                value={result.notesForm?.others || ''}
                                onChange={e => updateResult(resultIndex, { notesForm: { ...result.notesForm, others: e.target.value } })}
                                placeholder="Keterangan tambahan..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}





                {/* Bagian V – Tabel Hasil (Only Table Result Left Here) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
                  <div className="bg-gray-100 border-b border-gray-200 flex px-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab('hasil')}
                      className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap border-[#1e377c] text-[#1e377c] bg-white`}
                    >
                      Tabel Hasil (Preview Generik)
                    </button>
                  </div>

                  <div className="p-5 min-h-[100px]">
                    {activeTab === 'hasil' && (
                      <div className="space-y-4">
                        <div className="text-center text-gray-500 py-8">
                          <FileTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="text-sm">Tabel hasil akan digenerate dari Raw Data atau input manual.</p>
                          <button type="button" onClick={() => setTableEditIndex(0)} className="mt-2 text-[#1e377c] text-sm font-semibold hover:underline">
                            Input Manual Tabel Hasil
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* Footer Action Buttons */}
                <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 -mx-4 -mb-4 flex justify-between items-center z-10">
                  <div className="text-xs text-gray-500">
                    Pastikan semua data mandatory terisi sebelum menyimpan.
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                      Simpan Sesi Kalibrasi
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div >
        </div >
      )}

      {/* Environment Modal dengan tema seragam */}
      {
        envEditIndex !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
              {/* Header Modal */}
              <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 overflow-hidden">
                <ModalBatikHeader />
                <div className="relative z-10 flex items-center justify-between">
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
                    className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10 relative z-20"
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
                            v[i] = { ...v[i], key: e.target.value };
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
                            v[i] = { ...v[i], value: e.target.value };
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
                  id="btn-save-env-conditions"
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
        )
      }

      {/* Table Result Modal dengan tema seragam */}
      {
        tableEditIndex !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
              {/* Header Modal */}
              <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 overflow-hidden">
                <ModalBatikHeader />
                <div className="relative z-10 flex items-center justify-between">
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
                    className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10 relative z-20"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[60vh] overflow-y-auto p-4 bg-gradient-to-br from-white to-gray-50/30">
                <div className="space-y-4">
                  {tableDraft.map((section, si) => (
                    <div key={si} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 space-y-1">
                          <label className="block text-xs font-semibold text-gray-700">Judul Bagian</label>
                          <input
                            value={section.title}
                            onChange={e => {
                              const v = [...tableDraft];
                              v[si] = { ...v[si], title: e.target.value };
                              setTableDraft(v)
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e377c] text-sm"
                            placeholder="Contoh: Hasil Pengukuran"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const v = [...tableDraft];
                            v.splice(si, 1);
                            setTableDraft(v.length > 0 ? v : [{ title: '', rows: [{ key: '', unit: '', value: '', extraValues: [] }] }]);
                          }}
                          className="ml-3 inline-flex items-center p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
                          title="Hapus Bagian Tabel"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>

                        {/* Import Excel Button */}
                        <div className="ml-2 relative">
                          <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => handleExcelUpload(e, si)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Import dari Excel"
                          />
                          <button
                            type="button"
                            disabled={isImporting}
                            className={`inline-flex items-center p-2 rounded-lg transition-all duration-200 border border-transparent ${isImporting
                              ? 'bg-gray-100 text-gray-400 cursor-wait'
                              : 'text-green-600 hover:text-green-800 hover:bg-green-50 hover:border-green-200'}`}
                            title="Import dari Excel"
                          >
                            {isImporting ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Headers Editor - Dynamic */}
                        <div className={`grid grid-cols-1 md:grid-cols-${(section.headers || ['Parameter', 'Unit', 'Nilai']).length + 1} gap-2 p-2 border-b border-gray-100 bg-gray-100/50 rounded-t-lg`}>
                          {(section.headers || ['Parameter', 'Unit', 'Nilai']).map((header, hi) => (
                            <div key={hi} className="relative group">
                              <input
                                value={header}
                                onChange={e => {
                                  const v = [...tableDraft];
                                  const currentHeaders = [...(v[si].headers || ['Parameter', 'Unit', 'Nilai'])];
                                  currentHeaders[hi] = e.target.value;
                                  v[si].headers = currentHeaders;
                                  setTableDraft(v);
                                }}
                                className="w-full px-2 py-1 text-xs font-bold text-gray-700 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#1e377c] rounded focus:outline-none"
                                placeholder={`Header ${hi + 1}`}
                              />
                              {/* Allow removing ANY column */}
                              <button
                                type="button"
                                onClick={() => {
                                  const v = [...tableDraft];
                                  const currentHeaders = [...(v[si].headers || ['Parameter', 'Unit', 'Nilai'])];

                                  // Remove header
                                  currentHeaders.splice(hi, 1);
                                  v[si].headers = currentHeaders;

                                  // Helper to convert row object to array based on schema
                                  // Schema: [key, unit, value, ...extraValues]
                                  const rowToArray = (r: TableRow) => [r.key || '', r.unit || '', r.value || '', ...(r.extraValues || [])];

                                  // Helper to convert array back to row object
                                  const arrayToRow = (arr: string[]): TableRow => ({
                                    key: arr[0] || '',
                                    unit: arr[1] || '',
                                    value: arr[2] || '',
                                    extraValues: arr.slice(3)
                                  });

                                  // Update all rows: convert to array, splice, convert back
                                  v[si].rows = v[si].rows.map(row => {
                                    const arr = rowToArray(row);
                                    arr.splice(hi, 1); // Remove the column data
                                    return arrayToRow(arr);
                                  });

                                  setTableDraft(v);
                                }}
                                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Hapus Kolom"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const v = [...tableDraft];
                              const currentHeaders = [...(v[si].headers || ['Parameter', 'Unit', 'Nilai'])];
                              v[si].headers = [...currentHeaders, 'New Column'];
                              setTableDraft(v);
                            }}
                            className="flex items-center justify-center p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Tambah Kolom"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {section.rows.map((row, ri) => {
                          // Helper to access data by index dynamically
                          const rowData = [row.key || '', row.unit || '', row.value || '', ...(row.extraValues || [])];

                          return (
                            <div key={ri} className={`grid grid-cols-1 md:grid-cols-${(section.headers || ['Parameter', 'Unit', 'Nilai']).length + 1} gap-2 p-2 border border-gray-100 rounded bg-gray-50 relative`}>

                              {(section.headers || ['Parameter', 'Unit', 'Nilai']).map((header, colIdx) => (
                                <div key={colIdx} className="space-y-1">
                                  <input
                                    placeholder={header}
                                    value={rowData[colIdx] || ''}
                                    onChange={e => {
                                      const v = [...tableDraft];
                                      const newVal = e.target.value;

                                      // Update specific field based on index
                                      const r = { ...v[si].rows[ri] };

                                      // Helper function for interpolation
                                      const interpolateCorrection = (val: number, table: any[]) => {
                                        if (!table || table.length === 0) return 0;
                                        // Sort table by setpoint
                                        const sorted = [...table].sort((a, b) => parseFloat(a.setpoint) - parseFloat(b.setpoint));

                                        // Find range
                                        for (let i = 0; i < sorted.length - 1; i++) {
                                          const p1 = parseFloat(sorted[i].setpoint);
                                          const p2 = parseFloat(sorted[i + 1].setpoint);
                                          const c1 = parseFloat(sorted[i].correction);
                                          const c2 = parseFloat(sorted[i + 1].correction);

                                          if (val >= p1 && val <= p2) {
                                            // Linear interpolation
                                            return c1 + (val - p1) * (c2 - c1) / (p2 - p1);
                                          }
                                        }

                                        // Extrapolation or edge cases - clamp to nearest? or linear extend?
                                        // For now simple clamp to ends
                                        if (val < parseFloat(sorted[0].setpoint)) return parseFloat(sorted[0].correction);
                                        if (val > parseFloat(sorted[sorted.length - 1].setpoint)) return parseFloat(sorted[sorted.length - 1].correction);
                                        return 0;
                                      };

                                      if (colIdx === 0) r.key = newVal;
                                      else if (colIdx === 1) r.unit = newVal;
                                      else if (colIdx === 2) r.value = newVal;
                                      else {
                                        const extras = [...(r.extraValues || [])];
                                        while (extras.length < colIdx - 3) extras.push('');
                                        extras[colIdx - 3] = newVal;
                                        r.extraValues = extras;
                                      }

                                      // Auto-calculate Correction if this is "Standard Reading" column (heuristic)
                                      // Assuming Headers: [Parameter, Unit, UUT Reading, Standard Reading, Correction, True Value]
                                      // Or searching for header names
                                      const currentHeader = (section.headers || [])[colIdx]?.toLowerCase() || '';

                                      // Define selectedStandard based on tableEditIndex
                                      const selectedStandard = tableEditIndex !== null && results[tableEditIndex]?.standardCertificateId
                                        ? standardCerts.find(c => c.id === results[tableEditIndex].standardCertificateId)
                                        : null;

                                      if ((currentHeader.includes('standard') || currentHeader.includes('standar')) && selectedStandard?.correction_std) {
                                        const stdReading = parseFloat(newVal);
                                        if (!isNaN(stdReading)) {
                                          const correction = interpolateCorrection(stdReading, selectedStandard.correction_std);
                                          const trueValue = stdReading + correction;

                                          // Find "Correction" / "Koreksi" column index
                                          const headers = (section.headers || []).map(h => h.toLowerCase());
                                          const corrIdx = headers.findIndex(h => h.includes('correction') || h.includes('koreksi'));
                                          const trueIdx = headers.findIndex(h => h.includes('true') || h.includes('benar') || h.includes('sebenarnya'));

                                          if (corrIdx >= 0) {
                                            if (corrIdx === 0) r.key = correction.toFixed(4); // Unlikely
                                            else if (corrIdx === 1) r.unit = correction.toFixed(4); // Unlikely
                                            else if (corrIdx === 2) r.value = correction.toFixed(4);
                                            else {
                                              const extras = [...(r.extraValues || [])];
                                              while (extras.length < corrIdx - 3) extras.push('');
                                              extras[corrIdx - 3] = correction.toFixed(4);
                                              r.extraValues = extras;
                                            }
                                          }

                                          if (trueIdx >= 0) {
                                            const resVal = trueValue.toFixed(4);
                                            if (trueIdx === 0) r.key = resVal;
                                            else if (trueIdx === 1) r.unit = resVal;
                                            else if (trueIdx === 2) r.value = resVal;
                                            else {
                                              const extras = [...(r.extraValues || [])];
                                              while (extras.length < trueIdx - 3) extras.push('');
                                              extras[trueIdx - 3] = resVal;
                                              r.extraValues = extras;
                                            }
                                          }
                                        }
                                      }

                                      v[si].rows[ri] = r;
                                      setTableDraft(v);
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white"
                                  />
                                </div>
                              ))}

                              <div className="flex items-center justify-end w-8">
                                {section.rows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const v = [...tableDraft];
                                      v[si].rows = v[si].rows.filter((_, index) => index !== ri);
                                      setTableDraft(v);
                                    }}
                                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-all duration-200"
                                    title="Hapus Baris"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <button
                          onClick={() => {
                            const v = [...tableDraft];
                            const newRow: TableRow = { key: '', unit: '', value: '', extraValues: [] };
                            // Pre-fill extraValues to match header count if needed (optional, logic handles undefined)
                            v[si].rows = [...v[si].rows, newRow];
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

                  {/* Conditional content based on station type */}
                  {/* Show Images only for geofisika. If type selected and not geofisika, show add table button. If no station selected, show nothing. */}
                  {getSelectedStationType() === 'geofisika' ? (
                    <div className="space-y-3">
                      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900">Gambar dan Caption</h4>
                          <button
                            type="button"
                            onClick={() => addImage(tableEditIndex)}
                            className="flex items-center gap-1 px-2 py-1 bg-[#1e377c] text-white rounded-lg hover:bg-[#2a4a9d] transition-all duration-200 text-xs font-semibold"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Tambah Gambar</span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {(results[tableEditIndex]?.images || []).map((image, imgIdx) => (
                            <div key={imgIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-semibold text-gray-700">Gambar #{imgIdx + 1}</h5>
                                <button
                                  type="button"
                                  onClick={() => removeImage(tableEditIndex, imgIdx)}
                                  className="inline-flex items-center p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-all duration-200"
                                  title="Hapus Gambar"
                                >
                                  <TrashIcon className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-gray-600">Upload Gambar</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        if (!e.target.files || e.target.files.length === 0) return
                                        const file = e.target.files[0]
                                        setIsImageUploading(true)
                                        try {
                                          const formData = new FormData()
                                          formData.append('file', file)
                                          formData.append('folder', `certificate-${editing ? editing.id : 'new'}`)
                                          const res = await fetch('/api/uploads/certificates', { method: 'POST', body: formData })
                                          const data = await res.json()
                                          if (!res.ok) {
                                            showError(data?.error || 'Gagal mengupload gambar')
                                          } else {
                                            updateImage(tableEditIndex, imgIdx, 'url', data.url)
                                            showSuccess('Gambar berhasil diupload')
                                          }
                                        } catch (err) {
                                          showError('Gagal mengupload gambar')
                                        } finally {
                                          setIsImageUploading(false)
                                        }
                                      }}
                                      className="block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1e377c] file:text-white hover:file:bg-[#2a4a9d]"
                                    />
                                    {isImageUploading && (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1e377c]"></div>
                                    )}
                                  </div>

                                  {image.url && (
                                    <div className="mt-2">
                                      <img src={image.url} alt={`preview-${imgIdx}`} className="max-h-32 rounded border border-gray-200" />
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-gray-600">Caption</label>
                                  <textarea
                                    placeholder="Deskripsi gambar..."
                                    value={image.caption}
                                    onChange={(e) => updateImage(tableEditIndex, imgIdx, 'caption', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1e377c] bg-white"
                                    rows={2}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          {(!results[tableEditIndex]?.images || (results[tableEditIndex]?.images || []).length === 0) && (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              Belum ada gambar yang ditambahkan
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : getSelectedStationType() ? (
                    <button
                      onClick={() => setTableDraft(prev => [...prev, { title: '', rows: [{ key: '', unit: '', value: '', extraValues: [] }] }])}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#1e377c] hover:bg-blue-50 transition-all duration-200 text-sm text-gray-600 hover:text-[#1e377c] w-full justify-center"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Tambah Bagian Tabel Baru
                    </button>
                  ) : null}
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
                  id="btn-save-result-table"
                  onClick={() => {
                    if (tableEditIndex === null) return;
                    const cleaned = tableDraft.map(sec => ({
                      ...sec,
                      ...sec,
                      rows: sec.rows.filter(r => r.key || r.unit || r.value || (r.extraValues && r.extraValues.some(v => v)))
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
        )
      }

      {/* Notes Modal dengan tema seragam */}
      {
        noteEditIndex !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
              {/* Header Modal */}
              <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 overflow-hidden">
                <ModalBatikHeader />
                <div className="relative z-10 flex items-center justify-between">
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
                    className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10 relative z-20"
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
                  id="btn-save-notes"
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
        )
      }

      {/* Raw Data Preview Modal */}
      {
        showRawDataModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="w-full max-w-5xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg"><EyeIcon className="w-5 h-5 text-white" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Preview Raw Data</h2>
                    <p className="text-blue-100 text-xs">{rawDataFilename || 'Data Import'} • {rawData.length} Sheets</p>
                  </div>
                </div>
                <button onClick={() => setShowRawDataModal(false)} className="text-white hover:bg-white/10 p-1 rounded-lg"><CloseIcon className="w-6 h-6" /></button>
              </div>

              {/* Tabs */}
              {rawData.length > 0 && (
                <div className="bg-gray-100 border-b border-gray-200 flex px-2 overflow-x-auto shrink-0">
                  {rawData.map((sheet, idx) => (
                    <button
                      key={idx}
                      onClick={() => setRawPreviewSheetIndex(idx)}
                      className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${rawPreviewSheetIndex === idx
                        ? 'border-[#1e377c] text-[#1e377c] bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      <div className="flex items-center gap-2">
                        <SensorIcon className="w-4 h-4" />
                        {sheet.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-auto p-4 bg-white font-mono text-xs">
                {rawData[rawPreviewSheetIndex] ? (
                  <table className="w-full border-collapse border border-gray-200">
                    <tbody>
                      {(rawData[rawPreviewSheetIndex].data as any[][]).slice(0, 100).map((row, ri) => (
                        <tr key={ri} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="p-2 text-gray-400 select-none w-10 text-right border-r border-gray-100 bg-gray-50">{ri + 1}</td>
                          {row.map((cell, ci) => (
                            <td key={ci} className="p-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap">
                              {cell !== null && cell !== undefined ? String(cell) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {(rawData[rawPreviewSheetIndex].data as any[][]).length > 100 && (
                        <tr>
                          <td colSpan={20} className="p-4 text-center text-gray-500 italic">
                            ... {(rawData[rawPreviewSheetIndex].data as any[][]).length - 100} more rows ...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center text-gray-400 py-10">No data selected</div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-gray-50 border-t border-gray-200 text-right">
                <button onClick={() => setShowRawDataModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-bold">Tutup Preview</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Standard Sensor Picker Modal dengan tema seragam */}
      {
        standardPickerIndex !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-[#1e377c] relative">
              {/* Header Modal */}
              <div className="relative bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] p-4 overflow-hidden">
                <ModalBatikHeader />
                <div className="relative z-10 flex items-center justify-between">
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
                    className="text-white hover:text-blue-200 transition-colors p-1 rounded-lg hover:bg-white/10 relative z-20"
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
                        return !q || `${(s as any).name || ''} ${(s as any).manufacturer || ''} ${(s as any).type || ''} ${(s as any).serial_number || ''}`.toLowerCase().includes(q)
                      })
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (standardPickerIndex === null) return;
                            setNoteDraft(prev => {
                              const arr = [...(prev.standardInstruments || [])]
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
        )
      }

      {/* Correction Data Modal */}
      {
        viewingCorrectionStandard && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-[#1e377c] p-4 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold text-lg">Tabel Koreksi Standar</h3>
                  <p className="text-blue-200 text-xs">
                    {viewingCorrectionStandard.no_certificate} | {viewingCorrectionStandard.calibration_date}
                  </p>
                </div>
                <button
                  onClick={() => setViewingCorrectionStandard(null)}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-0 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b">Setpoint</th>
                      <th className="px-6 py-3 border-b">Correction</th>
                      <th className="px-6 py-3 border-b">U95</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Array.isArray(viewingCorrectionStandard.correction_std) && viewingCorrectionStandard.correction_std.length > 0 ? (
                      viewingCorrectionStandard.correction_std.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">{row.setpoint}</td>
                          <td className="px-6 py-3 text-blue-700">{row.correction}</td>
                          <td className="px-6 py-3 text-gray-600">{row.u95}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500 italic bg-gray-50/30">
                          Tidak ada data koreksi tersedia untuk sertifikat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
                <button
                  onClick={() => setViewingCorrectionStandard(null)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors shadow-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* QC Modal */}
      {qcModalCertificate && (
        <QCDataModal
          isOpen={showQCModal}
          onClose={() => {
            setShowQCModal(false);
            setQcModalCertificate(null);
          }}
          title={qcModalCertificate.no_certificate}
          sessionId={
            Array.isArray(qcModalCertificate.results) && qcModalCertificate.results.length > 0
              ? (qcModalCertificate.results[0] as any).session_id
              : undefined
          }
          certificateId={String(qcModalCertificate.id)}
          certificateInstrumentId={qcModalCertificate.instrument || undefined}
          instruments={instruments}
          sensors={
            instruments.find(i => i.id === qcModalCertificate.instrument)?.sensor || []
          }
        />
      )}

      {/* LHKS Modal */}
      {lhksCertificate && (
        <LHKSReport
          isOpen={showLHKSModal}
          onClose={() => {
            setShowLHKSModal(false)
            setLhksCertificate(null)
          }}
          certificate={lhksCertificate}
          owner={stations.find(s => s.id === lhksCertificate.station) || null}
          instrument={instruments.find(i => i.id === lhksCertificate.instrument) || null}
          sensors={
            instruments.find(i => i.id === lhksCertificate.instrument)?.sensor || []
          }
          rawData={lhksRawData}
          standardCerts={standardCerts}
          calibrationDate={(lhksCertificate.results as any)?.[0]?.startDate || lhksCertificate.issue_date}
          calibrationLocation={(lhksCertificate.results as any)?.[0]?.place || ''}
          environmentConditions={(() => {
            const envs = (lhksCertificate.results as any)?.[0]?.environment || [];
            const temp = envs.find((e: any) => e.key.toLowerCase().includes('suhu') || e.key.toLowerCase().includes('temp'))?.value;
            const hum = envs.find((e: any) => e.key.toLowerCase().includes('kelembapan') || e.key.toLowerCase().includes('humidity') || e.key.toLowerCase().includes('rh'))?.value;
            return { temperature: temp || '-', humidity: hum || '-' };
          })()}
        />
      )}
    </div >
  )
}


export default CertificatesCRUD