'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Loading'
import {
  filterCmcProfiles,
  getPrimaryCmcValue,
  paginateCmcProfiles,
} from '../../../lib/master-cmc-options'

type CmcValue = {
  id?: number
  range_min: number | null
  range_max: number | null
  cmc_value: number
  unit: string
  sequence: number
}

type CmcProfile = {
  id: number
  code: string
  name: string
  parameter_code: string
  calibration_method: string | null
  source_document: string | null
  version: number
  effective_from: string
  effective_until: string | null
  is_active: boolean
  cmc_values: CmcValue[]
}

type CmcForm = {
  code: string
  name: string
  parameter_code: string
  calibration_method: string
  source_document: string
  version: number
  effective_from: string
  effective_until: string
  is_active: boolean
  value_id?: number
  range_min: string
  range_max: string
  cmc_value: string
  unit: string
}

const createEmptyForm = (): CmcForm => ({
  code: '',
  name: '',
  parameter_code: '',
  calibration_method: '',
  source_document: '',
  version: 1,
  effective_from: new Date().toISOString().slice(0, 10),
  effective_until: '',
  is_active: true,
  range_min: '',
  range_max: '',
  cmc_value: '',
  unit: '',
})

const MasterCmcCRUD: React.FC = () => {
  const { role } = usePermissions()
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [items, setItems] = useState<CmcProfile[]>([])
  const [form, setForm] = useState<CmcForm>(createEmptyForm)
  const [editingItem, setEditingItem] = useState<CmcProfile | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<CmcProfile | null>(null)
  const [search, setSearch] = useState('')
  const [parameterFilter, setParameterFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const canMutate = role === 'admin'

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cmc')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat CMC')
      setItems(Array.isArray(payload.data) ? payload.data : [])
    } catch (error: any) {
      showError(error.message || 'Gagal memuat CMC')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const parameters = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.parameter_code))).sort(),
    [items],
  )
  const filtered = useMemo(
    () => filterCmcProfiles(items, search, parameterFilter, statusFilter),
    [items, search, parameterFilter, statusFilter],
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedItems = useMemo(
    () => paginateCmcProfiles(filtered, currentPage, pageSize),
    [filtered, currentPage],
  )
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, filtered.length)

  useEffect(() => setCurrentPage(1), [search, parameterFilter, statusFilter])
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setForm(createEmptyForm())
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setForm(createEmptyForm())
    setIsModalOpen(true)
  }

  const openEditModal = (item: CmcProfile) => {
    const value = getPrimaryCmcValue(item.cmc_values)
    setEditingItem(item)
    setForm({
      code: item.code,
      name: item.name,
      parameter_code: item.parameter_code,
      calibration_method: item.calibration_method || '',
      source_document: item.source_document || '',
      version: item.version,
      effective_from: item.effective_from,
      effective_until: item.effective_until || '',
      is_active: item.is_active,
      value_id: value?.id,
      range_min: value?.range_min == null ? '' : String(value.range_min),
      range_max: value?.range_max == null ? '' : String(value.range_max),
      cmc_value: value?.cmc_value == null ? '' : String(value.cmc_value),
      unit: value?.unit || '',
    })
    setIsModalOpen(true)
  }

  const updateForm = (key: keyof CmcForm, value: string | number | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canMutate) return

    const cmcValue = Number(form.cmc_value)
    const rangeMin = form.range_min === '' ? null : Number(form.range_min)
    const rangeMax = form.range_max === '' ? null : Number(form.range_max)
    if (!form.code.trim() || !form.name.trim() || !form.parameter_code.trim() || !form.unit.trim()) {
      showError('Kode, nama, parameter, nilai CMC, dan satuan wajib diisi.')
      return
    }
    if (!Number.isFinite(cmcValue) || cmcValue < 0) {
      showError('Nilai CMC harus berupa angka nol atau lebih besar.')
      return
    }
    if ((rangeMin !== null && !Number.isFinite(rangeMin)) || (rangeMax !== null && !Number.isFinite(rangeMax))) {
      showError('Rentang harus berupa angka yang valid.')
      return
    }
    if (rangeMin !== null && rangeMax !== null && rangeMin > rangeMax) {
      showError('Rentang awal tidak boleh lebih besar dari rentang akhir.')
      return
    }
    if (form.effective_until && form.effective_until < form.effective_from) {
      showError('Tanggal berlaku sampai tidak boleh sebelum tanggal mulai.')
      return
    }

    setIsSubmitting(true)
    try {
      const valuePayload = {
        ...(form.value_id ? { id: form.value_id } : {}),
        range_min: rangeMin,
        range_max: rangeMax,
        cmc_value: cmcValue,
        unit: form.unit.trim(),
        sequence: 1,
      }
      const body = editingItem
        ? {
            name: form.name.trim(),
            calibration_method: form.calibration_method.trim() || null,
            source_document: form.source_document.trim() || null,
            effective_from: form.effective_from,
            effective_until: form.effective_until || null,
            is_active: form.is_active,
            values: [valuePayload],
          }
        : {
            code: form.code.trim(),
            name: form.name.trim(),
            parameter_code: form.parameter_code.trim().toUpperCase(),
            calibration_method: form.calibration_method.trim() || null,
            source_document: form.source_document.trim() || null,
            version: form.version,
            effective_from: form.effective_from,
            effective_until: form.effective_until || null,
            is_active: form.is_active,
            ...valuePayload,
          }
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(editingItem ? `/api/cmc/${editingItem.id}` : '/api/cmc', {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan CMC')
      showSuccess(editingItem ? 'Profil CMC berhasil diperbarui' : 'Profil CMC berhasil ditambahkan')
      closeModal()
      await load()
    } catch (error: any) {
      showError(error.message || 'Gagal menyimpan CMC')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deactivate = async () => {
    if (!confirmDeactivate || !canMutate) return
    setDeactivatingId(confirmDeactivate.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`/api/cmc/${confirmDeactivate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Gagal menonaktifkan CMC')
      showSuccess('Profil CMC berhasil dinonaktifkan')
      setConfirmDeactivate(null)
      await load()
    } catch (error: any) {
      showError(error.message || 'Gagal menonaktifkan CMC')
    } finally {
      setDeactivatingId(null)
    }
  }

  const fields: Array<{
    key: keyof CmcForm
    label: string
    type?: string
    required?: boolean
    disabled?: boolean
  }> = [
    { key: 'code', label: 'Kode Profil', required: true, disabled: !!editingItem },
    { key: 'name', label: 'Nama Profil', required: true },
    { key: 'parameter_code', label: 'Kode Parameter', required: true, disabled: !!editingItem },
    { key: 'calibration_method', label: 'Metode Kalibrasi' },
    { key: 'range_min', label: 'Rentang Awal', type: 'number' },
    { key: 'range_max', label: 'Rentang Akhir', type: 'number' },
    { key: 'cmc_value', label: 'Nilai CMC', type: 'number', required: true },
    { key: 'unit', label: 'Satuan', required: true },
    { key: 'source_document', label: 'Dokumen Acuan' },
    { key: 'effective_from', label: 'Berlaku Mulai', type: 'date', required: true },
    { key: 'effective_until', label: 'Berlaku Sampai', type: 'date' },
  ]

  return (
    <div className="space-y-6">
      {alert.show && <Alert type={alert.type} message={alert.message} onClose={hideAlert} autoHide={alert.autoHide} duration={alert.duration} />}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Daftar Profil CMC</h2>
            <p className="mt-1 text-sm text-slate-500">Cari, filter, dan kelola profil CMC beserta rentang utamanya.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select value={parameterFilter} onChange={(event) => setParameterFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Semua Parameter</option>
              {parameters.map((parameter) => <option key={parameter} value={parameter}>{parameter}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode, nama, metode..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" />
            {canMutate && <button type="button" onClick={openCreateModal} className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-blue-700 hover:to-cyan-700">+ Tambah Profil</button>}
          </div>
        </div>
        {!canMutate && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Akses Anda bersifat read-only. Perubahan Master CMC hanya dapat dilakukan admin.</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" tone="blue" className="border-blue-600" /><span className="ml-3 text-slate-500">Memuat data CMC...</span></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><p className="font-medium text-slate-700">Tidak ada profil CMC ditemukan</p><p className="mt-1 text-sm text-slate-400">Ubah filter atau tambahkan profil baru.</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr>{['No', 'Kode', 'Nama', 'Parameter', 'Rentang', 'CMC', 'Metode', 'Versi', 'Status', 'Aksi'].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedItems.map((item, index) => {
                    const value = getPrimaryCmcValue(item.cmc_values)
                    const additionalRanges = Math.max(0, (item.cmc_values?.length || 0) - 1)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{(currentPage - 1) * pageSize + index + 1}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-800">{item.code}</td>
                        <td className="max-w-64 px-4 py-3"><p className="truncate font-medium text-slate-900" title={item.name}>{item.name}</p><p className="mt-0.5 text-xs text-slate-400">{item.source_document || 'Tanpa dokumen acuan'}</p></td>
                        <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{item.parameter_code}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{value?.range_min ?? '-'} – {value?.range_max ?? '-'}{additionalRanges > 0 && <span className="ml-1 text-xs text-blue-600">+{additionalRanges} range</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-700">{value?.cmc_value ?? '-'} {value?.unit ?? ''}</td>
                        <td className="max-w-52 px-4 py-3"><p className="truncate text-slate-600" title={item.calibration_method || ''}>{item.calibration_method || '-'}</p></td>
                        <td className="px-4 py-3">v{item.version}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {canMutate ? <div className="flex gap-2"><button type="button" onClick={() => openEditModal(item)} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Edit</button>{item.is_active && <button type="button" onClick={() => setConfirmDeactivate(item)} disabled={deactivatingId === item.id} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Nonaktifkan</button>}</div> : <span className="text-xs text-slate-400">Read-only</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Menampilkan <span className="font-medium">{pageStart}</span>-<span className="font-medium">{pageEnd}</span> dari <span className="font-medium">{filtered.length}</span> profil</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-40">Awal</button>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="min-w-24 text-center text-sm text-slate-600">Halaman {currentPage} / {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-40">Akhir</button>
              </div>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cmc-modal-title">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4">
              <div><h3 id="cmc-modal-title" className="text-lg font-semibold text-white">{editingItem ? 'Edit Profil CMC' : 'Tambah Profil CMC'}</h3><p className="mt-0.5 text-xs text-blue-100">Nilai disimpan dengan presisi penuh untuk perhitungan sertifikat.</p></div>
              <button type="button" onClick={closeModal} className="text-2xl leading-none text-white/80 hover:text-white" aria-label="Tutup modal">×</button>
            </div>
            <form onSubmit={submit} className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => (
                  <label key={field.key} className="text-sm font-medium text-slate-700">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                    <input type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} required={field.required} disabled={field.disabled} value={String(form[field.key] ?? '')} onChange={(event) => updateForm(field.key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                ))}
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Profil aktif
                </label>
              </div>
              {editingItem && (editingItem.cmc_values?.length || 0) > 1 && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Profil ini memiliki {editingItem.cmc_values.length} range. Modal mengedit range sequence terendah; range lain tetap dipertahankan.</p>}
              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting && <Spinner size="sm" tone="white" />}{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h3 className="text-lg font-semibold text-slate-900">Nonaktifkan Profil CMC?</h3><p className="mt-2 text-sm text-slate-600">Profil <strong>{confirmDeactivate.code}</strong> tidak akan digunakan untuk resolusi CMC setelah dinonaktifkan.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmDeactivate(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button><button type="button" onClick={deactivate} disabled={deactivatingId === confirmDeactivate.id} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deactivatingId ? 'Memproses...' : 'Nonaktifkan'}</button></div></div>
        </div>
      )}
    </div>
  )
}

export default MasterCmcCRUD
