'use client'

import React, { useEffect, useMemo, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'

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
          <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Manajemen Personel</h1>
              <a href="/register" className="px-3 py-2 bg-blue-600 text-white rounded-lg">Registrasi Baru</a>
            </div>
            {error && <div className="mb-3 text-red-600">{error}</div>}
            <div className="overflow-x-auto border rounded-lg bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Nama</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Position</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2">{p.email}</td>
                      <td className="px-4 py-2">{p.phone || '-'}</td>
                      <td className="px-4 py-2">{p.position || '-'}</td>
                      <td className="px-4 py-2">
                        <select value={roleMap[p.id]?.role || ''} onChange={(e)=>saveRole(p.id, e.target.value as any)} className="px-2 py-1 border rounded">
                          <option value="">- pilih -</option>
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {savingRole===p.id && <span className="ml-2 text-gray-500">Saving...</span>}
                      </td>
                      <td className="px-4 py-2 space-x-2">
                        <button onClick={()=>openModal(p)} className="text-blue-600">Edit</button>
                        <button onClick={()=>removePerson(p.id)} className="text-red-600">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isModalOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white w-full max-w-xl rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Edit Personel</h3>
                  <form onSubmit={savePerson} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                      <input value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input value={form.phone || ''} onChange={e=>setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                      <input value={form.position || ''} onChange={e=>setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                      <input value={form.nip || ''} onChange={e=>setForm({ ...form, nip: e.target.value })} className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Batal</button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Simpan</button>
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

export default PersonelPage



