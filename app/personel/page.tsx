'use client'

import React, { useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import usePersonel, { Person } from '../../hooks/usePersonel'

const roles: Person['role'][] = ['admin', 'calibrator', 'verifikator', 'assignor', 'user_station']

const PersonelPage: React.FC = () => {
  const {
    items,
    loading,
    error,
    totalItems,
    totalPages,
    currentPage,
    searchTerm,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refresh,
  } = usePersonel(1, 10)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState<Person>({ id: '', name: '', email: '' })
  const [savingRole, setSavingRole] = useState<string | null>(null)

  const openModal = (p?: Person) => {
    if (p) {
      setEditing(p)
      setForm({ ...p, phone: p.phone || '', position: p.position || '', nip: p.nip || '' })
    } else {
      setEditing(null)
      setForm({ id: '', name: '', email: '', phone: '', position: '', nip: '' })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    try {
      const response = await fetch(`/api/personel/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: form.name, 
          email: form.email, 
          phone: form.phone, 
          position: form.position, 
          nip: form.nip 
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update personel')
      }
      closeModal()
      refresh() // Refresh data after saving
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const removePerson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this person?')) return
    try {
      const response = await fetch(`/api/personel/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete personel')
      }
      refresh() // Refresh data after deleting
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const saveRole = async (user_id: string, role: Person['role']) => {
    setSavingRole(user_id)
    try {
      const response = await fetch('/api/user-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, role }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save role')
      }
      refresh() // Refresh to show the updated role
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setSavingRole(null)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50/50">
          <Header />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Manajemen Personel</h1>
                <a href="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors">Registrasi Baru</a>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="mb-4">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari berdasarkan nama atau email..."
                        className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                </div>

                {error && <div className="mb-4 text-red-600 bg-red-100 p-3 rounded-lg">Error: {error}</div>}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-gray-700">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-medium">
                      <tr>
                        <th className="px-6 py-3">Nama</th>
                        <th className="px-6 py-3">Kontak</th>
                        <th className="px-6 py-3">Posisi</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(limit)].map((_, i) => (
                          <tr key={i} className="border-b border-gray-200 animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                            <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded w-full"></div></td>
                          </tr>
                        ))
                      ) : (
                        items.map(p => (
                          <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {p.name}
                              {p.nip && <div className="text-xs text-gray-500">NIP: {p.nip}</div>}
                            </td>
                            <td className="px-6 py-4">
                              <div>{p.email}</div>
                              <div className="text-xs text-gray-500">{p.phone}</div>
                            </td>
                            <td className="px-6 py-4">{p.position || '-'}</td>
                            <td className="px-6 py-4">
                              <select 
                                value={p.role || ''} 
                                onChange={(e) => saveRole(p.id, e.target.value as any)} 
                                className="px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                disabled={savingRole === p.id}
                              >
                                <option value="">- Pilih Role -</option>
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              {savingRole === p.id && <span className="ml-2 text-xs text-gray-500">Menyimpan...</span>}
                            </td>
                            <td className="px-6 py-4 text-center space-x-2">
                              <button onClick={() => openModal(p)} className="font-medium text-blue-600 hover:underline">Edit</button>
                              <button onClick={() => removePerson(p.id)} className="font-medium text-red-600 hover:underline">Hapus</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!loading && totalItems > 0 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-600">
                      Menampilkan {items.length} dari {totalItems} personel
                    </span>
                    <div className="flex items-center space-x-2">
                      <button onClick={prevPage} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        Sebelumnya
                      </button>
                      <span className="text-sm font-medium">Halaman {currentPage} dari {totalPages}</span>
                      <button onClick={nextPage} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        Berikutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 m-4">
            <h3 className="text-xl font-semibold mb-6 text-gray-800">Edit Personel</h3>
            <form onSubmit={savePerson} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input value={form.position || ''} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                <input value={form.nip || ''} onChange={e => setForm({ ...form, nip: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-4 mt-2 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

export default PersonelPage