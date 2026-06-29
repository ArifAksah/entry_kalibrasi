'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificates } from '../../../hooks/useCertificates'
import { useCertificateVerification } from '../../../hooks/useCertificateVerification'
import { Certificate, CertificateInsert, Station, Instrument, Sensor, CertStandard, CalibrationSession, RawData, supabase } from '../../../lib/supabase'
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
import UncertaintyModal from '../../../components/features/UncertaintyModal'
import LHKSReport from '../../../components/features/LHKSReport'
import { calculateCalibrationResult } from '../../../lib/uncertainty-utils'
import DateRangePicker from '../../../components/ui/DateRangePicker'
import RichTextEditor from '../../../components/ui/RichTextEditor'
import { DEFAULT_NOTES_OTHERS_HTML } from '../../../lib/rich-text'
import { firstLegacyResult, resultsToLegacyView } from '../../../lib/validators/certificate-results-render-adapter'
import qcCacheService from '../../../lib/qc-cache-service'

// Keep TrashIcon for backward compatibility in this file

/**
 * Parses correction data from any historical DB format into a uniform array of
 * { setpoint, correction, u95 } objects.
 */
function parseCorrectionData(cert: any): Array<{ setpoint: string; correction: string; u95: string }> {
  // Priority 1: correction_data already built as objects
  if (Array.isArray(cert.correction_data) && cert.correction_data.length > 0 && typeof cert.correction_data[0] === 'object') {
    return cert.correction_data.map((d: any) => ({ setpoint: String(d.setpoint ?? ''), correction: String(d.correction ?? ''), u95: String(d.u95 ?? '') }));
  }
  // Priority 2: New schema — separate setpoint[] + correction_std[] columns
  if (Array.isArray(cert.setpoint) && cert.setpoint.length > 0 && Array.isArray(cert.correction_std)) {
    return cert.setpoint.map((s: any, idx: number) => ({
      setpoint: String(s ?? ''),
      correction: String((cert.correction_std as any[])[idx] ?? ''),
      u95: String((Array.isArray(cert.u95_std) ? (cert.u95_std as any[])[idx] : '') ?? '')
    }));
  }
  // Priority 3: correction_std exists, try to parse
  if (cert.correction_std) {
    const cs = cert.correction_std;
    if (Array.isArray(cs) && cs.length > 0 && typeof cs[0] === 'object' && cs[0] !== null) {
      return cs.map((d: any) => ({ setpoint: String(d.setpoint ?? ''), correction: String(d.correction ?? d.koreksi ?? ''), u95: String(d.u95 ?? d.u95_std ?? '') }));
    }
    if (!Array.isArray(cs) && typeof cs === 'object' && cs !== null) {
      const koreksiArr: any[] = cs.koreksi ?? cs.correction ?? [];
      const setpointArr: any[] = cs.setpoint ?? [];
      const u95Arr: any[] = cs.u95 ?? cs.u95_std ?? [];
      if (koreksiArr.length > 0) return koreksiArr.map((k: any, idx: number) => ({ setpoint: String(setpointArr[idx] ?? ''), correction: String(k ?? ''), u95: String(u95Arr[idx] ?? '') }));
    }
    if (Array.isArray(cs) && cs.length > 0) {
      return cs.map((c: any) => ({ setpoint: '', correction: String(c ?? ''), u95: '' }));
    }
  }
  return [];
}

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

const ChevronDownIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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

// Dynamic KaTeX import to avoid SSR issues
let katex: any = null

// Detect if a string likely contains LaTeX syntax
const hasLatexSyntax = (str: string): boolean => {
    return /[\\^_{}]|\$/.test(str)
}

// LaTeX Preview Component
const LaTeXPreview = ({ latex, className = '' }: { latex: string; className?: string }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!ref.current || !latex.trim()) return

        const render = async () => {
            try {
                if (!katex) {
                    katex = (await import('katex')).default
                    if (!document.getElementById('katex-css')) {
                        const link = document.createElement('link')
                        link.id = 'katex-css'
                        link.rel = 'stylesheet'
                        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
                        document.head.appendChild(link)
                    }
                }
                const html = katex.renderToString(latex, {
                    throwOnError: false,
                    displayMode: false,
                    output: 'html',
                })
                if (ref.current) {
                    ref.current.innerHTML = html
                    setError(false)
                }
            } catch (e) {
                setError(true)
                if (ref.current) {
                    ref.current.textContent = latex
                }
            }
        }

        render()
    }, [latex])

    if (!latex.trim()) return null
    if (error || !hasLatexSyntax(latex)) {
        return <span className={className}>{latex}</span>
    }

    return <span ref={ref} className={className} />
}

const SmartUnit = ({ value, className = '' }: { value: string; className?: string }) => {
    if (!hasLatexSyntax(value)) {
        return <span className={className}>{value}</span>
    }
    return <LaTeXPreview latex={value} className={className} />
}

// Searchable Dropdown Component
const SearchableDropdown = ({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  className = "",
  id = "",
  renderOptionName
}: {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: Array<{ id: string | number; name: string;[key: string]: any }>
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
  renderOptionName?: (name: string) => React.ReactNode
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
          <span className="text-gray-900">
            {renderOptionName ? renderOptionName(selectedOption.name) : selectedOption.name}
            {selectedOption.station_id ? ` (${selectedOption.station_id})` : ''}
          </span>
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
                        <div className="font-medium text-gray-900">
                          {renderOptionName ? renderOptionName(option.name) : option.name}
                        </div>
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

  const fetchSignedPdf = async (item: Certificate, download = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')

    const pdfEndpoint = `/api/certificates/${item.id}/pdf?${download ? 'download=true&' : ''}t=${Date.now()}`
    const response = await fetch(pdfEndpoint, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })

    if (!response.ok) throw new Error('Failed to get PDF')

    const contentType = response.headers.get('Content-Type') || ''
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Response download bukan PDF yang valid.${errorText ? ` ${errorText.slice(0, 160)}` : ''}`)
    }

    return response
  }

  const openSignedPdf = async (item: Certificate) => {
    try {
      const response = await fetchSignedPdf(item)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
      setActionDropdownOpenId(null)
    } catch (err) {
      console.error('Error opening PDF:', err)
      showError('Failed to open PDF. Please try again.')
    }
  }

  const downloadSignedPdf = async (item: Certificate) => {
    try {
      const response = await fetchSignedPdf(item, true)
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `Certificate_${item.no_certificate || item.id}.pdf`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
          if (filename.includes('%')) filename = decodeURIComponent(filename)
        }
      }

      if (!filename.toLowerCase().endsWith('.pdf')) filename = `${filename}.pdf`

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
      setActionDropdownOpenId(null)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      showError('Failed to download PDF. Please try again.')
    }
  }
  const isCalibrator = role === 'calibrator'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionDropdownOpenId, setActionDropdownOpenId] = useState<number | null>(null)
  const [isRejectionNotesModalOpen, setIsRejectionNotesModalOpen] = useState(false)
  const [selectedRejectionCertificate, setSelectedRejectionCertificate] = useState<Certificate | null>(null)

  // Filter & search state untuk daftar sertifikat
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'sent' | 'verified' | 'rejected' | 'completed'>('all')
  const [filterStation, setFilterStation] = useState<'all' | string>('all')

  // Menutup dropdown action saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-action-menu="true"]')) {
        setActionDropdownOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset halaman ke 1 setiap kali filter / pencarian berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterStation])

  const [editing, setEditing] = useState<Certificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [standardInstruments, setStandardInstruments] = useState<Instrument[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [instrumentNames, setInstrumentNames] = useState<Array<{ id: number; name: string }>>([])
  const [standardCerts, setStandardCerts] = useState<CertStandard[]>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string; nip?: string; role?: string }>>([])
  const [units, setUnits] = useState<{ id: number; unit: string }[]>([])

  // QC Modal State
  const [showQCModal, setShowQCModal] = useState(false)
  const [qcModalCertificate, setQcModalCertificate] = useState<Certificate | null>(null)

  // Uncertainty Modal State
  const [showUncertaintyModal, setShowUncertaintyModal] = useState(false)
  const [uncertaintyModalCertificate, setUncertaintyModalCertificate] = useState<Certificate | null>(null)
  const [uncertaintyRawData, setUncertaintyRawData] = useState<any[]>([])

  // LHKS Modal State
  const [showLHKSModal, setShowLHKSModal] = useState(false)
  const [lhksCertificate, setLhksCertificate] = useState<Certificate | null>(null)
  const [lhksRawData, setLhksRawData] = useState<any[]>([])

  const getAnyResultSessionId = (rawResults: unknown): string | null => {
    const entries = resultsToLegacyView(rawResults)
    return entries.map((r: any) => r.session_id).find((sid: any) => !!sid) ?? null
  }

  const getVerificationLevelLabel = (level: number | null | undefined) => {
    switch (level) {
      case 1:
        return 'Verifikator 1'
      case 2:
        return 'Verifikator 2'
      case 3:
        return 'Verifikator 3'
      case 4:
        return 'Penandatangan'
      default:
        return 'Verifier'
    }
  }

  const getLatestRejectionEntry = (certificate: Certificate) => {
    const history = getSortedRejectionHistory(certificate)
    if (history.length === 0) return null
    return history[0]
  }

  const getSortedRejectionHistory = (certificate: Certificate) => {
    const history = Array.isArray((certificate as any).rejection_history)
      ? [...(certificate as any).rejection_history]
      : []

    return history.sort((a: any, b: any) => {
      const timeA = new Date(a?.rejection_timestamp || 0).getTime()
      const timeB = new Date(b?.rejection_timestamp || 0).getTime()
      return timeB - timeA
    })
  }

  const handleOpenRejectionNotes = (certificate: Certificate) => {
    setSelectedRejectionCertificate(certificate)
    setIsRejectionNotesModalOpen(true)
  }

  const handlePreviewLHKS = async (cert: Certificate) => {
    setLhksCertificate(cert)
    setLhksRawData([])

    const sessionId = getAnyResultSessionId(cert.results)
    if (sessionId) {
      try {
        const res = await fetch(`/api/raw-data?session_id=${sessionId}`)
        const json = await res.json()
        setLhksRawData(json.data || [])
      } catch (e) {
        console.error("Failed to fetch raw data for LHKS", e)
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
  const [useStationAddressForPlace, setUseStationAddressForPlace] = useState(false)

  // Toggle: false = tanggal tunggal, true = rentang (start + end)
  // (replaced by DateRangePicker component)

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
    verifikator_3: null as any,
    issue_date: '',
    station: null,
    instrument: null,
    station_address: null as any,
    // Komponen format nomor sesuai IKK BMKG (fokus FC untuk saat ini).
    certificate_type: 'sert',
    calibration_place: 'FC',
    instrument_code: null,
    balai_id: null as number | null,
    is_standard: false,
  })

  // Derived instrument details (read-only preview)
  const [instrumentPreview, setInstrumentPreview] = useState<{ manufacturer?: string; type?: string; serial?: string; other?: string }>({})

  const resolveStationAddress = React.useCallback((stationId?: number | null, explicitAddress?: string | null) => {
    const address = explicitAddress ?? (stationId ? (stations.find(s => s.id === stationId)?.address ?? '') : '')
    return String(address || '')
  }, [stations])
  const selectedStationAddress = (form as any).station_address as string | null

  // Local UI state for calibration results blocks
  type KV = { key: string; value: string; enabled?: boolean }
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
      others_enabled?: boolean;
      standardInstruments: number[]
    }
    sensorDetails?: Partial<Sensor>
    standardInstrumentId?: number | null
    standardCertificateNumber?: string | null
    standardCertificateId?: number | null
    unitUut?: string | null   // unit override for UUT data on this sheet
  unitStd?: string | null   // unit override for STD data on this sheet
  }

  const createDefaultNotesForm = () => ({
    traceable_to_si_through: '',
    reference_document: '',
    calibration_methode: '',
    others: DEFAULT_NOTES_OTHERS_HTML,
    others_enabled: false,
    standardInstruments: [] as number[],
  })

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
      notesForm: createDefaultNotesForm(),
      unitUut: null,
      unitStd: null
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
    notesForm: createDefaultNotesForm(),
    unitUut: null,
    unitStd: null
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

  useEffect(() => {
    if (!useStationAddressForPlace) return

    const stationAddress = resolveStationAddress(form.station, selectedStationAddress)
    setSessionDetails(prev => {
      if (prev.place === stationAddress) return prev
      return { ...prev, place: stationAddress }
    })
    setResults(prev => prev.map(result => (
      result.place === stationAddress ? result : { ...result, place: stationAddress }
    )))
  }, [useStationAddressForPlace, form.station, selectedStationAddress, resolveStationAddress])

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

  const updateResult = (idx: number, patch: Partial<ResultItem>) => {
    setResults(prev => {
      const arr = [...prev]
      while (arr.length <= idx) {
        arr.push({
          sensorId: null,
          startDate: '',
          endDate: '',
          place: '',
          environment: [],
          table: [],
          images: [],
          notesForm: createDefaultNotesForm(),
          unitUut: null,
          unitStd: null
        })
      }
      arr[idx] = { ...arr[idx], ...patch }
      return arr
    })
  }

  // Helper function to get selected station type (normalized)
  // Returns lowercased, trimmed string; empty string when not set
  const getSelectedStationType = () => {
    const selectedStation = form.station ? stations.find(s => s.id === form.station) : undefined
    const raw = ((selectedStation as any)?.station_type?.name ?? '').toString()
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
      // Auto-fill unit from sensor's graduating_unit or range_capacity_unit (fallback to existing unit)
      unitUut: sensor?.graduating_unit || sensor?.range_capacity_unit || results[idx]?.unitUut || null,
      // Preserve existing calibration place instead of clearing it
      place: sessionDetails.place || results[idx]?.place || '',
    })
  }

  // Picker modal states
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [noteEditIndex, setNoteEditIndex] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState<{ traceable_to_si_through: string; reference_document: string; calibration_methode: string; others: string; others_enabled?: boolean; standardInstruments: number[] }>({
    traceable_to_si_through: '',
    reference_document: '',
    calibration_methode: '',
    others: DEFAULT_NOTES_OTHERS_HTML,
    others_enabled: false,
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
  const [isGenerating, setIsGenerating] = useState(false)

  const decodeWorkbookFileText = (entry: any): string | null => {
    if (!entry) return null
    if (entry.content && entry.type) {
      const content = entry.content
      if (typeof content === 'string') return content
      if (content instanceof Uint8Array || Array.isArray(content)) {
        return new TextDecoder('utf-8').decode(content instanceof Uint8Array ? content : new Uint8Array(content))
      }
    }
    if (typeof entry.data === 'string') return entry.data
    if (typeof entry.asBinary === 'function') return entry.asBinary()
    if (typeof entry.asNodeBuffer === 'function') {
      const buffer = entry.asNodeBuffer()
      return new TextDecoder('utf-8').decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
    }
    if (entry._data?.getContent) {
      const content = entry._data.getContent()
      if (typeof content === 'string') return content
      return new TextDecoder('utf-8').decode(content instanceof Uint8Array ? content : new Uint8Array(content))
    }
    return null
  }

  const findWorkbookFile = (workbook: any, targetPath: string): any | null => {
    const files = workbook?.files
    if (!files) return null
    const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase()

    for (const key of Object.keys(files)) {
      const normalizedKey = key.replace(/^Root Entry[\\/]/i, '').replace(/\\/g, '/').toLowerCase()
      if (normalizedKey === normalizedTarget) return files[key]
    }

    return null
  }

  const decodeXmlEntities = (value: string): string =>
    value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')

  const getWorkbookSheetXmlPaths = (workbook: any): Record<string, string> => {
    const workbookRelsXml = decodeWorkbookFileText(findWorkbookFile(workbook, 'xl/_rels/workbook.xml.rels'))
    const workbookSheets = workbook?.Workbook?.Sheets
    const pathsByName: Record<string, string> = {}
    if (!Array.isArray(workbookSheets)) return pathsByName

    if (!workbookRelsXml) {
      workbookSheets.forEach((sheet: any, index: number) => {
        const sheetName = workbook.SheetNames?.[index] || sheet?.name
        if (!sheetName) return
        pathsByName[sheetName] = `xl/worksheets/sheet${index + 1}.xml`
      })
      return pathsByName
    }

    const relTargetById: Record<string, string> = {}
    const relationshipRegex = /<Relationship\b([^>]*)\/?>/g
    const attrRegex = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g
    let relationshipMatch: RegExpExecArray | null

    while ((relationshipMatch = relationshipRegex.exec(workbookRelsXml)) !== null) {
      const attrsSource = relationshipMatch[1] || ''
      const attrs: Record<string, string> = {}
      let attrMatch: RegExpExecArray | null

      while ((attrMatch = attrRegex.exec(attrsSource)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2]
      }

      const relType = attrs.Type || attrs.type || ''
      const relId = attrs.Id || attrs.id || ''
      const relTarget = attrs.Target || attrs.target || ''

      if (relType.toLowerCase().includes('worksheet') && relId && relTarget) {
        relTargetById[relId] = relTarget
      }
    }

    workbookSheets.forEach((sheet: any, index: number) => {
      const relId = sheet?.id || sheet?.strRelID
      const target = relId ? relTargetById[relId] : null
      const sheetName = workbook.SheetNames?.[index] || sheet?.name
      if (!sheetName) return

      if (target) {
        pathsByName[sheetName] = `xl/${String(target).replace(/^\/?xl\//i, '').replace(/^\.\.\//, '')}`.replace(/\\/g, '/')
        return
      }

      pathsByName[sheetName] = `xl/worksheets/sheet${index + 1}.xml`
    })

    return pathsByName
  }

  const extractRowsFromSheetXml = (sheetXml: string, sharedStrings: any[] = []): any[][] => {
    const sheetDataMatch = sheetXml.match(/<(?:\w+:)?sheetData[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/i)
    if (!sheetDataMatch?.[1]) return []

    const rows: any[][] = []
    const rowRegex = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/gi
    const cellRegex = /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>|<(?:\w+:)?c\b([^>]*)\/>/gi
    const attrRegex = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g

    const readCellValue = (attrsSource: string, content: string): any => {
      const attrs: Record<string, string> = {}
      let attrMatch: RegExpExecArray | null
      while ((attrMatch = attrRegex.exec(attrsSource)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2]
      }

      const cellType = attrs.t || ''
      const valueMatch = content.match(/<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i)
      const inlineStringMatch = content.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/i)
      const rawValue = valueMatch?.[1] ?? inlineStringMatch?.[1] ?? ''
      const decodedValue = decodeXmlEntities(rawValue)

      if (cellType === 's') {
        const stringIndex = Number(decodedValue)
        return Number.isFinite(stringIndex)
          ? (sharedStrings?.[stringIndex]?.t ?? sharedStrings?.[stringIndex]?.r ?? decodedValue)
          : decodedValue
      }
      if (cellType === 'inlineStr' || cellType === 'str') return decodedValue
      if (cellType === 'b') return decodedValue === '1'
      if (cellType === 'd') return decodedValue

      const numericValue = Number(decodedValue)
      return decodedValue !== '' && Number.isFinite(numericValue) ? numericValue : decodedValue
    }

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowRegex.exec(sheetDataMatch[1])) !== null) {
      const rowCellsXml = rowMatch[1]
      const row: any[] = []
      let cellMatch: RegExpExecArray | null

      while ((cellMatch = cellRegex.exec(rowCellsXml)) !== null) {
        const attrsSource = cellMatch[1] || cellMatch[3] || ''
        const content = cellMatch[2] || ''
        const refMatch = attrsSource.match(/\br="([^"]+)"/)
        if (!refMatch?.[1]) continue

        const cellPos = utils.decode_cell(refMatch[1])
        row[cellPos.c] = readCellValue(attrsSource, content)
      }

      if (row.some(val => val !== undefined && val !== null && val !== '')) {
        rows.push(row)
      }
    }

    return rows
  }

  // Auto-Generate Table Result from QC Data
  const handleAutoGenerate = async (sectionIndex: number) => {
    if (tableEditIndex === null) return;
    setIsGenerating(true);
    
    try {
      const currentResult = results[tableEditIndex];
      const sessionId = (currentResult as any)?.session_id;

      if (!sessionId) {
        showError("Data QC tidak tersedia. Pastikan sensor ini sudah memiliki Data Raw tersimpan (session_id).");
        setIsGenerating(false);
        return;
      }

      // Fetch QC Raw Data
      const res = await fetch(`/api/raw-data?session_id=${sessionId}`);
      const json = await res.json();
      const currentData = json.data || [];

      if (!currentData.length) {
        showError("Data QC kosong. Silakan isi Data QC terlebih dahulu.");
        setIsGenerating(false);
        return;
      }

      // Setup inputs for calculation
      const activeUutSensor = sensors.find(s => s.id === currentResult.sensorId);
      const standardCertRecord = currentResult.standardCertificateId 
        ? standardCerts.find(c => c.id === currentResult.standardCertificateId) 
        : null;

      const uutInstrument = instruments.find(i => i.id === form.instrument);
      const isAnalog = (uutInstrument?.instrument_type_id ?? 1) === 2;

      // Calculate Results
      const { uutAvg, correction, uncertainty } = calculateCalibrationResult({
        currentData,
        uutSensor: activeUutSensor,
        standardCertRecord: standardCertRecord,
        isAnalog
      });

      // Update Table Draft
      const v = [...tableDraft];
      if (!v[sectionIndex]) return;

      // Default Standard Format
      v[sectionIndex].headers = ['Penunjukan Alat', 'Koreksi', 'Ketidakpastian'];
      
      const newRow = {
        key: uutAvg.toFixed(2),
        unit: correction.toFixed(4),
        value: uncertainty.toFixed(4),
        extraValues: []
      };

      v[sectionIndex].rows = [newRow];
      setTableDraft(v);

      showSuccess("Tabel berhasil di-generate dari Data QC!");
    } catch (err: any) {
      console.error(err);
      showError("Gagal men-generate tabel dari Data QC");
    } finally {
      setIsGenerating(false);
    }
  }

  // Excel Import Handler
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionIndex: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = read(data, { raw: true, cellDates: true })
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
      const workbook: any = read(data, { raw: true, cellDates: true, bookFiles: true })
      const sheetXmlPaths = getWorkbookSheetXmlPaths(workbook)
      const sharedStrings = Array.isArray(workbook.Strings) ? workbook.Strings : []

      const sheetsData: { name: string, data: any[][] }[] = []
      const invalidSheets: string[] = []

      workbook.SheetNames.forEach((name: string) => {
        const worksheet = workbook.Sheets[name]
        const sheetXmlPath = sheetXmlPaths[name]
        const sheetXml = decodeWorkbookFileText(sheetXmlPath ? findWorkbookFile(workbook, sheetXmlPath) : null)
        const xmlRows = sheetXml ? extractRowsFromSheetXml(sheetXml, sharedStrings) : []

        // Manual Extraction to bypass `sheet_to_json` format coercion and get pure `.v` (raw value)
        const jsonData: any[][] = [];
        const refFromMetadata = worksheet['!ref'];
        const cellAddresses = Object.keys(worksheet).filter(key => /^[A-Z]+[0-9]+$/i.test(key))
        let ref = refFromMetadata
        if (cellAddresses.length > 0) {
          let minRow = Number.POSITIVE_INFINITY
          let minCol = Number.POSITIVE_INFINITY
          let maxRow = Number.NEGATIVE_INFINITY
          let maxCol = Number.NEGATIVE_INFINITY

          cellAddresses.forEach(addr => {
            const cellPos = utils.decode_cell(addr)
            if (cellPos.r < minRow) minRow = cellPos.r
            if (cellPos.c < minCol) minCol = cellPos.c
            if (cellPos.r > maxRow) maxRow = cellPos.r
            if (cellPos.c > maxCol) maxCol = cellPos.c
          })

          const computedRef = utils.encode_range({
            s: { r: minRow, c: minCol },
            e: { r: maxRow, c: maxCol }
          })

          if (!ref || (utils.decode_range(computedRef).e.r > utils.decode_range(ref).e.r)) {
            ref = computedRef
          }

          console.log(`[raw-upload] Sheet "${name}" ref metadata=${refFromMetadata || 'none'} computed=${computedRef} cells=${cellAddresses.length}`)
        }

        if (xmlRows.length > 0) {
          jsonData.push(...xmlRows)
          console.log(`[raw-upload] Sheet "${name}" xmlRows=${xmlRows.length} xmlPath=${sheetXmlPath || 'unknown'}`)
        } else if (ref) {
          const range = utils.decode_range(ref);
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const row: any[] = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = { c: C, r: R };
              const cellRef = utils.encode_cell(cellAddress);
              const cell = worksheet[cellRef];

              if (!cell) {
                row.push(undefined);
              } else if (cell.t === 'n') {
                row.push(cell.v); // Ensure we grab the raw floating point numeric value!
              } else if (cell.t === 'd') {
                row.push(cell.v);
              } else if (cell.w !== undefined) {
                row.push(cell.w); // String display text for headers
              } else {
                row.push(cell.v);
              }
            }
            // Only push if row has at least one value
            if (row.some(val => val !== undefined && val !== null && val !== '')) {
              jsonData.push(row);
            }
          }
        }

        if (jsonData.length > 0) {
          // Validation: detect the actual header row in the first few rows.
          // Some workbooks have stale ranges / blank rows above the real header.
          let detectedHeaderIndex = -1
          let detectedHeaders: string[] = []

          for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            const headers = (jsonData[i] as any[]).map(h => String(h).toLowerCase().trim())
            const hasTimestamp = headers.some(h => h.includes('timestamp') || h.includes('waktu') || h.includes('time') || h.includes('tanggal'))
            const hasStandard = headers.some(h => h.includes('standar') || h.includes('standard') || h.includes('ref') || h.includes('master') || h.includes('std'))
            const hasUUT = headers.some(h => h.includes('uut') || h.includes('bacaan') || h.includes('reading') || h.includes('alat'))

            if (hasTimestamp && hasStandard && hasUUT) {
              detectedHeaderIndex = i
              detectedHeaders = headers
              break
            }
          }

          if (detectedHeaderIndex !== -1) {
            const normalizedData = detectedHeaderIndex === 0
              ? jsonData
              : jsonData.slice(detectedHeaderIndex)
            console.log(`[raw-upload] Sheet "${name}" headerRow=${detectedHeaderIndex + 1}`, detectedHeaders)
            sheetsData.push({ name, data: normalizedData })
          } else {
            const previewHeaders = (jsonData[0] as any[]).map(h => String(h).toLowerCase().trim())
            const missing = []
            if (!previewHeaders.some(h => h.includes('timestamp') || h.includes('waktu') || h.includes('time') || h.includes('tanggal'))) missing.push('Timestamp/Waktu')
            if (!previewHeaders.some(h => h.includes('standar') || h.includes('standard') || h.includes('ref') || h.includes('master') || h.includes('std'))) missing.push('Standard/Ref')
            if (!previewHeaders.some(h => h.includes('uut') || h.includes('bacaan') || h.includes('reading') || h.includes('alat'))) missing.push('UUT/Reading')
            invalidSheets.push(`${name} (Missing: ${missing.join(', ') || 'Header tidak ditemukan pada 10 baris awal'})`)
          }
        }
      })

      console.log('Raw Data Sheets:', sheetsData)
      console.log(
        '[raw-upload] final sheet counts:',
        sheetsData.map((sheet) => ({
          name: sheet.name,
          rowsIncludingHeader: sheet.data.length,
          dataRows: Math.max(sheet.data.length - 1, 0),
        }))
      )
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
              notesForm: createDefaultNotesForm(),
              unitUut: null,
              unitStd: null
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
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        const fetchWithRetry = async (url: string, attempts = 2): Promise<Response | null> => {
          for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
              const response = await fetch(url, { cache: 'no-store' })
              return response
            } catch (error) {
              if (attempt === attempts - 1) {
                console.warn(`[certificates] Fetch failed for ${url}`, error)
                return null
              }
              await sleep(400 * (attempt + 1))
            }
          }
          return null
        }

        const fetchJsonSafe = async (url: string, fallback: any = null) => {
          const response = await fetchWithRetry(url)
          if (!response?.ok) return fallback
          try {
            return await response.json()
          } catch {
            return fallback
          }
        }

        // Fetch all stations across pages to ensure every certificate can resolve station name
        const fetchAllStations = async () => {
          if (!role) return { data: [], total: 0, pageSize: 100, totalPages: 0 } // Wait for role

          let baseUrl = '/api/stations?pageSize=100'
          if (role !== 'admin' && user?.id) {
            baseUrl += `&user_id=${user.id}`
          }

          const first = await fetchWithRetry(`${baseUrl}&page=1`)
          if (!first?.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetchJsonSafe(`${baseUrl}&page=${p}`, { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        // Fetch all instruments across pages
        // Fetch all instruments across pages
        const fetchAllInstruments = async () => {
          let baseUrl = '/api/instruments?pageSize=100'
          // Only filter by user_id for station users, not for calibrators/admins
          if (role === 'user_station' && user?.id) {
            baseUrl += `&user_id=${user.id}`
          }

          const first = await fetchWithRetry(`${baseUrl}&page=1`)
          if (!first?.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetchJsonSafe(`${baseUrl}&page=${p}`, { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        // Fetch all sensors across pages
        const fetchAllSensors = async () => {
          const first = await fetchWithRetry('/api/sensors?page=1&pageSize=100')
          if (!first?.ok) return { data: [], total: 0, pageSize: 100, totalPages: 1 }
          const firstJson = await first.json()
          const firstData = Array.isArray(firstJson) ? firstJson : (firstJson?.data ?? [])
          const totalPages = (Array.isArray(firstJson) ? 1 : (firstJson?.totalPages ?? 1)) as number
          if (totalPages <= 1) return { data: firstData, total: (firstJson?.total ?? firstData.length) as number, pageSize: 100, totalPages }
          const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          const rest = await Promise.all(restPages.map(p => fetchJsonSafe(`/api/sensors?page=${p}&pageSize=100`, { data: [] })))
          const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
          return { data: [...firstData, ...restData], total: (firstJson?.total ?? (firstData.length + restData.length)) as number, pageSize: 100, totalPages }
        }

        const [stationsAll, instrumentsAll, sensorsAll, personelData, certStandardsData, instrNamesData, unitsData] = await Promise.all([
          fetchAllStations(),
          fetchAllInstruments(),
          fetchAllSensors(),
          fetchJsonSafe('/api/personel', []),
          fetchJsonSafe('/api/cert-standards', []),
          fetchJsonSafe('/api/instrument-names', []),
          fetchJsonSafe('/api/units', []),
        ])

        const stationsRaw = Array.isArray(stationsAll) ? stationsAll : (stationsAll as any)?.data ?? []
                // Remove duplicate stations by id
                const stationsMap = new Map()
                stationsRaw.forEach((s: any) => { if (s?.id != null) stationsMap.set(s.id, s) })
                setStations(Array.from(stationsMap.values()))
        const instrumentsRaw = Array.isArray(instrumentsAll) ? instrumentsAll : (instrumentsAll as any)?.data ?? []
        const instrumentsMap = new Map()
        instrumentsRaw.forEach((i: any) => { if (i?.id != null) instrumentsMap.set(i.id, i) })
        setInstruments(Array.from(instrumentsMap.values()))
        const sensorsRaw = Array.isArray(sensorsAll) ? sensorsAll : (sensorsAll as any)?.data ?? []
        const sensorsMap = new Map()
        sensorsRaw.forEach((s: any) => { if (s?.id != null) sensorsMap.set(s.id, s) })
        setSensors(Array.from(sensorsMap.values()))
        setInstrumentNames(Array.isArray(instrNamesData) ? instrNamesData : (instrNamesData?.data ?? []))
        setPersonel(Array.isArray(personelData) ? personelData : [])
        setUnits(Array.isArray(unitsData) ? unitsData : [])
        setStandardCerts(Array.isArray(certStandardsData) ? certStandardsData : [])

        // Fetch standard instruments using the type=standard filter (single request instead of fetching ALL instruments again)
        try {
          const stdRes = await fetchWithRetry('/api/instruments?type=standard&pageSize=100&page=1')
          if (stdRes?.ok) {
            const stdJson = await stdRes.json()
            const stdData = Array.isArray(stdJson) ? stdJson : (stdJson?.data ?? [])
            setStandardInstruments(stdData)
          }
        } catch (e) {
          console.error('Failed to fetch standard instruments:', e)
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

  // Auto-resolve instrument_code saat user memilih INSTRUMEN UUT di dropdown
  // "Pilih Instrument (UUT)". Chain:
  //   form.instrument (= certificate.instrument = instrument.id)
  //   → instruments[].instrument_names_id (FK ke instrument_names)
  //   → instrument_names[].instrument_code_id (FK ke instrument_code)
  //   → instrument_code[].code_alat (dari Master Instrumen)
  // Hanya aktif di mode CREATE supaya nilai existing tidak ter-override saat EDIT.
  useEffect(() => {
    if (editing) {
      console.log('[instrument_code] Skipped: editing mode');
      return;
    }
    if (!form.instrument) {
      console.log('[instrument_code] No instrument selected');
      if ((form as any).instrument_code) {
        setForm(prev => ({ ...prev, instrument_code: null }))
      }
      return
    }
    
    const inst = instruments.find(i => i.id === form.instrument) as any
    console.log('[instrument_code] Selected instrument:', {
      id: form.instrument,
      found: !!inst,
      instrument_names_id: inst?.instrument_names_id,
      instrument_name: inst?.name
    });
    
    const nameId = inst?.instrument_names_id ?? null
    const nm = nameId ? (instrumentNames.find(n => n.id === nameId) as any) : null
    
    console.log('[instrument_code] Instrument name lookup:', {
      nameId,
      found: !!nm,
      name: nm?.name || nm?.names,
      instrument_code_id: nm?.instrument_code_id,
      code_alat: nm?.code_alat,
      full_data: nm
    });
    
    // code_alat now comes from the JOIN with instrument_code table
    const resolvedCode: string | null = nm?.code_alat?.toString().trim() || null
    
    console.log('[instrument_code] Resolved code:', {
      resolvedCode,
      currentCode: (form as any).instrument_code,
      willUpdate: (form as any).instrument_code !== resolvedCode
    });

    if ((form as any).instrument_code !== resolvedCode) {
      setForm(prev => ({ ...prev, instrument_code: resolvedCode }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.instrument, instruments.length, instrumentNames.length, editing])

  // Pagination + personalization
  const isUserAssigned = (item: Certificate) => {
    const uid = user?.id ? String(user.id) : null
    if (!uid) return false

    if (role === 'user_station') {
      const stationIds = new Set(stations.map((station) => String(station.id)))
      const instrumentIds = new Set(instruments.map((instrument) => String(instrument.id)))
      const itemStationId = item.station !== undefined && item.station !== null ? String(item.station) : null
      const itemInstrumentId = item.instrument !== undefined && item.instrument !== null ? String(item.instrument) : null
      const directAssignedFields = [
        (item as any).authorized_by,
        (item as any).verifikator_1,
        (item as any).verifikator_2,
        (item as any).verifikator_3,
        (item as any).assignor,
        (item as any).sent_by,
        (item as any).created_by,
        (item as any).creator_id,
        (item as any).owner,
        (item as any).owner_id,
      ]

      if (itemStationId && stationIds.has(itemStationId)) return true
      if (itemInstrumentId && instrumentIds.has(itemInstrumentId)) return true
      if (directAssignedFields.some((field) => field !== undefined && field !== null && String(field) === uid)) return true
      return false
    }

    const directFields = [
      (item as any).authorized_by,
      (item as any).verifikator_1,
      (item as any).verifikator_2,
      (item as any).verifikator_3,
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const allowedCertificates = certificates
    .filter(isUserAssigned)
    // Role user_station hanya boleh melihat sertifikat yang sudah selesai (ditandatangani).
    .filter((item) => role !== 'user_station' || (item.status || '').toLowerCase() === 'completed')
    // Filter status (terapkan hanya jika bukan 'all')
    .filter((item) => {
      if (filterStatus === 'all') return true
      const itemStatus = (item.status || 'draft').toLowerCase()
      return itemStatus === filterStatus
    })
    // Filter stasiun (terapkan hanya jika bukan 'all')
    .filter((item) => {
      if (filterStation === 'all') return true
      return String(item.station ?? '') === filterStation
    })
    // Pencarian teks bebas
    .filter((item) => {
      if (!normalizedSearchQuery) return true
      const instrumentName = instruments.find((inst) => inst.id === item.instrument)?.name || ''
      const stationName = stations.find((st) => st.id === item.station)?.name || ''
      const haystack = [
        item.no_certificate,
        item.no_order,
        item.no_identification,
        instrumentName,
        stationName,
        item.status,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value).toLowerCase())
        .join(' | ')
      return haystack.includes(normalizedSearchQuery)
    })

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
        verifikator_3: (item as any).verifikator_3 ?? null,
        issue_date: item.issue_date,
        station: item.station,
        instrument: item.instrument,
        station_address: (item as any).station_address ?? (item.station ? stations.find(s => s.id === item.station)?.address ?? null : null),
        // Format nomor (IKK): isi dari item kalau sudah di-backfill, fallback default.
        certificate_type:  (item as any).certificate_type  ?? 'sert',
        calibration_place: (item as any).calibration_place ?? 'FC',
        instrument_code:   (item as any).instrument_code   ?? null,
        balai_id: (item as any).balai_id ?? null,
        is_standard: (item as any).is_standard ?? false,
      })
      // Parse results - can be JSON string or array from DB
      const parsedResults = resultsToLegacyView((item as any).results)

      const savedResults = Array.isArray(parsedResults) && parsedResults.length > 0 ? parsedResults : [{
        sensorId: null,
        startDate: '',
        endDate: '',
        place: '',
        environment: [],
        table: [],
        images: [],
        notesForm: createDefaultNotesForm(),
        unitUut: null,
        unitStd: null
      }]

      // Enrich savedResults with standardInstrumentId/standardCertificateId from original raw data
      // (these fields are stripped during V0→V1 conversion, so we re-derive them here)
      const originalSensors = (() => {
        try {
          const r = (item as any).results
          const p = typeof r === 'string' ? JSON.parse(r) : r
          return Array.isArray(p?.sensors) ? p.sensors : (Array.isArray(p) ? p : [])
        } catch { return [] }
      })()

      const resolveStandardInstrumentId = (rawId: unknown): number | null => {
        const numericId = typeof rawId === 'number'
          ? rawId
          : (typeof rawId === 'string' && rawId.trim() !== '' && !Number.isNaN(Number(rawId)) ? Number(rawId) : null)
        if (!numericId) return null

        // Preferred: value already references instrument.id
        const instrumentMatch = instruments.find((inst: any) => inst.id === numericId)
        if (instrumentMatch) return numericId

        // Legacy fallback: value actually points to sensor.id
        const sensorMatch = sensors.find((sensor: any) => sensor.id === numericId)
        return sensorMatch?.instrument_id ?? null
      }

      const enrichedResults = savedResults.map((r: any, idx: number) => {
        const orig = originalSensors[idx]
        if (!orig) return r
        // V1 entry: extract from setup.standard_instruments
        if (orig.links) {
          const std = orig.setup?.standard_instruments?.[0] ?? null
          const resolvedStandardInstrumentId = resolveStandardInstrumentId(std?.instrument_id ?? std?.sensor_id)
          const matchedCert = std?.certificate_no
            ? standardCerts.find((c: any) =>
                c.no_certificate === std.certificate_no &&
                (std?.sensor_id ? c.sensor_id === std.sensor_id : true)
              ) ?? standardCerts.find((c: any) => c.no_certificate === std.certificate_no) ?? null
            : null
          return {
            ...r,
            standardInstrumentId: resolvedStandardInstrumentId,
            standardCertificateId: matchedCert?.id ?? null,
            standardCertificateNumber: std?.certificate_no ?? null,
          }
        }
        // V0 entry: these fields are already in r (passthrough from resultsToLegacyView)
        // Also restore unitUut/unitStd from V0 if present (fallback when raw data not loaded yet)
        return {
          ...r,
          standardInstrumentId: orig.standardInstrumentId ?? r.standardInstrumentId ?? null,
          standardCertificateId: orig.standardCertificateId ?? r.standardCertificateId ?? null,
          standardCertificateNumber: orig.standardCertificateNumber ?? r.standardCertificateNumber ?? null,
          unitUut: orig.unitUut ?? r.unitUut ?? null,
          unitStd: orig.unitStd ?? r.unitStd ?? null,
        }
      })

      setResults(enrichedResults as unknown as ResultItem[])

      // Restore global standard instrument from first result (if available)
      const firstResult = enrichedResults[0] as any
      setGlobalStandardInstrumentId(firstResult?.standardInstrumentId ?? null)
      setGlobalStandardCertificateNumber(firstResult?.standardCertificateNumber ?? null)

      // Restore sessionDetails from first result
      if (firstResult?.startDate || firstResult?.endDate || firstResult?.place) {
        setSessionDetails({
          start_date: firstResult.startDate || '',
          end_date: firstResult.endDate || '',
          place: firstResult.place || '',
          notes: ''
        })
      }
      setUseStationAddressForPlace(false)


      // Fetch Raw Data: session_id is stored inside each result item (results[i].session_id, a JSON field)
      // NOT as a top-level certificate column. Search all results for the first available session_id.
      const sessionId = savedResults
        .map((r: any) => r.session_id)
        .find((sid: any) => !!sid) ?? (item as any).session_id ?? null;

      console.log('[edit-open] certificate session ids:', savedResults.map((r: any) => ({
        sensorId: r.sensorId ?? r.sensor_id ?? null,
        session_id: r.session_id ?? null,
      })))
      console.log('[edit-open] selected session id:', sessionId)

      if (sessionId) {
        setRawDataFilename(`Memuat data session ${sessionId}...`)
        fetch(`/api/raw-data?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
              // Urutkan baris per timestamp (ascending) supaya Preview Raw Data
              // tampil dengan urutan yang SAMA dengan QC Check (yang juga sort by
              // timestamp). Tanpa ini, Preview tampil sesuai urutan id/insertion
              // sehingga baris pertama yang terlihat berbeda → seolah datanya beda.
              data.data.sort((a: any, b: any) =>
                new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
              );
              // Group by persisted sheet name first. Fallback to sensor_id_uut only when
              // old records do not have sheet_name. This prevents multiple sheets with
              // the same UUT sensor from being merged during edit.
              const grouped: Record<string, any[]> = {};
              const groupedMeta: Record<string, { sensorId: number | null }> = {};
              data.data.forEach((row: any) => {
                const sheetKey = row.sheet_name && String(row.sheet_name).trim() !== ''
                  ? `sheet:${String(row.sheet_name).trim()}`
                  : `sensor:${String(row.sensor_id_uut ?? 'unknown')}`;
                if (!grouped[sheetKey]) {
                  grouped[sheetKey] = [['Timestamp', 'Standard', 'UUT']];
                  groupedMeta[sheetKey] = {
                    sensorId: row.sensor_id_uut == null ? null : Number(row.sensor_id_uut),
                  };
                }
                grouped[sheetKey].push([
                  row.timestamp,
                  row.standard_data,
                  row.uut_data
                ]);
              });

              const reconstructedSheets = Object.keys(grouped).map((key) => {
                const sensorId = groupedMeta[key]?.sensorId ?? null;
                const matchedSensor = sensorId ? sensors.find((s: any) => s.id === sensorId) : null;
                const rowsForKey = data.data.filter((d: any) => {
                  const candidateKey = d.sheet_name && String(d.sheet_name).trim() !== ''
                    ? `sheet:${String(d.sheet_name).trim()}`
                    : `sensor:${String(d.sensor_id_uut ?? 'unknown')}`;
                  return candidateKey === key;
                });
                const firstRow = rowsForKey[0];
                const storedSheetName = firstRow?.sheet_name;

                // Resolve label: prioritize stored sheet_name, then lookup, skip numeric-only names
                let sensorLabel: string;

                if (storedSheetName && !/^\d+$/.test(String(storedSheetName).trim())) {
                  sensorLabel = storedSheetName;
                } else if (!matchedSensor) {
                  sensorLabel = sensorId == null ? 'Unknown' : `Sensor ${sensorId}`;
                } else {
                  const fromLookup = matchedSensor.sensor_name_id
                    ? instrumentNames.find((n: any) => n.id === matchedSensor.sensor_name_id)?.name
                    : undefined;
                  if (fromLookup) {
                    sensorLabel = fromLookup;
                  } else if (matchedSensor.name && !/^\d+$/.test(String(matchedSensor.name).trim())) {
                    sensorLabel = matchedSensor.name;
                  } else if (matchedSensor.type) {
                    sensorLabel = matchedSensor.type;
                  } else {
                    sensorLabel = `Sensor ${sensorId}`;
                  }
                }
                return {
                  name: sensorLabel,
                  data: grouped[key] as any[],
                  sensor_id_uut: sensorId,
                  sensor_id_std: firstRow?.sensor_id_std,
                  unit_uut: firstRow?.unit_uut,
                  unit_std: firstRow?.unit_std,
                };
              });

              console.log(
                '[edit-open] reconstructed sheet counts:',
                reconstructedSheets.map((sheet) => ({
                  name: sheet.name,
                  rowsIncludingHeader: Array.isArray(sheet.data) ? sheet.data.length : 0,
                  dataRows: Array.isArray(sheet.data) ? Math.max(sheet.data.length - 1, 0) : 0,
                  sensor_id_uut: sheet.sensor_id_uut ?? null,
                }))
              )

              setRawData(reconstructedSheets);

              // Inject unit_uut/unit_std from reconstructed sheets into results
              setResults(prev => prev.map((r, idx) => {
                const sheet = reconstructedSheets[idx];
                if (!sheet) return r;
                return {
                  ...r,
                  unitUut: sheet.unit_uut ?? r.unitUut ?? null,
                  unitStd: sheet.unit_std ?? r.unitStd ?? null,
                };
              }));
              setRawDataFilename(`Data Session ${sessionId} (${reconstructedSheets.length} sensor)`);
            } else {
              setRawData([]);
              setRawDataFilename(null);
            }
          })
          .catch(err => {
            console.error("Failed to load raw data", err)
            setRawData([]);
            setRawDataFilename(null);
          });

      } else {
        setRawData([]);
        setRawDataFilename(null);
      }
    } else {
      setEditing(null)
      setSessionDetails({
        start_date: '',
        end_date: '',
        place: '',
        notes: ''
      })
      setUseStationAddressForPlace(false)
      setGlobalStandardInstrumentId(null)
      setGlobalStandardCertificateNumber(null)
      setInstrumentPreview({})
      setForm({
        no_certificate: 'Pilih Instrumen UUT & isi No. Identifikasi untuk preview…',
        no_order: '...',
        no_identification: '',
        authorized_by: null,
        verifikator_1: null as any,
        verifikator_2: null as any,
        verifikator_3: null as any,
        issue_date: '',
        station: null,
        instrument: null,
        station_address: null as any,
        certificate_type: 'sert',
        calibration_place: 'FC',
        instrument_code: null,
        balai_id: null,
        is_standard: false,
      })
      // Preview nomor akan di-fetch oleh useEffect di bawah setiap kali
      // code_alat / no_identification / place / cert_type berubah.

      setResults([{
        sensorId: null,
        startDate: '',
        endDate: '',
        place: '',
        environment: [],
        table: [{ title: '', rows: [{ key: '', unit: '', value: '', extraValues: [] }] }], // Initialize with extraValues
        images: [],
        notesForm: createDefaultNotesForm()
      }])
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
    setRawData([])
    setRawDataFilename(null)

  }

  // Re-fetch preview nomor sertifikat setiap kali komponen format berubah
  // (hanya di mode CREATE, saat modal terbuka, dan setelah code + no_ident diisi).
  // Nomor yang ditampilkan cuma preview — server tetap meng-assign nomor final
  // secara atomik saat submit untuk mencegah race condition.
  useEffect(() => {
    if (!isModalOpen) return
    if (editing) return              // mode edit: pakai nomor existing
    const code    = (form as any).instrument_code
    const noIdent = form.no_identification
    const place   = (form as any).calibration_place || 'FC'
    const ctype   = (form as any).certificate_type  || 'sert'

    // Butuh code & no_ident terisi untuk preview yang meaningful (khusus FC)
    if (!code || !noIdent) {
      setForm(prev => ({
        ...prev,
        no_certificate: 'Pilih Instrumen UUT & isi No. Identifikasi untuk preview…',
        no_order: '...',
      }))
      return
    }

    const controller = new AbortController()
    const handle = setTimeout(() => {
      const qs = new URLSearchParams({
        cert_type: ctype,
        place,
        code,
        no_ident: noIdent,
      }).toString()

      fetch(`/api/certificates/generate-number?${qs}`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(data => {
          setForm(prev => ({
            ...prev,
            no_certificate: data.no_certificate || '',
            no_order: data.no_order || '',
          }))
        })
        .catch(err => {
          if (err?.name === 'AbortError') return
          console.error('Failed to fetch preview number:', err)
        })
    }, 250)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isModalOpen,
    editing,
    (form as any).instrument_code,
    form.no_identification,
    (form as any).calibration_place,
    (form as any).certificate_type,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent multiple submissions
    if (submitDisabled || isSubmitting) return

    // Saat CREATE, no_certificate & no_order digenerate atomik di server
    // (create_certificate_with_auto_number), jadi nilai di form hanya preview
    // dan TIDAK WAJIB ada. Saat EDIT, kedua kolom tersebut harus ada.
    if (editing && (!form.no_certificate || !form.no_order)) {
      showError('Nomor sertifikat dan nomor order wajib diisi')
      return
    }
    if (!form.no_identification) {
      showError('No. Identifikasi wajib diisi')
      return
    }

    // Saat CREATE, kode alat ikut ke format nomor (IKK). Auto-resolve dari UUT.
    if (!editing && !(form as any).instrument_code) {
      showError('Kode Alat belum tersedia. Pilih Instrumen UUT yang Nama Instrumen-nya sudah punya "Kode Instrumen" di menu Master Instrumen.')
      return
    }

    if (!(form as any).verifikator_1 || !(form as any).verifikator_2 || !(form as any).verifikator_3) {
      showError('Verifikator 1, Verifikator 2, dan Verifikator 3 harus dipilih')
      return
    }

    // Validasi: assignor, verifikator 1, verifikator 2, dan verifikator 3 tidak boleh sama
    const assignor = form.authorized_by
    const verifikator1 = (form as any).verifikator_1
    const verifikator2 = (form as any).verifikator_2
    const verifikator3 = (form as any).verifikator_3

    if (assignor && verifikator1 && assignor === verifikator1) {
      showError('Assignor tidak boleh sama dengan Verifikator 1')
      return
    }

    if (assignor && verifikator2 && assignor === verifikator2) {
      showError('Assignor tidak boleh sama dengan Verifikator 2')
      return
    }

    if (assignor && verifikator3 && assignor === verifikator3) {
      showError('Assignor tidak boleh sama dengan Verifikator 3')
      return
    }

    if (verifikator1 && verifikator2 && verifikator1 === verifikator2) {
      showError('Verifikator 1 tidak boleh sama dengan Verifikator 2')
      return
    }

    if (verifikator1 && verifikator3 && verifikator1 === verifikator3) {
      showError('Verifikator 1 tidak boleh sama dengan Verifikator 3')
      return
    }

    if (verifikator2 && verifikator3 && verifikator2 === verifikator3) {
      showError('Verifikator 2 tidak boleh sama dengan Verifikator 3')
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
        if (selectedInstrument && (!selectedInstrument.name_alias && !selectedInstrument.instrument_names_id)) {
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
          const existingSessionId = editing ? getAnyResultSessionId(editing.results) : null
          const sessionPayload = {
            ...(existingSessionId ? { session_id: existingSessionId } : {}),
            station_id: form.station,
            instrument_id: form.instrument, // Pass instrument ID for uut_instrument_id
            start_date: sessionDetails.start_date || new Date().toISOString(), // Ensure start_date (mapped to tgl_kalibrasi)
            end_date: sessionDetails.end_date,
            place: sessionDetails.place,
            notes: sessionDetails.notes,
            status: 'draft'
          }

          const sessionRes = await fetch('/api/calibration-sessions', {
            method: existingSessionId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionPayload)
          })

          if (!sessionRes.ok) {
            const errData = await sessionRes.json().catch(() => ({}))
            const errMsg = errData.error || errData.message || sessionRes.statusText || 'Unknown error'
            throw new Error(`Gagal membuat sesi kalibrasi: ${errMsg} (Status: ${sessionRes.status})`)
          }

          {
            const sessionData = await sessionRes.json()
            console.log('Session Created/Found:', sessionData)

            // If Raw Data exists, save it linked to Session
            if (rawData.length > 0) {
              // Validate: Ensure all sheets have a selected UUT Sensor
              const missingUUT = rawData.some((_, idx) => !results[idx]?.sensorId);
              if (missingUUT) {
                throw new Error("Mohon pilih Sensor UUT untuk setiap sheet data mentah sebelum menyimpan.");
              }

              const rawDataPayload = {
                session_id: sessionData.session_id,
                data: rawData.map((sheet, idx) => {
                  // Resolve sensor_id_std for this sheet.
                  // PRIMARY: Use cert.sensor_id — this is explicitly chosen by user and guaranteed correct.
                  // FALLBACK: is_standard sensor from the instrument.

                  let targetInstrumentId = results[idx]?.standardInstrumentId ?? globalStandardInstrumentId ?? null;
                  let stdSensorId: number | null = null;

                  // This is the EXACT ID selected by the user from the "Pilih Sensor Standar" dropdown on this sheet
                  const sheetCertId = results[idx]?.standardCertificateId;

                  if (sheetCertId) {
                    const selectedCert = standardCerts.find(c => c.id === sheetCertId);
                    if (selectedCert?.sensor_id) {
                      stdSensorId = selectedCert.sensor_id;
                    }
                  }

                  if (targetInstrumentId && !stdSensorId) {
                    // Fallback 1: Use first cert from the global certificate number if no specific selection was made
                    if (globalStandardInstrumentId && targetInstrumentId === globalStandardInstrumentId && globalStandardCertificateNumber) {
                      const cert = standardCerts.find(c => c.no_certificate === globalStandardCertificateNumber);
                      if (cert) stdSensorId = cert.sensor_id;
                    }

                    // Fallback 2: is_standard sensor from the instrument
                    if (!stdSensorId) {
                      const inst = instruments.find((i: any) => i.id === targetInstrumentId);
                      const instSensors: any[] = inst?.sensor ?? [];
                      const stdSensor = instSensors.find((s: any) => s.is_standard);
                      if (stdSensor) stdSensorId = stdSensor.id;
                      else if (instSensors.length === 1) stdSensorId = instSensors[0].id;
                    }
                  }

                  // Resolve unit: PRIORITY = user-selected per-sheet override (results[idx].unitUut/unitStd)
                  // FALLBACK = sensor metadata (graduating_unit or range_capacity_unit)
                  const uutSensorId = results[idx]?.sensorId;
                  const uutSensor = uutSensorId ? sensors.find((s: any) => s.id === uutSensorId) : null;
                  const uutUnit = results[idx]?.unitUut
                    || uutSensor?.graduating_unit
                    || uutSensor?.range_capacity_unit
                    || null;

                  let stdUnit: string | null = results[idx]?.unitStd || null;
                  if (!stdUnit && stdSensorId) {
                    const allSensorsFlat = instruments.flatMap((i: any) => i.sensor ?? []);
                    const stdSensorObj = allSensorsFlat.find((s: any) => s.id === stdSensorId);
                    stdUnit = stdSensorObj?.graduating_unit || stdSensorObj?.range_capacity_unit || null;
                  }

                  return {
                    name: sheet.name,
                    data: sheet.data,
                    sensor_id_uut: results[idx]?.sensorId ?? null,
                    sensor_id_std: stdSensorId,
                    unit_uut: uutUnit,
                    unit_std: stdUnit,
                  }
                })
              };

              console.log('DEBUG: Sending Raw Data Payload:', JSON.stringify(rawDataPayload, null, 2));
              console.log(
                '[raw-save] sheet counts:',
                rawDataPayload.data.map((sheet: any) => ({
                  name: sheet.name,
                  rowsIncludingHeader: Array.isArray(sheet.data) ? sheet.data.length : 0,
                  dataRows: Array.isArray(sheet.data) ? Math.max(sheet.data.length - 1, 0) : 0,
                  sensor_id_uut: sheet.sensor_id_uut,
                }))
              )

              const rawRes = await fetch('/api/raw-data', {
                method: existingSessionId ? 'PUT' : 'POST',
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

              // Trigger QC cache: invalidate+recompute on update, trigger fresh computation on new save
              if (existingSessionId) {
                qcCacheService.invalidate(sessionData.session_id, true)
              } else {
                qcCacheService.triggerComputation(sessionData.session_id)
              }
            }
            return sessionData.session_id
          }
        } catch (sessionErr) {
          console.error('Failed to save session/raw data', sessionErr)
          throw sessionErr
        }
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

        console.log('[certificate-update] final results session ids:', finalResults.map((r: any) => ({
          sensorId: r.sensorId,
          session_id: r.session_id ?? null,
        })))

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
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 relative overflow-hidden z-0">
        <BatikBackground />
        <div className="relative z-[1] flex justify-between items-center">
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

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 lg:max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="certificate-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. sertifikat, no. order, instrumen, atau stasiun..."
              className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e377c]/40 focus:border-[#1e377c] text-sm bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Bersihkan pencarian"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="certificate-filter-status" className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                Status
              </label>
              <select
                id="certificate-filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e377c]/40 focus:border-[#1e377c] text-sm bg-white transition-all"
              >
                <option value="all">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="certificate-filter-station" className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                Stasiun
              </label>
              <select
                id="certificate-filter-station"
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e377c]/40 focus:border-[#1e377c] text-sm bg-white transition-all max-w-[220px] truncate"
              >
                <option value="all">Semua Stasiun</option>
                {stations.map((station) => (
                  <option key={station.id} value={String(station.id)}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || filterStatus !== 'all' || filterStation !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterStatus('all')
                  setFilterStation('all')
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {(searchQuery || filterStatus !== 'all' || filterStation !== 'all') && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Menampilkan <span className="font-semibold text-gray-800">{allowedCertificates.length}</span> sertifikat hasil filter
          </div>
        )}
      </div>

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
              {currentCertificates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1e377c] mb-3">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      {(searchQuery || filterStatus !== 'all' || filterStation !== 'all') ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900">Tidak ada sertifikat sesuai filter</p>
                          <p className="mt-1 text-xs text-gray-500 max-w-md">
                            Coba ubah kata kunci pencarian atau reset filter untuk melihat sertifikat lain.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('')
                              setFilterStatus('all')
                              setFilterStation('all')
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1e377c] border border-[#1e377c]/30 rounded-lg hover:bg-[#1e377c]/5 transition-colors"
                          >
                            Reset Filter
                          </button>
                        </>
                      ) : role === 'user_station' ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900">Belum ada sertifikat selesai</p>
                          <p className="mt-1 text-xs text-gray-500 max-w-md">
                            Daftar menampilkan hanya sertifikat berstatus <strong>Completed</strong> untuk stasiun yang ditugaskan ke akun Anda. Belum ada sertifikat yang memenuhi kriteria tersebut.
                          </p>
                        </>
                      ) : certificates.length === 0 ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900">Belum ada sertifikat</p>
                          <p className="mt-1 text-xs text-gray-500 max-w-md">
                            Sistem belum memiliki sertifikat. Gunakan tombol &quot;Create New&quot; untuk membuat sertifikat baru.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-900">Tidak ada sertifikat yang relevan</p>
                          <p className="mt-1 text-xs text-gray-500 max-w-md">
                            Belum ada sertifikat yang sesuai dengan akun Anda. Sertifikat akan tampil di sini setelah Anda ditugaskan sebagai pembuat, verifikator, atau penandatangan.
                          </p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
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
                        {item.instrument ? (() => {
                          const inst = instruments.find(i => i.id === item.instrument);
                          if (!inst) return 'Unknown';
                          return (inst as any).instrument_names?.name 
                            || instrumentNames.find(n => n.id === (inst as any).instrument_names_id)?.name 
                            || (inst as any).name_alias 
                            || inst.name 
                            || `${inst.manufacturer || ''} ${inst.type || ''}`.trim()
                            || 'Unknown';
                        })() : '-'}
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
                          {((item as any).verifikator_1_status === 'pending' || !(item as any).verifikator_1_status) ? 'Belum di periksa' : (item as any).verifikator_1_status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">Verifikator 2:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${(item as any).verifikator_2_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_2_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                          {((item as any).verifikator_2_status === 'pending' || !(item as any).verifikator_2_status) ? 'Belum di periksa' : (item as any).verifikator_2_status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">Verifikator 3:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${(item as any).verifikator_3_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).verifikator_3_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                          {((item as any).verifikator_3_status === 'pending' || !(item as any).verifikator_3_status) ? 'Belum di periksa' : (item as any).verifikator_3_status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-500">Penandatangan:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${(item as any).authorized_by_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          (item as any).authorized_by_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                          {((item as any).authorized_by_status === 'pending' || !(item as any).authorized_by_status) ? 'Belum di periksa' : (item as any).authorized_by_status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${item.status === 'draft' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        item.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                            item.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              item.status === 'completed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                        {item.status || 'draft'}
                      </span>
                      {(item as any).calibration_kind && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${(item as any).calibration_kind === 'LC' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                          {(item as any).calibration_kind}
                        </span>
                      )}
                      {(item as any).results_frozen_at && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded border bg-gray-100 text-gray-500 border-gray-300" title={`Results dibekukan: ${new Date((item as any).results_frozen_at).toLocaleString('id-ID')}`}>
                          🔒
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="relative inline-block text-left" data-action-menu="true">
                      <button
                        onClick={() => setActionDropdownOpenId(actionDropdownOpenId === item.id ? null : item.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${actionDropdownOpenId === item.id
                          ? 'bg-[#1e377c] text-white border-[#1e377c] shadow-inner'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                          }`}
                      >
                        Aksi
                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${actionDropdownOpenId === item.id ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {actionDropdownOpenId === item.id && role === 'user_station' && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-[50] py-1 animate-in fade-in slide-in-from-top-2 duration-200 border border-gray-100">
                          <div className="py-1">
                            {item.pdf_path ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSignedPdf(item)}
                                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                                >
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  View Signed PDF
                                </button>
                                <button
                                  onClick={() => downloadSignedPdf(item)}
                                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                                >
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download Signed PDF
                                </button>
                              </>
                            ) : (
                              <div className="px-4 py-3 text-xs text-gray-500 italic text-center">
                                File PDF tertandatangan belum tersedia.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dropdown Menu - full version untuk role selain user_station */}
                      {actionDropdownOpenId === item.id && role !== 'user_station' && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-[50] py-1 animate-in fade-in slide-in-from-top-2 duration-200 border border-gray-100 divide-y divide-gray-50">
                          {/* VIEW GROUP */}
                          <div className="py-1">
                            {item.status === 'draft' && (
                              <a
                                href={`/draft-view?certificate=${item.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                              >
                                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                View Draft
                              </a>
                            )}
                            <a
                              href={`/certificates/${item.id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <ViewIcon className="w-4 h-4 text-blue-600" />
                              View Certificate
                            </a>
                            {item.pdf_path && (
                              <button
                                type="button"
                                onClick={() => openSignedPdf(item)}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                              >
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                View Saved PDF
                              </button>
                            )}
                          </div>

                          {/* DOWNLOADS / PRINT GROUP */}
                          <div className="py-1">
                            <button
                              onClick={() => handlePreviewLHKS(item)}
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                            >
                              <PrinterIcon className="w-4 h-4 text-purple-600" />
                              Preview LHKS
                            </button>
                            {item.pdf_path && (
                              <button
                                onClick={() => downloadSignedPdf(item)}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                              >
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download Signed PDF
                              </button>
                            )}

                            <button
                              onClick={() => {
                                const sessionId = getAnyResultSessionId(item.results);

                                if (sessionId) {
                                  setQcModalCertificate(item);
                                  setShowQCModal(true);
                                  setActionDropdownOpenId(null);
                                } else {
                                  showError("Data QC tidak tersedia. Pastikan sertifikat ini memiliki data mentah yang tersimpan (session_id).");
                                }
                              }}
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            >
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              QC Check Data
                            </button>
                            <button
                              onClick={async () => {
                                const sessionId = getAnyResultSessionId(item.results);

                                if (sessionId) {
                                  setUncertaintyModalCertificate(item);
                                  setUncertaintyRawData([]);
                                  try {
                                    const res = await fetch(`/api/raw-data?session_id=${sessionId}`);
                                    const json = await res.json();
                                    setUncertaintyRawData(json.data || []);
                                    setShowUncertaintyModal(true);
                                    setActionDropdownOpenId(null);
                                  } catch (e) {
                                    console.error("Failed to fetch raw data for Uncertainty", e);
                                    showError("Gagal mengambil data mentah untuk perhitungan ketidakpastian");
                                  }
                                } else {
                                  showError("Data QC tidak tersedia. Pastikan sertifikat ini memiliki data mentah yang tersimpan (session_id).");
                                }
                              }}
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                            >
                              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              Uncertainty
                            </button>
                          </div>

                          {/* ACTION / MODIFY GROUP */}
                          <div className="py-1">
                            {getLatestRejectionEntry(item) && (
                              <button
                                onClick={() => {
                                  handleOpenRejectionNotes(item);
                                  setActionDropdownOpenId(null);
                                }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
                              >
                                <FileTextIcon className="w-4 h-4 text-red-600" />
                                Lihat Catatan Reject
                              </button>
                            )}

                            {item.status === 'draft' && can('certificate', 'update') && (
                              <button
                                onClick={() => {
                                  openModal(item);
                                  setActionDropdownOpenId(null);
                                }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                              >
                                <EditIcon className="w-4 h-4 text-purple-600" />
                                Edit Certificate
                              </button>
                            )}

                            {((item as any).repair_status === 'none' &&
                              item.status !== 'draft' &&
                              ((item as any).verifikator_1_status === 'rejected' || (item as any).verifikator_2_status === 'rejected' || (item as any).verifikator_3_status === 'rejected')) && (
                              <button
                                onClick={() => {
                                  openModal(item);
                                  setActionDropdownOpenId(null);
                                }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                              >
                                <SettingsIcon className="w-4 h-4 text-orange-600" />
                                Request Repair
                              </button>
                            )}

                            {(item as any).repair_status === 'pending' && (
                              <button
                                onClick={() => {
                                  handleCompleteRepair(item);
                                  setActionDropdownOpenId(null);
                                }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                              >
                                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                Complete Repair
                              </button>
                            )}

                            {(item as any).repair_status === 'completed' && (
                              <button
                                onClick={() => {
                                  handleResetVerification(item);
                                  setActionDropdownOpenId(null);
                                }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                <RefreshIcon className="w-4 h-4 text-blue-600" />
                                Reset Verification
                              </button>
                            )}

                            {can('certificate', 'delete') && canEndpoint('DELETE', `/api/certificates/${item.id}`) && (isCalibrator ? (item.status || 'draft') === 'draft' : item.status !== 'sent') && (
                              <button
                                onClick={() => {
                                  handleDelete(item.id);
                                  setActionDropdownOpenId(null);
                                }}
                                disabled={isDeleting === item.id}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors disabled:opacity-50"
                              >
                                {isDeleting === item.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <DeleteIcon className="w-4 h-4" />
                                )}
                                {isDeleting === item.id ? "Deleting..." : "Delete Certificate"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
                          const stationAddress = st ? String((st as any).address ?? '') : ''
                          setForm({
                            ...form,
                            station: selectedId,
                            station_address: stationAddress || null
                          })
                          if (useStationAddressForPlace) {
                            setSessionDetails(prev => ({ ...prev, place: stationAddress }))
                            setResults(prev => prev.map(result => ({ ...result, place: stationAddress })))
                          }
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

                    {/* Komponen format nomor sertifikat sesuai IKK BMKG.
                        Hanya ditampilkan saat CREATE; saat EDIT nomor sudah ada.
                        - Jenis Kalibrasi: FC (Field) saat ini; LC disiapkan untuk tahap berikut.
                        - Kode Alat: auto-resolve dari instrument (UUT) yang dipilih,
                          via relasi instrument.instrument_names_id → instrument_names.code_alat. */}
                    {!editing && (
                      <>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-gray-700">Jenis Kalibrasi *</label>
                          <select
                            value={(form as any).calibration_place || 'FC'}
                            onChange={(e) => setForm({ ...form, calibration_place: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                          >
                            <option value="FC">Field Calibration (FC)</option>
                            <option value="LC">Lab Calibration (LC)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-gray-700">
                            Kode Alat <span className="font-normal text-gray-500">(auto dari UUT)</span>
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={(form as any).instrument_code || ''}
                            placeholder={form.instrument ? 'Kode alat tidak tersedia untuk instrumen ini' : 'Pilih Instrumen UUT dulu…'}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
                          />
                          {form.instrument && !(form as any).instrument_code && (
                            <p className="text-[11px] text-red-500 italic">
                              Nama Instrumen terhubung ke instrumen ini belum punya "Kode Instrumen". Minta admin hubungkan di menu "Master Instrumen".
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Balai Penerbit & Sertifikat Standar — visible in both create and edit modes */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Balai Penerbit</label>
                      <select
                        value={(form as any).balai_id ?? ''}
                        onChange={(e) => {
                          const newBalaiId = e.target.value ? Number(e.target.value) : null
                          const updatedForm: any = { ...form, balai_id: newBalaiId }

                          // Auto-suggest authorized_by based on Balai selection
                          // Find a personel with matching balai_id
                          const suggestedSigner = personel.find((p: any) => {
                            if (newBalaiId === null) {
                              // BMKG Pusat: find personel with balai_id = null (or no balai_id)
                              return !p.balai_id
                            }
                            return p.balai_id === newBalaiId
                          })

                          if (suggestedSigner) {
                            updatedForm.authorized_by = suggestedSigner.id
                          }

                          setForm(updatedForm)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c]"
                      >
                        <option value="">BMKG Pusat (Default)</option>
                        <option value="1">Balai Besar MKG Wilayah I (Medan)</option>
                        <option value="2">Balai Besar MKG Wilayah II (Tangerang Selatan)</option>
                        <option value="3">Balai Besar MKG Wilayah III (Denpasar)</option>
                        <option value="4">Balai Besar MKG Wilayah IV (Makassar)</option>
                        <option value="5">Balai Besar MKG Wilayah V (Jayapura)</option>
                      </select>
                    </div>
                    {/* Fitur centang standar dinonaktifkan - tidak lagi diperlukan */}
                    {/* <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(form as any).is_standard || false}
                          onChange={(e) => setForm({ ...form, is_standard: e.target.checked } as any)}
                          className="w-4 h-4 text-[#1e377c] border-gray-300 rounded focus:ring-[#1e377c]"
                        />
                        <span className="text-xs font-semibold text-gray-700">Sertifikat Standar Kalibrasi</span>
                      </label>
                      <p className="text-[11px] text-gray-500 italic ml-6">Centang jika ini adalah sertifikat untuk alat standar kalibrasi (bukan alat UUT biasa)</p>
                    </div> */}

                    {/* Certificate Numbers
                        Saat CREATE, no_certificate & no_order digenerate atomik di server
                        (create_certificate_with_auto_number) sehingga read-only & berperan
                        sebagai preview saja. Saat EDIT, keduanya editable normal. */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {editing ? 'No. Sertifikat *' : 'No. Sertifikat (otomatis)'}
                      </label>
                      <input
                        required={!!editing}
                        readOnly={!editing}
                        type="text"
                        value={form.no_certificate}
                        onChange={(e) => setForm({ ...form, no_certificate: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c] ${
                          editing
                            ? 'border-gray-300'
                            : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                        }`}
                      />
                      {!editing && (
                        <p className="text-[11px] text-gray-500 italic">
                          Nomor final akan ditetapkan otomatis saat disimpan untuk mencegah duplikasi.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {editing ? 'No. Order *' : 'No. Order (otomatis)'}
                      </label>
                      <input
                        required={!!editing}
                        readOnly={!editing}
                        type="text"
                        value={form.no_order}
                        onChange={(e) => setForm({ ...form, no_order: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c] ${
                          editing
                            ? 'border-gray-300'
                            : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                        }`}
                      />
                    </div>
                    {[
                      { label: 'No. Identifikasi *', value: form.no_identification, onChange: (e: any) => setForm({ ...form, no_identification: e.target.value }), type: 'text', required: true },
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
                            nip: p.nip || ''
                          }))}
                        placeholder="Pilih verifikator 2"
                        searchPlaceholder="Cari verifikator 2..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Verifikator 3 *</label>
                      <SearchableDropdown
                        id="form-verifikator-3"
                        value={(form as any).verifikator_3 ?? null}
                        onChange={(value) => setForm({ ...form, verifikator_3: value as string | null } as any)}
                        options={personel
                          .filter(p => p.role === 'verifikator')
                          .map(p => ({
                            id: p.id,
                            name: p.nip ? `${p.name} (${p.nip})` : p.name,
                            nip: p.nip || ''
                          }))}
                        placeholder="Pilih verifikator 3"
                        searchPlaceholder="Cari verifikator 3..."
                      />
                    </div>
                  </div>
                </div>

                {/* Frozen banner — tampil jika results sudah dibekukan */}
                {(editing as any)?.results_frozen_at && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <span className="text-lg leading-none">🔒</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Hasil kalibrasi telah dibekukan</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Dibekukan sejak {new Date((editing as any).results_frozen_at).toLocaleString('id-ID')}.
                        Bagian II dan III tidak dapat diedit. Untuk membuka kembali, sertifikat harus dikembalikan ke status Draft melalui alur penolakan verifikator.
                      </p>
                    </div>
                  </div>
                )}

                {/* Wrapper disabled untuk Bagian II & III saat frozen */}
                <div className={(editing as any)?.results_frozen_at ? 'pointer-events-none opacity-50 select-none' : ''}>

                {/* Bagian II – Detail Sesi Kalibrasi (Global Session Info) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Detail Sesi Kalibrasi (Global)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Tanggal Kalibrasi</label>
                      <DateRangePicker
                        startDate={sessionDetails.start_date ? (() => {
                          const d = new Date(sessionDetails.start_date);
                          if (isNaN(d.getTime())) return sessionDetails.start_date.split('T')[0];
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        })() : ''}
                        endDate={sessionDetails.end_date ? (() => {
                          const d = new Date(sessionDetails.end_date);
                          if (isNaN(d.getTime())) return sessionDetails.end_date.split('T')[0];
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        })() : ''}
                        onChange={(start, end) => {
                          const start_date = start ? `${start}T00:00` : '';
                          const end_date = end ? `${end}T23:59` : (start ? `${start}T23:59` : '');
                          setSessionDetails(s => ({
                            ...s,
                            start_date,
                            end_date
                          }))
                          setResults(prev => prev.map(r => ({ ...r, startDate: start_date, endDate: end_date })))
                        }}
                        placeholder="Pilih rentang tanggal kalibrasi"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <label className="block text-xs font-semibold text-gray-700">Tempat Kalibrasi</label>
                        <label className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-600">
                          <span>Sama dengan alamat stasiun</span>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={useStationAddressForPlace}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setUseStationAddressForPlace(checked)
                              if (checked) {
                                const stationAddress = resolveStationAddress(form.station, (form as any).station_address)
                                setSessionDetails(prev => ({ ...prev, place: stationAddress }))
                                setResults(prev => prev.map(r => ({ ...r, place: stationAddress })))
                              }
                            }}
                          />
                          <span className="relative h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-[#1e377c] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                        </label>
                      </div>
                      <input
                        type="text"
                        readOnly={useStationAddressForPlace}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c] ${
                          useStationAddressForPlace
                            ? 'border-gray-200 bg-gray-50 text-gray-700'
                            : 'border-gray-300'
                        }`}
                        placeholder="Laboratorium Kalibrasi BMKG..."
                        value={sessionDetails.place}
                        onChange={e => {
                          const newPlace = e.target.value;
                          setSessionDetails({ ...sessionDetails, place: newPlace });
                          setResults(prev => prev.map(r => ({ ...r, place: newPlace })));
                        }}
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
                    </div>
                    <div className="space-y-1">
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
                          .map(i => {
                                                      const baseName = (i as any).instrument_names?.name || instrumentNames.find(n => n.id === (i as any).instrument_names_id)?.name || (i as any).name_alias || (i as any).name || 'Unknown';
                                                      const alias = (i as any).name_alias;
                                                      const aliasPart = alias && String(alias).trim() && alias !== baseName ? ` — ${alias}` : '';
                                                      return {
                                                        id: i.id,
                                                        name: `${baseName}${aliasPart} (${i.manufacturer || '-'} ${i.type || '-'} • SN: ${(i as any).serial_number || '-'})`,
                                                        station_id: i.station?.name || ''
                                                      };
                                                    })}
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
                          options={standardInstruments
                                                      .map(i => {
                                                        const baseName = (i as any).instrument_names?.name || instrumentNames.find(n => n.id === (i as any).instrument_names_id)?.name || (i as any).name_alias || (i as any).name || 'Unknown';
                                                        const alias = (i as any).name_alias;
                                                        const aliasPart = alias && String(alias).trim() && alias !== baseName ? ` — ${alias}` : '';
                                                        return {
                                                          id: i.id,
                                                          name: `${baseName}${aliasPart} (${i.manufacturer || '-'} ${i.type || '-'} • SN: ${(i as any).serial_number || '-'})`,
                                                          station_id: i.station?.name || ''
                                                        };
                                                      })}
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
                            // Get sensor IDs that belong to the selected standard instrument
                            // Look in standardInstruments first (unfiltered), fallback to instruments
                            const selectedInstrument = standardInstruments.find(i => i.id === globalStandardInstrumentId)
                              || instruments.find(i => i.id === globalStandardInstrumentId);
                            const sensorIdsForInstrument = new Set(
                              (selectedInstrument?.sensor ?? []).map((s: any) => s.id)
                            );
                            // Filter certs whose sensor_id belongs to the selected instrument
                            const certsForInst = standardCerts.filter(c =>
                              sensorIdsForInstrument.has(c.sensor_id)
                            );
                            // Group by certificate number (normalize by trimming)
                            const uniqueNos = Array.from(new Set(certsForInst.map(c => c.no_certificate.trim())));
                            const computedOptions = uniqueNos.map(no => ({
                              id: no,
                              name: no,
                              station_id: `${certsForInst.find(c => c.no_certificate.trim() === no)?.calibration_date || ''}`
                            }));
                            // Ensure currently selected certificate number is always in the list
                            if (globalStandardCertificateNumber && !computedOptions.some(o => o.id === globalStandardCertificateNumber)) {
                              computedOptions.unshift({
                                id: globalStandardCertificateNumber,
                                name: globalStandardCertificateNumber,
                                station_id: ''
                              });
                            }
                            return computedOptions;
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

                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {rawData.length === 0 ? (
                          <div className="text-xs text-center text-gray-400 py-4 italic">Belum ada data diupload</div>
                        ) : (
                          rawData.map((sheet, i) => {
                            const unitOptions = units;
                            return (
                              <div key={i} className="p-2 bg-white border border-gray-200 rounded shadow-sm space-y-2">
                                {/* Sheet header row */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">#{i + 1}</span>
                                  <div className="truncate flex-1">
                                    <div className="text-xs font-bold text-gray-800 truncate" title={sheet.name}>{sheet.name}</div>
                                    <div className="text-[10px] text-gray-500">{sheet.data.length} baris</div>
                                  </div>
                                </div>
                                {/* Dual unit selector: user assigns both UUT and STD units explicitly */}
                                <div className="pt-1 border-t border-gray-100 space-y-1.5">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                        Unit kolom UUT
                                      </label>
                                      <SearchableDropdown
                                        value={results[i]?.unitUut || ''}
                                        onChange={val => updateResult(i, { unitUut: val ? String(val) : null })}
                                        options={unitOptions.map(u => ({ id: u.unit, name: u.unit }))}
                                        placeholder="Pilih unit"
                                        searchPlaceholder="Cari unit..."
                                        className="mt-0.5"
                                        renderOptionName={(name) => <SmartUnit value={name} />}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                        Unit kolom STD
                                      </label>
                                      <SearchableDropdown
                                        value={results[i]?.unitStd || ''}
                                        onChange={val => updateResult(i, { unitStd: val ? String(val) : null })}
                                        options={unitOptions.map(u => ({ id: u.unit, name: u.unit }))}
                                        placeholder="Pilih unit"
                                        searchPlaceholder="Cari unit..."
                                        className="mt-0.5"
                                        renderOptionName={(name) => <SmartUnit value={name} />}
                                      />
                                    </div>
                                  </div>
                                  {results[i]?.unitUut && results[i]?.unitStd && results[i]?.unitUut !== results[i]?.unitStd && (
                                    <div className="text-[10px] text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                                      ⚠️ Unit berbeda — STD ({results[i]?.unitStd}) akan dikonversi ke UUT ({results[i]?.unitUut}) sebelum hitung koreksi
                                    </div>
                                  )}
                                  {results[i]?.unitUut && results[i]?.unitStd && results[i]?.unitUut === results[i]?.unitStd && (
                                    <div className="text-[10px] text-green-600 bg-green-50 rounded px-1.5 py-0.5">
                                      ✓ Unit sama — tidak perlu konversi
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
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
                {results.map((result, resultIndex) => {
                  // Inline unitOptions for closure access inside map
                  const unitOptions: { id: number; unit: string }[] = units;
                  return (<div key={resultIndex} className="bg-gray-50/50 rounded-xl border border-gray-200 p-4 mb-6 relative">
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
                                .filter(s => form.instrument ? s.instrument_id === form.instrument : true)
                                .filter(s => !s.is_standard)
                                .map(s => {
                                  // Prioritas label utama:
                                  // 1. Nama dari tabel instrument_names via sensor_name_id
                                  // 2. Alias sensor (s.name)
                                  // 3. Fallback ke merk + type
                                  const resolvedName = s.sensor_name_id
                                    ? instrumentNames.find(n => n.id === s.sensor_name_id)?.name
                                    : undefined
                                  const sensorLabel = resolvedName || s.name || [s.manufacturer, s.type].filter(Boolean).join(' ') || `Sensor #${s.id}`
                                  // Subtitle: nama instrumen
                                  const instr = instruments.find(i => i.id === s.instrument_id)
                                  return {
                                    id: s.id,
                                    name: sensorLabel,
                                    station_id: instr?.name  // nama instrumen sebagai subtitle
                                  }
                                })}

                              placeholder={form.instrument ? "Pilih Sensor UUT..." : "Pilih Instrument Terlebih Dahulu"}
                              searchPlaceholder="Cari Sensor..."
                            />
                          </div>

                          {/* Unit Selector per Sheet */}

                          {/* Detail UUT Form (Editable) */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
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
                                
                                const standardSensor = sensors.find((s: any) => s.id === sensorId);
                                const traceValue = (standardSensor as any)?.tracebility || (standardSensor as any)?.traceability || '';

                                updateResult(resultIndex, {
                                  // Sync global values into this result item ensures data integrity
                                  standardInstrumentId: globalStandardInstrumentId,
                                  standardCertificateNumber: globalStandardCertificateNumber,
                                  standardCertificateId: certId,
                                  notesForm: {
                                    ...result.notesForm,
                                    // Store the SENSOR ID in notesForm, as that's what backend expects for "standardInstruments"
                                    standardInstruments: sensorId ? [sensorId] : [],
                                    ...(traceValue ? { traceable_to_si_through: String(traceValue) } : {})
                                  }
                                });
                              }}
                              options={(() => {
                                if (!globalStandardInstrumentId || !globalStandardCertificateNumber) return [];

                                // Filter to only certs matching the selected certificate number
                                const certsForThisCert = standardCerts.filter(c =>
                                  c.no_certificate.trim() === globalStandardCertificateNumber
                                );

                                // Helper: does a cert row have real (non-empty) calibration data?
                                const hasRealData = (c: typeof certsForThisCert[0]) =>
                                  c.range && c.range !== '-' && c.range !== '' && c.drift != null && c.drift !== 0;

                                // Sort so rows WITH real data come first
                                // (ensures we pick the "data" row over the empty "header" row when deduplicating)
                                const sorted = [...certsForThisCert].sort((a, b) =>
                                  (hasRealData(b) ? 1 : 0) - (hasRealData(a) ? 1 : 0)
                                );

                                // Deduplicate by sensor fingerprint: name + type + serial_number
                                // This handles the DB data quality issue where two sensor_id values
                                // point to the same physical sensor (same name/type/SN, one empty record)
                                const seenFingerprints = new Set<string>();
                                const uniqueCerts = sorted.filter(c => {
                                  if (!c.sensor_id) return false; // skip rows without a sensor
                                  const s = sensors.find(sen => sen.id === c.sensor_id);
                                  const fingerprint = `${s?.name || ''}|${s?.type || ''}|${s?.serial_number || ''}`;
                                  if (seenFingerprints.has(fingerprint)) return false;
                                  seenFingerprints.add(fingerprint);
                                  return true;
                                });

                                return uniqueCerts.map(c => {
                                  const s = sensors.find(sen => sen.id === c.sensor_id);
                                  // Prioritas nama: instrument_names via sensor_name_id → alias → 'Sensor Unknown'
                                  const resolvedName = s?.sensor_name_id
                                    ? instrumentNames.find(n => n.id === s.sensor_name_id)?.name
                                    : undefined
                                  const sensorName = resolvedName || s?.name || 'Sensor Unknown';
                                  const sensorType = s?.type || '';
                                  const sn = s?.serial_number || '-';
                                  const mainLabel = `${sensorName}${sensorType ? ` (${sensorType})` : ''}`;
                                  const rangeStr = c.range && c.range !== '-' ? c.range : '-';
                                  const driftStr = c.drift != null && c.drift !== 0 ? String(c.drift) : '-';
                                  const details = `S/N: ${sn} • Range: ${rangeStr} • Drift: ${driftStr}`;
                                  return { id: c.id, name: mainLabel, station_id: details };
                                });

                              })()}

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
                              result.environment.map((env, envIdx) => {
                                const isEnabled = env.enabled !== false;
                                return (
                                  <div key={envIdx} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <label className={`block text-xs font-semibold ${isEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {env.key}
                                      </label>
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={isEnabled}
                                          onChange={e => {
                                            const newEnv = [...result.environment];
                                            newEnv[envIdx] = { ...newEnv[envIdx], enabled: e.target.checked };
                                            updateResult(resultIndex, { environment: newEnv });
                                          }}
                                        />
                                        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#1e377c]"></div>
                                      </label>
                                    </div>
                                    <input
                                      value={env.value}
                                      disabled={!isEnabled}
                                      onChange={e => {
                                        const newEnv = [...result.environment];
                                        newEnv[envIdx] = { ...newEnv[envIdx], value: e.target.value };
                                        updateResult(resultIndex, { environment: newEnv });
                                      }}
                                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e377c] ${!isEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                                    />
                                  </div>
                                );
                              })
                            ) : (
                              <div className="col-span-2 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <p className="text-xs text-gray-500 italic">Belum ada data kondisi lingkungan. Upload Data Mentah untuk auto-generate atau tambah manual.</p>
                                <button
                                  type="button"
                                  onClick={() => updateResult(resultIndex, { environment: [{ key: 'Suhu', value: '', enabled: false }, { key: 'Kelembaban', value: '', enabled: false }] })}
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
                              <SearchableDropdown
                                value={result.notesForm?.calibration_methode || ''}
                                onChange={val => updateResult(resultIndex, { notesForm: { ...result.notesForm, calibration_methode: val ? String(val) : '' } })}
                                options={[
                                  'MK 01 - Suhu',
                                  'MK 03 - Kelembapan Udara Relatif',
                                  'MK 02 - Tekanan Udara',
                                  'MK 04 - Anemometer (Kecepatan Angin)',
                                  'MK 05 - Anemometer (Arah Angin)',
                                  'MK 06 - Penakar Hujan',
                                ].map(method => ({ id: method, name: method }))}
                                placeholder="Pilih Metode Kalibrasi"
                                searchPlaceholder="Cari metode kalibrasi..."
                              />
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
                            <div className="space-y-1 md:col-span-2">
                              <div className="flex items-center justify-between">
                                <label className={`block text-xs font-semibold ${result.notesForm?.others_enabled ? 'text-gray-700' : 'text-gray-400'}`}>Lainnya / Komentar</label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={Boolean(result.notesForm?.others_enabled)}
                                    onChange={e => updateResult(resultIndex, { notesForm: { ...result.notesForm, others_enabled: e.target.checked } })}
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-[#1e377c] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                                  <span className="ml-2 text-[11px] font-medium text-gray-600">
                                    {result.notesForm?.others_enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </label>
                              </div>
                              <RichTextEditor
                                value={result.notesForm?.others || ''}
                                onChange={value => updateResult(resultIndex, { notesForm: { ...result.notesForm, others: value } })}
                                placeholder="Keterangan tambahan, catatan khusus, atau komentar lainnya..."
                                minHeightClassName="min-h-[110px]"
                                disabled={!result.notesForm?.others_enabled}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}






                </div>{/* end frozen wrapper */}

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
                      disabled={isSubmitting || submitDisabled}
                      className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] hover:from-[#2a4a9d] hover:to-[#1e377c] rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting && (
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isSubmitting ? 'Menyimpan...' : 'Simpan Sesi Kalibrasi'}
                    </button>
                  </div>
                </div>

              </form>
            </div >
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

                        {/* Auto-Generate Button */}
                        <div className="ml-auto relative mr-2">
                           <button
                            type="button"
                            onClick={() => handleAutoGenerate(si)}
                            disabled={isGenerating}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 border border-transparent shadow-sm ${isGenerating
                              ? 'bg-gray-100 text-gray-400 cursor-wait'
                              : 'text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700'}`}
                            title="Generate dari Data QC"
                          >
                            {isGenerating ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5" />
                            ) : (
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            )}
                            Auto-Generate QC
                          </button>
                        </div>

                        {/* Import Excel Button */}
                        <div className="relative">
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
                    <div className="flex items-center justify-between">
                      <label className={`block text-xs font-semibold ${noteDraft.others_enabled ? 'text-gray-700' : 'text-gray-400'}`}>Others</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={Boolean(noteDraft.others_enabled)}
                          onChange={e => setNoteDraft(prev => ({ ...prev, others_enabled: e.target.checked }))}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-[#1e377c] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                        <span className="ml-2 text-[11px] font-medium text-gray-600">
                          {noteDraft.others_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    <RichTextEditor
                      value={noteDraft.others}
                      onChange={value => setNoteDraft(prev => ({ ...prev, others: value }))}
                      placeholder="Other notes..."
                      minHeightClassName="min-h-[96px]"
                      disabled={!noteDraft.others_enabled}
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
                    {(() => {
                      const rows = parseCorrectionData(viewingCorrectionStandard);
                      return rows.length > 0 ? (
                        rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-900">{row.setpoint || '-'}</td>
                            <td className="px-6 py-3 text-blue-700">{row.correction}</td>
                            <td className="px-6 py-3 text-gray-600">{row.u95 || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-gray-500 italic bg-gray-50/30">
                            Tidak ada data koreksi tersedia untuk sertifikat ini.
                          </td>
                        </tr>
                      );
                    })()}
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

      {isRejectionNotesModalOpen && selectedRejectionCertificate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Catatan Reject</h3>
                <p className="text-red-100 text-xs">
                  {selectedRejectionCertificate.no_certificate}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRejectionNotesModalOpen(false)
                  setSelectedRejectionCertificate(null)
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const latestRejection = getLatestRejectionEntry(selectedRejectionCertificate)
              const rejectionHistory = getSortedRejectionHistory(selectedRejectionCertificate)
              const rejectedBy = latestRejection?.rejected_by
                ? personel.find((p) => p.id === latestRejection.rejected_by)?.name || latestRejection.rejected_by
                : null

              return (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Level Penolakan:</span>
                      <p className="text-gray-900 mt-1">
                        {getVerificationLevelLabel(latestRejection?.verification_level)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Waktu:</span>
                      <p className="text-gray-900 mt-1">
                        {latestRejection?.rejection_timestamp
                          ? new Date(latestRejection.rejection_timestamp).toLocaleString('id-ID')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Ditolak Oleh:</span>
                      <p className="text-gray-900 mt-1">{rejectedBy || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Catatan Reject:</span>
                      <p className="text-gray-900 mt-1 whitespace-pre-wrap">
                        {latestRejection?.rejection_reason || (selectedRejectionCertificate as any).rejection_reason || 'Catatan penolakan tidak tersedia.'}
                      </p>
                    </div>
                  </div>

                  {rejectionHistory.length > 1 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-900">Linimasa Reject</p>
                        <span className="text-xs text-gray-500">
                          {rejectionHistory.length} riwayat
                        </span>
                      </div>

                      <div className="space-y-4">
                        {rejectionHistory.map((entry: any, index: number) => {
                          const entryRejectedBy = entry?.rejected_by
                            ? personel.find((p) => p.id === entry.rejected_by)?.name || entry.rejected_by
                            : null

                          return (
                            <div key={`${entry.rejection_timestamp || index}-${entry.verification_level || 0}`} className="flex gap-3">
                              <div className="flex flex-col items-center pt-1">
                                <div className={`w-2.5 h-2.5 rounded-full ${index === 0 ? 'bg-red-600' : 'bg-red-300'}`}></div>
                                {index < rejectionHistory.length - 1 && (
                                  <div className="w-px flex-1 bg-red-200 mt-1"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    {getVerificationLevelLabel(entry?.verification_level)}
                                  </span>
                                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
                                    {entry?.rejection_category_label || entry?.rejection_category || 'Reject'}
                                  </span>
                                  {entry?.reset_from_level && (
                                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                      Ulang dari {getVerificationLevelLabel(entry.reset_from_level)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mb-1">
                                  {entry?.rejection_timestamp
                                    ? new Date(entry.rejection_timestamp).toLocaleString('id-ID')
                                    : '-'}
                                  {entryRejectedBy ? ` • ${entryRejectedBy}` : ''}
                                </p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {entry?.rejection_reason || 'Catatan penolakan tidak tersedia.'}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => {
                  setIsRejectionNotesModalOpen(false)
                  setSelectedRejectionCertificate(null)
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QC Modal */}
      {
        qcModalCertificate && (
          <QCDataModal
            isOpen={showQCModal}
            onClose={() => {
              setShowQCModal(false);
              setQcModalCertificate(null);
            }}
            title={qcModalCertificate.no_certificate}
            sessionId={getAnyResultSessionId(qcModalCertificate.results) ?? undefined}
            certificateId={String(qcModalCertificate.id)}
            certificateInstrumentId={qcModalCertificate.instrument || undefined}
            instruments={instruments}
            sensors={
              instruments.find(i => i.id === qcModalCertificate.instrument)?.sensor || []
            }
            instrumentNames={instrumentNames}
            standardCerts={standardCerts}
            resultEntries={resultsToLegacyView(qcModalCertificate.results).map((r: any) => ({
              sensorId: r.sensorId ?? r.sensor_id ?? null,
              unitUut: r.unitUut ?? r.unit_uut ?? null,
              unitStd: r.unitStd ?? r.unit_std ?? null,
            }))}
            certificateStatus={qcModalCertificate.status}
            onCalculateSaved={async (updates) => {
              const results = resultsToLegacyView(qcModalCertificate.results);

              updates.forEach(update => {
                const targetIdx = update.sensorId === 'unknown'
                  ? 0
                  : results.findIndex((r: any) => r.sensorId === update.sensorId || r.sensor_id === update.sensorId);
                
                if (targetIdx >= 0) {
                  results[targetIdx] = { ...results[targetIdx], table: update.table };
                }
              });

              try {
                // Gunakan updateCertificate dari hook (yg memakai PUT dengan full object)
                await updateCertificate(qcModalCertificate.id, {
                  ...qcModalCertificate,
                  results: results,
                  // Tandai bahwa user sudah "Hitung & Input Tabel ke Sertifikat".
                  // Flag ini yang dipakai halaman draft-view untuk unlock KIRIM KONSEP.
                  calibration_computed_at: new Date().toISOString(),
                } as any);
                showSuccess(`✅ Tabel hasil berhasil di-generate & disimpan ke sertifikat ${qcModalCertificate.no_certificate}!`);
              } catch (err) {
                console.error(err);
                showError('Gagal menyimpan tabel ke sertifikat');
              }
            }}
          />
        )
      }


      {/* LHKS Modal */}
      {
        lhksCertificate && (() => {
          const sessionResults = resultsToLegacyView(lhksCertificate.results)
          const firstResult = sessionResults[0]
          return (
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
            calibrationDate={firstResult?.startDate || lhksCertificate.issue_date}
            calibrationLocation={firstResult?.place || ''}
            environmentConditions={(() => {
              const envs = firstResult?.environment || [];
              const temp = envs.find((e: any) => e.key.toLowerCase().includes('suhu') || e.key.toLowerCase().includes('temp'))?.value;
              const hum = envs.find((e: any) => e.key.toLowerCase().includes('kelemba') || e.key.toLowerCase().includes('humidity') || e.key.toLowerCase().includes('rh'))?.value;
              return { temperature: temp || '-', humidity: hum || '-' };
            })()}
            sessionResults={sessionResults}
            allInstruments={instruments}
            allSensors={sensors}
            instrumentNames={instrumentNames}
          />
          )
        })()
      }

      {/* Uncertainty Modal */}
      {
        uncertaintyModalCertificate && (
          <UncertaintyModal
            isOpen={showUncertaintyModal}
            onClose={() => {
              setShowUncertaintyModal(false)
              setUncertaintyModalCertificate(null)
            }}
            certificate={uncertaintyModalCertificate}
            instruments={instruments}
            sensors={sensors}
            standardCerts={standardCerts}
            rawData={uncertaintyRawData}
            instrumentNames={instrumentNames}
          />
        )
      }
    </div >
  )
}


export default CertificatesCRUD
