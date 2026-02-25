'use client'

import React, { useEffect, useState } from 'react'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'

interface InstrumentName {
    id: number
    name: string
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
    instrument_names: InstrumentName | null
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

const MasterQCCRUD: React.FC = () => {
    usePermissions()
    const { alert, showSuccess, showError, hideAlert } = useAlert()

    const [items, setItems] = useState<MasterQCItem[]>([])
    const [instrumentNames, setInstrumentNames] = useState<InstrumentName[]>([])
    const [units, setUnits] = useState<RefUnit[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<MasterQCItem | null>(null)
    const [form, setForm] = useState<FormState>(defaultForm)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [search, setSearch] = useState('')

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
        } catch { /* silent */ }
    }

    const fetchUnits = async () => {
        try {
            const res = await fetch('/api/units')
            if (!res.ok) return
            const json = await res.json()
            setUnits(Array.isArray(json) ? json : [])
        } catch { /* silent */ }
    }

    useEffect(() => {
        fetchItems()
        fetchInstrumentNames()
        fetchUnits()
    }, [])

    const openModal = (item?: MasterQCItem) => {
        if (item) {
            setEditingItem(item)
            setForm({
                instrument_name_id: String(item.instrument_names?.id ?? ''),
                unit_id: String(item.ref_unit?.id ?? ''),
                nilai_batas_koreksi: item.nilai_batas_koreksi,
                catatan: item.catatan ?? '',
            })
        } else {
            setEditingItem(null)
            setForm(defaultForm)
        }
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingItem(null)
        setForm(defaultForm)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.instrument_name_id || !form.unit_id || !form.nilai_batas_koreksi.trim()) return
        setIsSubmitting(true)
        try {
            const payload = {
                instrument_name_id: Number(form.instrument_name_id),
                unit_id: Number(form.unit_id),
                nilai_batas_koreksi: form.nilai_batas_koreksi.trim(),
                catatan: form.catatan.trim() || null,
            }

            const url = editingItem ? `/api/master-qc/${editingItem.id}` : '/api/master-qc'
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
            showSuccess(editingItem ? 'Data Master QC berhasil diupdate' : 'Data Master QC berhasil ditambahkan')
            closeModal()
            fetchItems()
        } catch (e: any) {
            showError(e.message || 'Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (item: MasterQCItem) => {
        const label = item.instrument_names?.name ?? `ID ${item.id}`
        if (!confirm(`Hapus data "${label}"? Data yang sudah dihapus tidak bisa dipulihkan.`)) return
        try {
            const res = await fetch(`/api/master-qc/${item.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Gagal menghapus data')
            }
            showSuccess('Data Master QC berhasil dihapus')
            fetchItems()
        } catch (e: any) {
            showError(e.message || 'Gagal menghapus data')
        }
    }

    const filtered = items.filter(item => {
        const q = search.toLowerCase()
        return (
            item.instrument_names?.name?.toLowerCase().includes(q) ||
            item.nilai_batas_koreksi?.toLowerCase().includes(q) ||
            item.ref_unit?.unit?.toLowerCase().includes(q) ||
            (item.catatan ?? '').toLowerCase().includes(q)
        )
    })

    return (
        <div className="space-y-6">
            {alert.show && (
                <Alert type={alert.type} message={alert.message} onClose={hideAlert} autoHide={alert.autoHide} duration={alert.duration} />
            )}

            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Master QC — Nilai Batas Koreksi</h2>
                <div className="flex items-center gap-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari nama, nilai, satuan..."
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                    <button
                        onClick={() => openModal()}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Baru
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-500">Memuat data...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="font-medium">Belum ada data Master QC</p>
                        <p className="text-sm mt-1">Klik &quot;Tambah Baru&quot; untuk menambahkan data pertama.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">No</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Instrumen</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai Batas Koreksi</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catatan</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filtered.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{item.instrument_names?.name ?? '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {item.ref_unit?.unit ?? '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-indigo-700">{item.nilai_batas_koreksi}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                                            {item.catatan ?? <span className="text-gray-300 italic">—</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                                            <button
                                                onClick={() => openModal(item)}
                                                className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium"
                                            >
                                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors text-xs font-medium"
                                            >
                                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                            <button onClick={closeModal} className="text-white hover:text-gray-300 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Nama Instrumen */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Instrumen <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="instrument_name_id"
                                    value={form.instrument_name_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                >
                                    <option value="">-- Pilih Nama Instrumen --</option>
                                    {instrumentNames.map(n => (
                                        <option key={n.id} value={n.id}>{n.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Satuan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Satuan (Unit) <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="unit_id"
                                    value={form.unit_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                >
                                    <option value="">-- Pilih Satuan --</option>
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>{u.unit}</option>
                                    ))}
                                </select>
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
                                <p className="text-xs text-gray-400 mt-1">Masukkan nilai numerik, satuan dipilih terpisah di atas</p>
                            </div>

                            {/* Catatan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Catatan <span className="text-gray-400 font-normal">(opsional)</span>
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
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    )}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MasterQCCRUD
