'use client'

import React, { useState, useEffect } from 'react'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Loading from '../../../components/ui/Loading'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

interface Unit {
    id: number
    created_at: string
    unit: string
}

export default function UnitsCRUD() {
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editing, setEditing] = useState<Unit | null>(null)
    const [formUnitName, setFormUnitName] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const { alert, showSuccess, showError, hideAlert } = useAlert()

    const fetchUnits = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/units?q=${search}`)
            if (res.ok) {
                const data = await res.json()
                setUnits(data)
            } else {
                throw new Error('Failed to fetch units')
            }
        } catch (e) {
            console.error(e)
            showError('Gagal memuat data satuan')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUnits()
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formUnitName) return

        setSubmitting(true)
        try {
            const url = '/api/units'
            const method = editing ? 'PUT' : 'POST'
            const body = editing ? { id: editing.id, unit: formUnitName } : { unit: formUnitName }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                showSuccess(editing ? 'Satuan berhasil diperbarui' : 'Satuan berhasil ditambahkan')
                closeModal()
                fetchUnits()
            } else {
                const err = await res.json()
                throw new Error(err.error || 'Terjadi kesalahan')
            }
        } catch (e: any) {
            showError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus satuan ini?')) return

        try {
            const res = await fetch(`/api/units?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                showSuccess('Satuan berhasil dihapus')
                fetchUnits()
            } else {
                const err = await res.json()
                throw new Error(err.error || 'Gagal menghapus')
            }
        } catch (e: any) {
            showError(e.message)
        }
    }

    const openModal = (unit?: Unit) => {
        if (unit) {
            setEditing(unit)
            setFormUnitName(unit.unit)
        } else {
            setEditing(null)
            setFormUnitName('')
        }
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditing(null)
        setFormUnitName('')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Breadcrumb items={[{ label: 'Master Data', href: '#' }, { label: 'Master Satuan' }]} />
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

            <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Daftar Satuan</h2>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari satuan..."
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                    <button
                        onClick={() => openModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow font-medium text-sm flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Baru
                    </button>
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Satuan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat Pada</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {units.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                        Tidak ada data ditemukan
                                    </td>
                                </tr>
                            ) : (
                                units.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-12">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {item.unit}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <EditButton onClick={() => openModal(item)} />
                                                <DeleteButton onClick={() => handleDelete(item.id)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">
                                {editing ? 'Edit Satuan' : 'Tambah Satuan Baru'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                                        Nama Satuan
                                    </label>
                                    <input
                                        type="text"
                                        id="unit"
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={formUnitName}
                                        onChange={(e) => setFormUnitName(e.target.value)}
                                        placeholder="Contoh: kg, mm, celcius"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    {submitting ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Simpan')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
