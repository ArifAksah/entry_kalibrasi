'use client'

import React, { useEffect, useMemo, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '../../lib/supabase'

type Person = { id: string; name: string; email: string; phone?: string | null; position?: string | null; nip?: string | null }
type UserRoleRow = { user_id: string; role: 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station'; station_id?: number | null }

const roles: UserRoleRow['role'][] = ['admin','calibrator','verifikator','assignor','user_station']

const PersonelPage: React.FC = () => {
  const [items, setItems] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState<Person>({ id: '', name: '', email: '' })
  const [roleMap, setRoleMap] = useState<Record<string, UserRoleRow>>({})
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchAll = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/personel')
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to load personel')
      setItems(Array.isArray(d) ? d : [])
      // fetch roles
      const roleEntries: Record<string, UserRoleRow> = {}
      await Promise.all((Array.isArray(d) ? d : []).map(async (p: Person) => {
        const rr = await fetch(`/api/user-roles?user_id=${p.id}`)
        const rd = await rr.json().catch(() => null)
        if (rr.ok && rd) roleEntries[p.id] = rd
      }))
      setRoleMap(roleEntries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.position?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const openModal = (p?: Person) => {
    if (p) { setEditing(p); setForm({ id: p.id, name: p.name, email: p.email, phone: p.phone || '', position: p.position || '', nip: p.nip || '' }) }
    else { setEditing(null); setForm({ id: '', name: '', email: '', phone: '', position: '', nip: '' }) }
    setIsModalOpen(true)
  }
  const closeModal = () => { setIsModalOpen(false); setEditing(null) }

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      if (!form.name || !form.email) throw new Error('Name and email are required')
      if (!editing) throw new Error('Use registration to create new user')
      const r = await fetch(`/api/personel/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, position: form.position, nip: form.nip }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to update')
      await fetchAll()
      closeModal()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const removePerson = async (id: string) => {
    if (!confirm('Delete this personel?')) return
    try {
      const r = await fetch(`/api/personel/${id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'Failed to delete')
      await fetchAll()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete') }
  }

  const saveRole = async (user_id: string, role: UserRoleRow['role']) => {
    try {
      setSavingRole(user_id)
      const r = await fetch('/api/user-roles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, role }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to save role')
      setRoleMap(prev => ({ ...prev, [user_id]: d }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save role')
    } finally { setSavingRole(null) }
  }

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50"><Header /><div className="p-6">Loading...</div></div>
      </div>
    </ProtectedRoute>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Manajemen Personel</h1>
              <a href="/register" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors duration-300">Registrasi Baru</a>
            </div>
            {error && <div className="mb-3 text-red-600 bg-red-100 border border-red-200 p-3 rounded-lg">{error}</div>}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Cari personel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto border rounded-lg bg-white shadow-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Nama</th>
                    <th className="px-6 py-3 text-left font-semibold">Email</th>
                    <th className="px-6 py-3 text-left font-semibold">Telepon</th>
                    <th className="px-6 py-3 text-left font-semibold">Posisi</th>
                    <th className="px-6 py-3 text-left font-semibold">Role</th>
                    <th className="px-6 py-3 text-left font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedItems.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{p.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{p.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{p.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{p.position || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select value={roleMap[p.id]?.role || ''} onChange={(e)=>saveRole(p.id, e.target.value as any)} className="px-2 py-1 border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="">- pilih -</option>
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {savingRole===p.id && <span className="ml-2 text-gray-500 text-xs">Menyimpan...</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <button onClick={()=>openModal(p)} className="text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                        <button onClick={()=>removePerson(p.id)} className="text-red-600 hover:text-red-800 font-semibold">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-700">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg text-sm bg-white hover:bg-gray-100 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg text-sm bg-white hover:bg-gray-100 disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>

            {isModalOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl">
                  <div className="p-6 border-b">
                    <h3 className="text-xl font-bold">Edit Personel</h3>
                  </div>
                  <form onSubmit={savePerson}>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                        <input value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                        <input value={form.phone || ''} onChange={e=>setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Posisi</label>
                        <input value={form.position || ''} onChange={e=>setForm({ ...form, position: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                        <input value={form.nip || ''} onChange={e=>setForm({ ...form, nip: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                      <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm font-semibold bg-white hover:bg-gray-100">Batal</button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Simpan</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default PersonelPage;