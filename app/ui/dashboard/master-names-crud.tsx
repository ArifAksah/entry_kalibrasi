'use client'

import React, { useEffect, useState } from 'react'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'

interface NameItem {
    id: number
    name: string
    created_at: string
}

type ActiveTab = 'instrument_names' | 'sensor_names'

const MasterNamesCRUD: React.FC = () => {
    usePermissions()
    const { alert, showSuccess, showError, hideAlert } = useAlert()

    const [activeTab, setActiveTab] = useState<ActiveTab>('instrument_names')
    const [items, setItems] = useState<NameItem[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<NameItem | null>(null)
    const [nameInput, setNameInput] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [search, setSearch] = useState('')

    const apiPath = activeTab === 'instrument_names' ? '/api/instrument-names' : '/api/sensor-names'
    const label = activeTab === 'instrument_names' ? 'Nama Instrumen' : 'Nama Sensor'

    const fetchItems = async () => {
        setLoading(true)
        try {
            const res = await fetch(apiPath)
            if (!res.ok) throw new Error('Gagal mengambil data')
            const json = await res.json()
            // instrument-names returns array directly, sensor-names returns { data: [...] }
            const data = Array.isArray(json) ? json : (json?.data ?? [])
            setItems(data)
        } catch (e: any) {
            showError(e.message || 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [activeTab])

    const openModal = (item?: NameItem) => {
        setEditingItem(item || null)
        setNameInput(item?.name || '')
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingItem(null)
        setNameInput('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nameInput.trim()) return
        setIsSubmitting(true)
        try {
            if (editingItem) {
                // Update - use [id] endpoint
                const idPath = activeTab === 'instrument_names'
                    ? `/api/instrument-names/${editingItem.id}`
                    : `/api/sensor-names/${editingItem.id}`
                const res = await fetch(idPath, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: nameInput.trim() })
                })
                if (!res.ok) {
                    const err = await res.json()
                    throw new Error(err.error || 'Gagal mengupdate data')
                }
                showSuccess(`${label} berhasil diupdate`)
            } else {
                // Create
                const res = await fetch(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: nameInput.trim() })
                })
                if (!res.ok) {
                    const err = await res.json()
                    throw new Error(err.error || 'Gagal menyimpan data')
                }
                showSuccess(`${label} berhasil ditambahkan`)
            }
            closeModal()
            fetchItems()
        } catch (e: any) {
            showError(e.message || 'Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (item: NameItem) => {
        if (!confirm(`Hapus "${item.name}"? Data yang sudah dihapus tidak bisa dipulihkan.`)) return
        try {
            const idPath = activeTab === 'instrument_names'
                ? `/api/instrument-names/${item.id}`
                : `/api/sensor-names/${item.id}`
            const res = await fetch(idPath, { method: 'DELETE' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Gagal menghapus data')
            }
            showSuccess(`${label} berhasil dihapus`)
            fetchItems()
        } catch (e: any) {
            showError(e.message || 'Gagal menghapus data')
        }
    }

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
    )


    return (
        <div className="space-y-6">
            {alert.show && (
                <Alert type={alert.type} message={alert.message} onClose={hideAlert} autoHide={alert.autoHide} duration={alert.duration} />
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {(['instrument_names', 'sensor_names'] as ActiveTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSearch('') }}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab === 'instrument_names' ? 'Nama Instrumen' : 'Nama Sensor'}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">
                    Master {label}
                </h2>
                <div className="flex items-center gap-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={`Cari ${label.toLowerCase()}...`}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
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
                        <p className="font-medium">Belum ada data {label}</p>
                        <p className="text-sm mt-1">Klik "Tambah Baru" untuk menambahkan data pertama.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filtered.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                day: '2-digit', month: 'long', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">
                                {editingItem ? `Edit ${label}` : `Tambah ${label}`}
                            </h3>
                            <button onClick={closeModal} className="text-white hover:text-gray-300 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nama {label} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={e => setNameInput(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={`Masukkan ${label.toLowerCase()}...`}
                                    required
                                    autoFocus
                                />
                            </div>
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

export default MasterNamesCRUD
