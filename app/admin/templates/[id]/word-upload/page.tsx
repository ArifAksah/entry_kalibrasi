'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { RichTextTemplateRecord } from '@/lib/rich-text-editor/types'

interface UploadState {
  status: 'empty' | 'uploading' | 'uploaded' | 'error'
  html: string | null
  fileName: string | null
  warnings: string[]
  detectedTags: string[]
  errorMessage: string | null
  /** Path returned by the Python PDF Template Service after upload */
  templatePath: string | null
  /** Variables detected by the Python service */
  detectedVariables: string[]
  /** Loops detected by the Python service */
  detectedLoops: string[]
}

interface RepeatingHeaderFooterState {
  repeatingHeader: string
  repeatingFooter: string
  headerExpanded: boolean
  footerExpanded: boolean
}

const INITIAL_STATE: UploadState = {
  status: 'empty',
  html: null,
  fileName: null,
  warnings: [],
  detectedTags: [],
  errorMessage: null,
  templatePath: null,
  detectedVariables: [],
  detectedLoops: [],
}

// Variable tags grouped by category for the sidebar
const TAG_CATEGORIES = [
  {
    label: 'Data Instrumen',
    category: 'instrument',
    tags: [
      { tag: '${nama_alat}', desc: 'Nama alat yang dikalibrasi' },
      { tag: '${merk}', desc: 'Merk/pabrikan alat' },
      { tag: '${tipe}', desc: 'Tipe/model alat' },
      { tag: '${no_seri}', desc: 'Nomor seri alat' },
      { tag: '${kapasitas}', desc: 'Kapasitas alat' },
      { tag: '${resolusi}', desc: 'Resolusi alat' },
      { tag: '${unit}', desc: 'Satuan pengukuran (hPa, °C, %, dll)' },
      { tag: '${lain_lain}', desc: 'Info lain-lain (daftar sensor, dll)' },
    ],
  },
  {
    label: 'Data Kalibrasi',
    category: 'calibration',
    tags: [
      { tag: '${nomor_sertifikat}', desc: 'Nomor sertifikat kalibrasi' },
      { tag: '${no_order}', desc: 'Nomor order kalibrasi' },
      { tag: '${tanggal_masuk}', desc: 'Tanggal masuk alat ke lab' },
      { tag: '${tanggal_kalibrasi}', desc: 'Tanggal pelaksanaan kalibrasi' },
      { tag: '${tanggal_terbit}', desc: 'Tanggal terbit sertifikat' },
      { tag: '${metode_kalibrasi}', desc: 'Metode kalibrasi yang digunakan' },
      { tag: '${suhu}', desc: 'Suhu ruangan saat kalibrasi' },
      { tag: '${kelembaban}', desc: 'Kelembaban ruangan saat kalibrasi' },
      { tag: '${tempat_kalibrasi}', desc: 'Tempat pelaksanaan kalibrasi' },
      { tag: '${standar_kalibrasi}', desc: 'Standar kalibrasi yang digunakan' },
      { tag: '${ketertelusuran}', desc: 'Ketertelusuran ke SI melalui' },
      { tag: '${dokumen_acuan}', desc: 'Dokumen acuan (ISO/IEC 17025)' },
      { tag: '${catatan}', desc: 'Catatan/komentar hasil kalibrasi' },
    ],
  },
  {
    label: 'Data Stasiun',
    category: 'station',
    tags: [
      { tag: '${nama_stasiun}', desc: 'Nama stasiun pemilik alat' },
      { tag: '${alamat_stasiun}', desc: 'Alamat stasiun pemilik alat' },
      { tag: '${nama_pemilik}', desc: 'Nama pemilik/designation' },
    ],
  },
  {
    label: 'Personel',
    category: 'personnel',
    tags: [
      { tag: '${nama_penandatangan}', desc: 'Nama pejabat penandatangan' },
      { tag: '${nip_penandatangan}', desc: 'NIP pejabat penandatangan' },
      { tag: '${jabatan_penandatangan}', desc: 'Jabatan pejabat penandatangan' },
      { tag: '${nama_teknisi}', desc: 'Nama teknisi pelaksana' },
      { tag: '${nip_teknisi}', desc: 'NIP teknisi pelaksana' },
      { tag: '${nama_verifikator}', desc: 'Nama verifikator/pemeriksa' },
    ],
  },
  {
    label: 'Hasil Kalibrasi (Loop)',
    category: 'results',
    tags: [
      { tag: '${#each sensors}', desc: 'Awal loop per sensor' },
      { tag: '${sensor_nama}', desc: 'Nama sensor' },
      { tag: '${sensor_merk}', desc: 'Merk sensor' },
      { tag: '${sensor_tipe}', desc: 'Tipe sensor' },
      { tag: '${sensor_no_seri}', desc: 'No. seri sensor' },
      { tag: '${#each hasil_kalibrasi}', desc: 'Awal loop baris hasil' },
      { tag: '${no_urut}', desc: 'Nomor urut (otomatis)' },
      { tag: '${titik_ukur}', desc: 'Titik ukur / pembacaan alat' },
      { tag: '${pembacaan}', desc: 'Pembacaan standar' },
      { tag: '${koreksi}', desc: 'Nilai koreksi' },
      { tag: '${ketidakpastian}', desc: 'Ketidakpastian pengukuran' },
      { tag: '${/each}', desc: 'Akhir loop' },
    ],
  },
  {
    label: 'Sistem (QR & Formulir)',
    category: 'system',
    tags: [
      { tag: '${qr_code}', desc: 'QR Code verifikasi (gambar)' },
      { tag: '${verification_url}', desc: 'URL verifikasi sertifikat' },
      { tag: '${halaman}', desc: 'Nomor halaman saat ini' },
      { tag: '${jumlah_halaman}', desc: 'Total jumlah halaman' },
      { tag: '${kode_formulir}', desc: 'Kode formulir (F/IKK 7.8.1)' },
      { tag: '${edisi_revisi}', desc: 'Edisi/Revisi (contoh: 11/1)' },
    ],
  },
]


// ─── Upload Zone Component ───────────────────────────────────────────────────

interface UploadZoneProps {
  label: string
  description: string
  state: UploadState
  onStateChange: (state: UploadState) => void
  showPreview: boolean
  onTogglePreview: () => void
  templateId: string
  section: 'cover' | 'results'
}

function UploadZone({ label, description, state, onStateChange, showPreview, onTogglePreview, templateId, section }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Fetch preview image via JS (with auth header) instead of <img src="...">
  useEffect(() => {
    if (!showPreview || !state.templatePath) {
      // Reset preview state when hidden or no template
      setPreviewBlobUrl(null)
      setPreviewError(null)
      return
    }

    let cancelled = false
    let retryCount = 0
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 2000

    const fetchPreview = async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      // Revoke old blob URL before fetching new one
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl)
        setPreviewBlobUrl(null)
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setPreviewError('Sesi login tidak ditemukan')
          setPreviewLoading(false)
          return
        }

        const url = `/api/admin/templates/preview-from-service?template_id=${encodeURIComponent(templateId)}&section=${encodeURIComponent(section)}`
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })

        if (cancelled) return

        if (!res.ok) {
          if (res.status === 503 && retryCount < MAX_RETRIES) {
            retryCount++
            console.log(`[Preview] Retry ${retryCount}/${MAX_RETRIES} after 503 (service starting)...`)
            setTimeout(() => {
              if (!cancelled) fetchPreview()
            }, RETRY_DELAY_MS)
            return
          }

          if (res.status === 503) {
            setPreviewError('Service template tidak tersedia. Pastikan service Python berjalan.')
          } else if (res.status === 404) {
            setPreviewError('File template tidak ditemukan di service. Upload ulang file .docx untuk melihat preview.')
          } else {
            const errorData = await res.json().catch(() => ({}))
            setPreviewError(errorData.error || `Gagal memuat preview (HTTP ${res.status})`)
          }
          setPreviewLoading(false)
          return
        }

        const blob = await res.blob()
        if (!cancelled) {
          const blobUrl = URL.createObjectURL(blob)
          setPreviewBlobUrl(blobUrl)
          setPreviewLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError('Preview tidak tersedia. Service mungkin belum berjalan.')
          setPreviewLoading(false)
        }
      }
    }

    fetchPreview()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, state.templatePath, templateId, section])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBlobUrl])

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      onStateChange({
        ...INITIAL_STATE,
        status: 'error',
        errorMessage: 'Format file tidak didukung. Gunakan file .docx',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      onStateChange({
        ...INITIAL_STATE,
        status: 'error',
        errorMessage: 'Ukuran file melebihi 10MB',
      })
      return
    }

    onStateChange({ ...state, status: 'uploading', errorMessage: null })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        onStateChange({
          ...INITIAL_STATE,
          status: 'error',
          errorMessage: 'Sesi login tidak ditemukan',
        })
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('template_id', templateId)
      formData.append('section', section)

      const res = await fetch('/api/admin/templates/upload-to-service', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        const errorMsg = res.status === 503
          ? 'Service template tidak tersedia. Pastikan service Python berjalan.'
          : data.error || 'Gagal mengupload template'
        onStateChange({
          ...INITIAL_STATE,
          status: 'error',
          errorMessage: errorMsg,
        })
        return
      }

      const data = await res.json()
      onStateChange({
        status: 'uploaded',
        html: null,
        fileName: file.name,
        warnings: [],
        detectedTags: [...(data.variables || []), ...(data.loops || []).map((l: string) => `loop: ${l}`)],
        errorMessage: null,
        templatePath: data.path || null,
        detectedVariables: data.variables || [],
        detectedLoops: data.loops || [],
      })
    } catch {
      onStateChange({
        ...INITIAL_STATE,
        status: 'error',
        errorMessage: 'Service template tidak tersedia. Pastikan service Python berjalan.',
      })
    }
  }, [state, onStateChange, templateId, section])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleUpload])

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {state.status === 'uploaded' && (
          <button
            onClick={() => onStateChange(INITIAL_STATE)}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Hapus
          </button>
        )}
      </div>

      {state.status === 'empty' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="mt-3 text-sm text-gray-600">
            Drag & drop file .docx atau <span className="text-blue-600 font-medium">klik untuk pilih</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">Maksimal 10MB &middot; Format: .docx</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {state.status === 'uploading' && (
        <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-10 text-center">
          <div className="animate-spin mx-auto h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-3 text-sm text-blue-600">Mengupload template ke service...</p>
        </div>
      )}

      {state.status === 'error' && (
        <div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-sm text-red-700">{state.errorMessage}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Coba lagi
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {state.status === 'uploaded' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-700 font-medium">{state.fileName}</span>
          </div>

          {/* Warnings */}
          {state.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
              <p className="text-xs font-medium text-yellow-800 mb-1">Peringatan:</p>
              <ul className="text-xs text-yellow-700 list-disc list-inside">
                {state.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {state.warnings.length > 5 && (
                  <li>...dan {state.warnings.length - 5} peringatan lainnya</li>
                )}
              </ul>
            </div>
          )}

          {/* Detected variables from Python service */}
          {state.detectedVariables.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1">Variabel terdeteksi:</p>
              <div className="flex flex-wrap gap-1">
                {state.detectedVariables.map((v, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-mono">
                    {`{{ ${v} }}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detected loops from Python service */}
          {state.detectedLoops.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1">Loop terdeteksi:</p>
              <div className="flex flex-wrap gap-1">
                {state.detectedLoops.map((l, i) => (
                  <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 font-mono">
                    {`{% for ... in ${l} %}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Template path info */}
          {state.templatePath && (
            <div className="mb-3">
              <p className="text-xs text-gray-500">
                Path: <code className="bg-gray-100 px-1 rounded">{state.templatePath}</code>
              </p>
            </div>
          )}

          {/* Preview toggle - PNG image from Python service */}
          <button
            onClick={onTogglePreview}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showPreview ? 'Sembunyikan Preview' : 'Lihat Preview Template'}
          </button>

          {showPreview && state.templatePath && (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
              {previewLoading && (
                <div className="p-6 text-center">
                  <div className="animate-spin mx-auto h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <p className="mt-2 text-xs text-gray-500">Memuat preview...</p>
                </div>
              )}
              {previewError && !previewLoading && (
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-2">{previewError}</p>
                  <button
                    onClick={() => {
                      // Force re-fetch by toggling templatePath dependency
                      setPreviewError(null)
                      setPreviewBlobUrl(null)
                      // Trigger useEffect by briefly clearing and restoring
                      const currentPath = state.templatePath
                      onStateChange({ ...state, templatePath: null })
                      setTimeout(() => onStateChange({ ...state, templatePath: currentPath }), 100)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ↻ Coba lagi
                  </button>
                </div>
              )}
              {previewBlobUrl && !previewLoading && (
                <img
                  src={previewBlobUrl}
                  alt={`Preview ${section} template`}
                  className="w-full max-h-[600px] object-contain bg-white"
                />
              )}
            </div>
          )}

          {/* Re-upload */}
          <div className="mt-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Upload ulang
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Main Page Component ─────────────────────────────────────────────────────

export default function WordUploadPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [template, setTemplate] = useState<RichTextTemplateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [coverState, setCoverState] = useState<UploadState>(INITIAL_STATE)
  const [resultsState, setResultsState] = useState<UploadState>(INITIAL_STATE)
  const [showCoverPreview, setShowCoverPreview] = useState(false)
  const [showResultsPreview, setShowResultsPreview] = useState(false)
  const [headerFooter, setHeaderFooter] = useState<RepeatingHeaderFooterState>({
    repeatingHeader: '',
    repeatingFooter: '',
    headerExpanded: false,
    footerExpanded: false,
  })

  // Fetch template data
  useEffect(() => {
    async function fetchTemplate() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Sesi login tidak ditemukan. Silakan login ulang.')
          setLoading(false)
          return
        }

        const res = await fetch(`/api/admin/templates/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Gagal mengambil template')
          setLoading(false)
          return
        }

        const data = await res.json()
        setTemplate(data)

        // Pre-populate cover if template already has cover_template_path or cover_html saved
        if (data.cover_template_path) {
          setCoverState({
            status: 'uploaded',
            html: data.cover_html || null,
            fileName: 'cover-template.docx (tersimpan)',
            warnings: [],
            detectedTags: [],
            errorMessage: null,
            templatePath: data.cover_template_path,
            detectedVariables: [],
            detectedLoops: [],
          })
        } else if (data.cover_html) {
          setCoverState({
            status: 'uploaded',
            html: data.cover_html,
            fileName: 'cover-template.docx (tersimpan)',
            warnings: [],
            detectedTags: [],
            errorMessage: null,
            templatePath: null,
            detectedVariables: [],
            detectedLoops: [],
          })
        }

        // Pre-populate results if template already has results_template_path or results_html saved
        if (data.results_template_path) {
          setResultsState({
            status: 'uploaded',
            html: data.results_html || null,
            fileName: 'results-template.docx (tersimpan)',
            warnings: [],
            detectedTags: [],
            errorMessage: null,
            templatePath: data.results_template_path,
            detectedVariables: [],
            detectedLoops: [],
          })
        } else if (data.results_html) {
          setResultsState({
            status: 'uploaded',
            html: data.results_html,
            fileName: 'results-template.docx (tersimpan)',
            warnings: [],
            detectedTags: [],
            errorMessage: null,
            templatePath: null,
            detectedVariables: [],
            detectedLoops: [],
          })
        }

        // Pre-populate repeating header/footer
        setHeaderFooter({
          repeatingHeader: data.repeating_header || '',
          repeatingFooter: data.repeating_footer || '',
          headerExpanded: !!data.repeating_header,
          footerExpanded: !!data.repeating_footer,
        })
      } catch {
        setError('Gagal mengambil template. Periksa koneksi internet.')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplate()
  }, [id])

  // Save template paths and optionally HTML
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Sesi login tidak ditemukan. Silakan login ulang.')
        setSaving(false)
        return
      }

      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cover_html: coverState.html,
          results_html: resultsState.html || null,
          end_html: null,
          repeating_header: headerFooter.repeatingHeader || null,
          repeating_footer: headerFooter.repeatingFooter || null,
          cover_template_path: coverState.templatePath || null,
          results_template_path: resultsState.templatePath || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Gagal menyimpan template')
        setSaving(false)
        return
      }

      const savedData = await res.json()
      setSaveSuccess(true)
      setError(null)
      setTemplate(savedData)
      // Redirect ke daftar template setelah 1.5 detik
      setTimeout(() => {
        router.push('/admin/templates')
      }, 1500)
    } catch {
      setError('Gagal menyimpan template. Periksa koneksi internet.')
    } finally {
      setSaving(false)
    }
  }, [id, coverState.html, coverState.templatePath, resultsState.html, resultsState.templatePath, headerFooter.repeatingHeader, headerFooter.repeatingFooter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Memuat...</div>
      </div>
    )
  }

  if (error && !template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-md">
          {error}
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Template tidak ditemukan</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/admin/templates')}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Daftar
            </button>
            <h1 className="text-xl font-bold text-gray-900">Upload Template Word</h1>
            <p className="text-sm text-gray-500 mt-1">
              {template.name} &middot; {template.certificate_type} &middot; Versi {template.version}
            </p>
          </div>

          {/* Download Template Links */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <a
              href="/templates/fc-cover-template-v2.docx"
              download
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <span>📄</span>
              <span>Download Template Cover</span>
            </a>
            <a
              href="/templates/fc-results-template-v2.docx"
              download
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <span>📄</span>
              <span>Download Template Hasil</span>
            </a>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Petunjuk</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Upload 2 file Word terpisah:</li>
              <li className="ml-4">1. <strong>Template Cover</strong> — halaman pertama (header, judul, data alat/pemilik/pengesahan)</li>
              <li className="ml-4">2. <strong>Template Hasil</strong> — halaman per sensor (header kecil, data sensor, tabel hasil, catatan)</li>
              <li>Template Hasil akan di-loop untuk setiap sensor yang dikalibrasi</li>
              <li>Gunakan tag <code className="bg-blue-100 px-1 rounded">${'${variabel}'}</code> untuk data yang akan diisi otomatis</li>
            </ul>
          </div>

          {/* Guide Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Panduan Membuat Template:</h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Download contoh template di atas</li>
              <li>Edit layout sesuai kebutuhan (font, tabel, border, logo)</li>
              <li>Pastikan tag <code className="bg-gray-100 px-1 rounded">${'${variabel}'}</code> tetap utuh (jangan edit isi tag)</li>
              <li>Simpan sebagai .docx dan upload di zona yang sesuai</li>
              <li>Jika hanya upload Cover (tanpa Hasil), sistem akan menggunakan mode 1-file</li>
            </ol>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
            </div>
          )}

          {/* Success message */}
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4 text-sm">
              Template berhasil disimpan!
            </div>
          )}

          {/* Zone 1: Template Cover */}
          <div className="mb-4">
            <UploadZone
              label="Template Cover (Halaman 1)"
              description="Halaman pertama sertifikat: header BMKG, judul, data alat, data pemilik, pengesahan, footer BSrE"
              state={coverState}
              onStateChange={setCoverState}
              showPreview={showCoverPreview}
              onTogglePreview={() => setShowCoverPreview(!showCoverPreview)}
              templateId={id}
              section="cover"
            />
          </div>

          {/* Zone 2: Template Hasil per Sensor */}
          <div className="mb-4">
            <UploadZone
              label="Template Hasil per Sensor (Halaman 2+)"
              description="Halaman hasil kalibrasi: header dengan nomor sertifikat, data sensor, tabel hasil, catatan. Di-loop untuk setiap sensor."
              state={resultsState}
              onStateChange={setResultsState}
              showPreview={showResultsPreview}
              onTogglePreview={() => setShowResultsPreview(!showResultsPreview)}
              templateId={id}
              section="results"
            />
          </div>

          {/* Repeating Header Section */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <button
              type="button"
              onClick={() => setHeaderFooter(prev => ({ ...prev, headerExpanded: !prev.headerExpanded }))}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Header Berulang (opsional)</h3>
                <p className="text-xs text-gray-500 mt-0.5">HTML yang muncul di atas setiap halaman PDF. Gunakan tag {'${variabel}'} untuk data dinamis.</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${headerFooter.headerExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {headerFooter.headerExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <textarea
                  value={headerFooter.repeatingHeader}
                  onChange={(e) => setHeaderFooter(prev => ({ ...prev, repeatingHeader: e.target.value }))}
                  placeholder='<div style="text-align: center; font-size: 9pt; border-bottom: 1px solid #000; padding-bottom: 4px;">BMKG - Laboratorium Kalibrasi | No. ${nomor_sertifikat}</div>'
                  rows={4}
                  className="mt-3 w-full text-xs font-mono border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                />
                {headerFooter.repeatingHeader && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Preview:</p>
                    <div
                      className="border border-gray-200 rounded p-2 bg-gray-50 text-xs"
                      dangerouslySetInnerHTML={{ __html: headerFooter.repeatingHeader }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Repeating Footer Section */}
          <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <button
              type="button"
              onClick={() => setHeaderFooter(prev => ({ ...prev, footerExpanded: !prev.footerExpanded }))}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Footer Berulang (opsional)</h3>
                <p className="text-xs text-gray-500 mt-0.5">{"HTML yang muncul di bawah setiap halaman PDF. Gunakan <span class='pageNumber'></span> untuk nomor halaman."}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${headerFooter.footerExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {headerFooter.footerExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <textarea
                  value={headerFooter.repeatingFooter}
                  onChange={(e) => setHeaderFooter(prev => ({ ...prev, repeatingFooter: e.target.value }))}
                  placeholder='<div style="text-align: center; font-size: 8pt; color: #666;">FM-KL-01 | Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>'
                  rows={4}
                  className="mt-3 w-full text-xs font-mono border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                />
                {headerFooter.repeatingFooter && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Preview:</p>
                    <div
                      className="border border-gray-200 rounded p-2 bg-gray-50 text-xs"
                      dangerouslySetInnerHTML={{ __html: headerFooter.repeatingFooter }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => router.push('/admin/templates')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!coverState.html && !coverState.templatePath && !resultsState.html && !resultsState.templatePath)}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar - Variable Tags */}
      <div className="w-72 border-l border-gray-200 bg-gray-50 overflow-auto p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Tag Variabel</h2>
        <p className="text-xs text-gray-500 mb-4">
          Gunakan tag berikut di file Word Anda. Tag akan diganti dengan data sertifikat saat generate PDF.
        </p>
        <div className="space-y-4">
          {TAG_CATEGORIES.map((cat) => (
            <div key={cat.category}>
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                {cat.label}
              </h3>
              <div className="space-y-1">
                {cat.tags.map((t) => (
                  <div key={t.tag} className="group">
                    <code className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-blue-700 font-mono block">
                      {t.tag}
                    </code>
                    <p className="text-xs text-gray-500 mt-0.5 ml-1">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
