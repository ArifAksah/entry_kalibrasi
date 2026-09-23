'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { formatLatexUnit } from '../../../lib/qc-utils'
import { Spinner } from '../../../components/ui/Loading'
import {
  filterMasterQcItemsByCode,
  filterInstrumentNamesByCode,
  findMasterQcByNameAndUnit,
  getInstrumentNameCodeId,
  paginateMasterQcItems,
} from '../../../lib/master-qc-options'

interface InstrumentCode {
  id: number
  code_alat: string | null
  name?: string | null
}

interface InstrumentName {
  id: number
  name: string
  code_alat?: string | null
  instrument_code_id?: number | null
  instrument_code?: InstrumentCode | null
}

interface RefUnit {
  id: number
  unit: string
}

interface MasterQCItem {
  id: number
  nilai_batas_koreksi: string
  catatan: string | null
  created_at: string
  updated_at: string
  unit_id?: number | null
  instrument_name: InstrumentName | null
  ref_unit: RefUnit | null
}

interface FormState {
  instrument_name_id: string
  unit_id: string
  nilai_batas_koreksi: string
  catatan: string
}

const defaultForm: FormState = {
  instrument_name_id: '',
  unit_id: '',
  nilai_batas_koreksi: '',
  catatan: '',
}

const SearchableDropdown = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  disabled = false,
}: {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: Array<{ id: string | number; name: string }>
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const selectedOption = options.find(
    (option) => String(option.id) === String(value),
  )
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-left disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption?.name || placeholder}
        </span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
          ▼
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  >
                    {option.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                  Tidak ada data ditemukan
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const MasterQCCRUD: React.FC = () => {
  usePermissions()
  const { alert, showSuccess, showError, hideAlert } = useAlert()

  const [items, setItems] = useState<MasterQCItem[]>([])
  const [instrumentCodes, setInstrumentCodes] = useState<InstrumentCode[]>([])
  const [instrumentNames, setInstrumentNames] = useState<InstrumentName[]>([])
  const [selectedInstrumentCodeId, setSelectedInstrumentCodeId] = useState<
    number | null
  >(null)
  const [units, setUnits] = useState<RefUnit[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterQCItem | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterInstrumentCodeId, setFilterInstrumentCodeId] = useState<
    number | null
  >(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [confirmDelete, setConfirmDelete] = useState<MasterQCItem | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/master-qc')
      if (!res.ok) throw new Error('Gagal mengambil data Master QC')
      const json = await res.json()
      setItems(Array.isArray(json?.data) ? json.data : [])
    } catch (e: any) {
      showError(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  const fetchInstrumentNames = async () => {
    try {
      const res = await fetch('/api/instrument-names')
      if (!res.ok) return
      const json = await res.json()
      setInstrumentNames(Array.isArray(json) ? json : [])
    } catch {
      /* silent */
    }
  }

  const fetchInstrumentCodes = async () => {
    try {
      const res = await fetch('/api/instrument-code')
      if (!res.ok) return
      const json = await res.json()
      setInstrumentCodes(Array.isArray(json) ? json : [])
    } catch {
      /* silent */
    }
  }

  const fetchUnits = async () => {
    try {
      const res = await fetch('/api/units')
      if (!res.ok) return
      const json = await res.json()
      setUnits(Array.isArray(json) ? json : [])
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    fetchItems()
    fetchInstrumentCodes()
    fetchInstrumentNames()
    fetchUnits()
  }, [])

  const openModal = (item?: MasterQCItem) => {
    if (item) {
      setEditingItem(item)
      setSelectedInstrumentCodeId(
        getInstrumentNameCodeId(item.instrument_name),
      )
      setForm({
        instrument_name_id: String(item.instrument_name?.id ?? ''),
        unit_id: String(item.ref_unit?.id ?? ''),
        nilai_batas_koreksi: item.nilai_batas_koreksi,
        catatan: item.catatan ?? '',
      })
    } else {
      setEditingItem(null)
      setSelectedInstrumentCodeId(null)
      setForm(defaultForm)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setSelectedInstrumentCodeId(null)
    setForm(defaultForm)
  }

  const filteredInstrumentNames = useMemo(
    () =>
      filterInstrumentNamesByCode(
        instrumentNames,
        selectedInstrumentCodeId,
      ),
    [instrumentNames, selectedInstrumentCodeId],
  )

  const handleInstrumentCodeChange = (value: string | number | null) => {
    const codeId = value == null || value === '' ? null : Number(value)
    setSelectedInstrumentCodeId(
      codeId !== null && Number.isFinite(codeId) ? codeId : null,
    )
    setEditingItem(null)
    setForm((prev) => ({ ...prev, instrument_name_id: '' }))
  }

  const handleUnitChange = (value: string | number | null) => {
    const unitId = value == null || value === '' ? null : Number(value)
    const instrumentNameId = Number(form.instrument_name_id)
    const existing = findMasterQcByNameAndUnit(
      items,
      Number.isFinite(instrumentNameId) && instrumentNameId > 0
        ? instrumentNameId
        : null,
      unitId !== null && Number.isFinite(unitId) ? unitId : null,
    )

    if (existing) {
      setEditingItem(existing)
      setForm({
        instrument_name_id: String(existing.instrument_name?.id ?? ''),
        unit_id: String(existing.ref_unit?.id ?? existing.unit_id ?? ''),
        nilai_batas_koreksi: existing.nilai_batas_koreksi,
        catatan: existing.catatan ?? '',
      })
      return
    }

    setForm((prev) => ({ ...prev, unit_id: value ? String(value) : '' }))
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !selectedInstrumentCodeId ||
      !form.instrument_name_id ||
      !form.unit_id ||
      !form.nilai_batas_koreksi.trim()
    )
      return

    const selectedName = instrumentNames.find(
      (name) => String(name.id) === form.instrument_name_id,
    )
    if (getInstrumentNameCodeId(selectedName) !== selectedInstrumentCodeId) {
      showError('Nama instrumen tidak sesuai dengan kode instrumen yang dipilih.')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        instrument_name_id: Number(form.instrument_name_id),
        unit_id: Number(form.unit_id),
        nilai_batas_koreksi: form.nilai_batas_koreksi.trim(),
        catatan: form.catatan.trim() || null,
      }

      const url = editingItem
        ? `/api/master-qc/${editingItem.id}`
        : '/api/master-qc'
      const method = editingItem ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal menyimpan data')
      }
      showSuccess(
        editingItem
          ? 'Data Master QC berhasil diupdate'
          : 'Data Master QC berhasil ditambahkan',
      )
      closeModal()
      fetchItems()
    } catch (e: any) {
      showError(e.message || 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (item: MasterQCItem) => {
    setConfirmDelete(item)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    const item = confirmDelete
    try {
      const res = await fetch(`/api/master-qc/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menghapus data')
      }
      showSuccess('Data Master QC berhasil dihapus')
      setConfirmDelete(null)
      fetchItems()
    } catch (e: any) {
      showError(e.message || 'Gagal menghapus data')
    }
  }

  const filtered = useMemo(() => {
    const byCode = filterMasterQcItemsByCode(items, filterInstrumentCodeId)
    const q = search.trim().toLowerCase()
    if (!q) return byCode

    return byCode.filter(
      (item) =>
        item.instrument_name?.name?.toLowerCase().includes(q) ||
        item.instrument_name?.instrument_code?.code_alat
          ?.toLowerCase()
          .includes(q) ||
        item.nilai_batas_koreksi?.toLowerCase().includes(q) ||
        item.ref_unit?.unit?.toLowerCase().includes(q) ||
        (item.catatan ?? '').toLowerCase().includes(q),
    )
  }, [items, filterInstrumentCodeId, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedItems = useMemo(
    () => paginateMasterQcItems(filtered, currentPage, pageSize),
    [filtered, currentPage],
  )
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, filtered.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterInstrumentCodeId])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  return (
    <div className="space-y-6">
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          Master QC — Nilai Batas Koreksi
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={filterInstrumentCodeId ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setFilterInstrumentCodeId(value ? Number(value) : null)
            }}
            className="min-w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter kode instrumen"
          >
            <option value="">Semua Kode Instrumen</option>
            {instrumentCodes.map((code) => (
              <option key={code.id} value={code.id}>
                {code.code_alat || `Kode #${code.id}`}
                {code.name ? ` — ${code.name}` : ''}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nilai, satuan..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
          />
          <button
            onClick={() => openModal()}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Tambah Baru
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" tone="blue" className="border-blue-600" />
            <span className="ml-3 text-gray-500">Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="font-medium">Belum ada data Master QC</p>
            <p className="text-sm mt-1">
              Klik &quot;Tambah Baru&quot; untuk menambahkan data pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kode Instrumen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Instrumen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Satuan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nilai Batas Koreksi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catatan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {' '}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {item.instrument_name?.instrument_code?.code_alat ??
                          '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {' '}
                      <span className="text-sm font-medium text-gray-900">
                        {item.instrument_name?.name ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {' '}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatLatexUnit(item.ref_unit?.unit ?? '-')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {' '}
                      <span className="text-sm font-semibold text-indigo-700">
                        {item.nilai_batas_koreksi}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {' '}
                      {item.catatan ?? (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                      {' '}
                      <button
                        onClick={() => openModal(item)}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium"
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors text-xs font-medium"
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Menampilkan <span className="font-medium">{pageStart}</span>-
                <span className="font-medium">{pageEnd}</span> dari{' '}
                <span className="font-medium">{filtered.length}</span> data
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Awal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span className="min-w-24 text-center text-sm text-gray-600">
                  Halaman <span className="font-medium">{currentPage}</span> /{' '}
                  <span className="font-medium">{totalPages}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Berikutnya
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Akhir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 rounded-t-xl flex items-center justify-between sticky top-0">
              <h3 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Data Master QC' : 'Tambah Data Master QC'}
              </h3>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Kode Instrumen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kode Instrumen <span className="text-red-500">*</span>
                </label>
                <SearchableDropdown
                  value={selectedInstrumentCodeId}
                  onChange={handleInstrumentCodeChange}
                  options={instrumentCodes.map((code) => ({
                    id: code.id,
                    name: code.name
                      ? `${code.code_alat || '-'} — ${code.name}`
                      : code.code_alat || `Kode #${code.id}`,
                  }))}
                  placeholder="Pilih Kode Instrumen"
                  searchPlaceholder="Cari kode instrumen..."
                  disabled={Boolean(editingItem)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Pilihan kode menentukan daftar nama instrumen di bawah.
                </p>
              </div>

              {/* Nama Instrumen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Instrumen <span className="text-red-500">*</span>
                </label>
                <SearchableDropdown
                  value={form.instrument_name_id}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      instrument_name_id: val ? String(val) : '',
                    }))
                  }
                  options={filteredInstrumentNames.map((n) => ({
                    id: n.id,
                    name: n.name,
                  }))}
                  disabled={!selectedInstrumentCodeId || Boolean(editingItem)}
                  placeholder={
                    selectedInstrumentCodeId
                      ? 'Pilih Nama Instrumen'
                      : 'Pilih kode instrumen terlebih dahulu'
                  }
                  searchPlaceholder="Cari nama instrumen..."
                />
                {selectedInstrumentCodeId &&
                  filteredInstrumentNames.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Belum ada nama instrumen untuk kode ini. Tambahkan melalui
                      menu Master Instrumen.
                    </p>
                  )}
              </div>

              {/* Satuan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Satuan (Unit) <span className="text-red-500">*</span>
                </label>
                <SearchableDropdown
                  value={form.unit_id}
                  onChange={handleUnitChange}
                  options={units.map((u) => ({
                    id: u.id,
                    name: formatLatexUnit(u.unit),
                  }))}
                  placeholder="Pilih Satuan"
                  searchPlaceholder="Cari satuan..."
                  disabled={Boolean(editingItem)}
                />
                {editingItem &&
                  String(editingItem.instrument_name?.id) ===
                    form.instrument_name_id &&
                  String(editingItem.ref_unit?.id ?? editingItem.unit_id) ===
                    form.unit_id && (
                    <p className="text-xs text-blue-600 mt-1">
                      Master QC untuk nama instrumen dan satuan ini sudah ada.
                      Form beralih ke mode edit nilai yang tersedia.
                    </p>
                  )}
              </div>

              {/* Nilai Batas Koreksi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nilai Batas Koreksi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nilai_batas_koreksi"
                  value={form.nilai_batas_koreksi}
                  onChange={handleChange}
                  required
                  placeholder="Contoh: ± 0.3"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Masukkan nilai numerik, satuan dipilih terpisah di atas
                </p>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan{' '}
                  <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  name="catatan"
                  value={form.catatan}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Keterangan tambahan jika ada..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-yellow-50 rounded-full">
                <svg
                  className="w-6 h-6 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Konfirmasi Hapus
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Hapus data &quot;
              {confirmDelete.instrument_name?.name ?? `ID ${confirmDelete.id}`}
              &quot;? Data yang sudah dihapus tidak bisa dipulihkan.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDelete(null)}
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
    </div>
  )
}

export default MasterQCCRUD
