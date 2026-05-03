'use client'

import React, { useEffect, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import usePersonel, { Person } from '../../hooks/usePersonel'
import { supabase } from '../../lib/supabase'
import { useAlert } from '../../hooks/useAlert'
import Alert from '../../components/ui/Alert'
import { EditButton, DeleteButton } from '../../components/ui/ActionIcons'
import SearchableDropdown from '../../components/ui/SearchableDropdown'

const roleOptions = [
  { id: '', name: 'Tidak ada role' },
  { id: 'admin', name: 'Admin' },
  { id: 'calibrator', name: 'Petugas Kalibrasi' },
  { id: 'verifikator', name: 'Verifikator' },
  { id: 'assignor', name: 'Penandatangan' },
  { id: 'user_station', name: 'User Stasiun' },
]

const formatRoleLabel = (role?: string | null) => {
  if (!role) return '-'

  const foundRole = roleOptions.find((option) => option.id === role)
  if (foundRole) return foundRole.name

  return role.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const getRoleBadgeClass = (role?: string | null) => {
  switch (role) {
    case 'admin':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'calibrator':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'verifikator':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'assignor':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'user_station':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

type PersonelForm = Person & {
  nik?: string
  password?: string
  station_id?: string | number | null
}

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
    setRoleLocal,
  } = usePersonel(1, 10)

  const { alert, showSuccess, showError, hideAlert } = useAlert()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState<PersonelForm>({ id: '', name: '', email: '', phone: '', nip: '', nik: '', role: '', station_id: '', password: '' })
  const [savingRole, setSavingRole] = useState<string | null>(null)

  // Registration modal state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [regForm, setRegForm] = useState({
    name: '',
    nip: '',
    nik: '',
    phone: '',
    email: '',
    password: '',
    role: '' as any,
    station_id: '' as any,
  })
  const [regLoading, setRegLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showEditPass, setShowEditPass] = useState(false)
  const [pwStrength, setPwStrength] = useState<{ score: number; label: string; color: string }>({ score: 0, label: 'Very weak', color: 'bg-red-500' })
  const [stations, setStations] = useState<Array<{ id: number; name: string; station_id: string }>>([])
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState<string | null>(null)

  const openModal = (p?: Person) => {
    if (p) {
      setEditing(p)
      setForm({
        ...p,
        phone: p.phone || '',
        nip: p.nip || '',
        nik: p.nik || '',
        role: p.role || '',
        station_id: p.station_id ? String(p.station_id) : '',
        password: '',
      })
    } else {
      setEditing(null)
      setForm({ id: '', name: '', email: '', phone: '', nip: '', nik: '', role: '', station_id: '', password: '' })
    }
    setShowEditPass(false)
    setIsModalOpen(true)
  }

  // Load stations for registration and edit modal
  useEffect(() => {
    if (!isRegisterOpen && !isModalOpen) return
    const loadStations = async () => {
      try {
        const response = await fetch('/api/stations/all')
        const data = await response.json().catch(() => [])
        if (!response.ok) throw new Error('Gagal memuat data stasiun')
        setStations(Array.isArray(data) ? data : [])
      } catch {
        setStations([])
      }
    }
    loadStations()
  }, [isRegisterOpen, isModalOpen])

  // Password strength evaluation
  useEffect(() => {
    const pw = regForm.password
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score > 4) score = 4
    const map: Record<number, { label: string; color: string }> = {
      0: { label: 'Very weak', color: 'bg-red-500' },
      1: { label: 'Weak', color: 'bg-orange-500' },
      2: { label: 'Fair', color: 'bg-amber-500' },
      3: { label: 'Good', color: 'bg-green-500' },
      4: { label: 'Strong', color: 'bg-emerald-600' },
    }
    setPwStrength({ score, ...map[score] })
  }, [regForm.password])

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setRegError(null)
    setRegSuccess(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesi admin tidak ditemukan')

      const res = await fetch('/api/personel/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: regForm.name,
          nip: regForm.nip,
          nik: regForm.nik,
          phone: regForm.phone,
          email: regForm.email,
          password: regForm.password,
          role: regForm.role || null,
          station_id: regForm.station_id || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Gagal mendaftarkan personel')

      setRegSuccess('Registrasi berhasil dibuat.')
      showSuccess('Personel baru berhasil dibuat tanpa mengubah sesi admin.')
      setRegForm({ name: '', nip: '', nik: '', phone: '', email: '', password: '', role: '' as any, station_id: '' as any })
      await refresh()
      setTimeout(() => setIsRegisterOpen(false), 800)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed'
      setRegError(errorMessage)
      showError(errorMessage)
    } finally {
      setRegLoading(false)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
    setShowEditPass(false)
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
          nip: form.nip,
          nik: form.nik,
          password: form.password || undefined,
          role: form.role || null,
          station_id: form.station_id || null,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update personel')
      }
      showSuccess('Data personel berhasil diperbarui!')
      closeModal()
      refresh() // Refresh data after saving
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save'
      showError(errorMessage)
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
      showSuccess('Personel berhasil dihapus!')
      refresh() // Refresh data after deleting
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete'
      showError(errorMessage)
    }
  }

  const saveRole = async (user_id: string, role: Person['role'] | '') => {
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
      setRoleLocal(user_id, (role || undefined) as Person['role'] | undefined)
      showSuccess(`Role berhasil diperbarui menjadi: ${formatRoleLabel(role)}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save role'
      showError(errorMessage)
    } finally {
      setSavingRole(null)
    }
  }

  return (
    <ProtectedRoute>
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50/50">
          <Header />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Manajemen Personel</h1>
                <button onClick={() => setIsRegisterOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors">Registrasi Baru</button>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari berdasarkan nama atau email..."
                    autoComplete="off"
                    name="personel-search"
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
                        [...Array(10)].map((_, i) => (
                          <tr key={i} className="border-b border-gray-200 animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                            <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded w-full"></div></td>
                          </tr>
                        ))
                      ) : (
                        items.map((p: Person) => (
                          <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {p.name}
                              {p.nip && <div className="text-xs text-gray-500">NIP: {p.nip}</div>}
                              {(p as any).nik && <div className="text-xs text-gray-500">NIK: {(p as any).nik}</div>}
                            </td>
                            <td className="px-6 py-4">
                              <div>{p.email}</div>
                              <div className="text-xs text-gray-500">{p.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getRoleBadgeClass(p.role)}`}>
                                {formatRoleLabel(p.role)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <SearchableDropdown
                                value={p.role || ''}
                                onChange={(value) => saveRole(p.id, (value || '') as Person['role'] | '')}
                                options={roleOptions}
                                placeholder="Pilih role"
                                searchPlaceholder="Cari role..."
                                emptyLabel="Role tidak ditemukan"
                                className="min-w-[220px]"
                              />
                              {savingRole === p.id && <span className="ml-2 text-xs text-gray-500">Menyimpan...</span>}
                            </td>
                            <td className="px-6 py-4 text-center space-x-2">
                              <EditButton onClick={() => openModal(p)} title="Edit Personel" />
                              <DeleteButton onClick={() => removePerson(p.id)} title="Hapus Personel" />
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
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl p-6 m-4">
            <h3 className="text-xl font-semibold mb-6 text-gray-800">Edit Personel</h3>
            <form onSubmit={savePerson} autoComplete="off" className="space-y-8">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Informasi Personel</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input required autoComplete="off" name="edit-personel-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                    <input autoComplete="off" name="edit-personel-nip" value={form.nip || ''} onChange={e => setForm({ ...form, nip: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                    <input autoComplete="off" name="edit-personel-nik" value={form.nik || ''} onChange={e => setForm({ ...form, nik: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nomor Induk Kependudukan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input autoComplete="off" name="edit-personel-phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Akun & Akses</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input required autoComplete="off" name="edit-personel-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                    <div className="relative">
                      <input autoComplete="new-password" name="edit-personel-password" type={showEditPass ? 'text' : 'password'} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Kosongkan jika tidak diubah" />
                      <button type="button" onClick={() => setShowEditPass(s => !s)} className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-800">{showEditPass ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <SearchableDropdown
                      value={form.role || ''}
                      onChange={(value) => setForm({ ...form, role: (value || '') as Person['role'] })}
                      options={roleOptions}
                      placeholder="Pilih role"
                      searchPlaceholder="Cari role..."
                      emptyLabel="Role tidak ditemukan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Station (opsional)</label>
                    <SearchableDropdown
                      value={form.station_id ? String(form.station_id) : ''}
                      onChange={(value) => setForm({ ...form, station_id: value ? String(value) : '' })}
                      options={[
                        { id: '', name: 'Tidak ada' },
                        ...stations.map((station) => ({
                          id: String(station.id),
                          name: station.name,
                          description: station.station_id ? `ID Stasiun: ${station.station_id}` : undefined,
                        }))
                      ]}
                      placeholder="Pilih stasiun"
                      searchPlaceholder="Cari nama atau ID stasiun..."
                      emptyLabel="Stasiun tidak ditemukan"
                    />
                    <p className="text-xs text-gray-500 mt-1">Khusus role user_station, pilih stasiun yang terkait.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl p-6 m-4">
            <h3 className="text-xl font-semibold mb-6 text-gray-800">Registrasi Personel Baru</h3>
            {regError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{regError}</div>}
            {regSuccess && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{regSuccess}</div>}
            <form onSubmit={submitRegistration} autoComplete="off" className="space-y-8">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Informasi Personel</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input required autoComplete="off" name="register-personel-name" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                    <input autoComplete="off" name="register-personel-nip" value={regForm.nip} onChange={e => setRegForm({ ...regForm, nip: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                    <input autoComplete="off" name="register-personel-nik" value={regForm.nik} onChange={e => setRegForm({ ...regForm, nik: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nomor Induk Kependudukan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input autoComplete="off" name="register-personel-phone" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Akun & Akses</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input required autoComplete="off" name="register-personel-email" type="email" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <input required autoComplete="new-password" name="register-personel-password" type={showPass ? 'text' : 'password'} value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-800">{showPass ? 'Hide' : 'Show'}</button>
                    </div>
                    <div className="mt-2">
                      <div className="w-full h-2 bg-gray-200 rounded">
                        <div className={`h-2 ${pwStrength.color} rounded`} style={{ width: `${(pwStrength.score + 1) * 20}%` }} />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Strength: {pwStrength.label}.</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <SearchableDropdown
                      value={(regForm as any).role || ''}
                      onChange={(value) => setRegForm({ ...regForm, role: (value || '') as any })}
                      options={roleOptions.filter((option) => option.id !== '')}
                      placeholder="Pilih role"
                      searchPlaceholder="Cari role..."
                      emptyLabel="Role tidak ditemukan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Station (opsional)</label>
                    <SearchableDropdown
                      value={(regForm as any).station_id || ''}
                      onChange={(value) => setRegForm({ ...regForm, station_id: value ? String(value) : '' })}
                      options={[
                        { id: '', name: 'Tidak ada' },
                        ...stations.map((station) => ({
                          id: String(station.id),
                          name: station.name,
                          description: station.station_id ? `ID Stasiun: ${station.station_id}` : undefined,
                        }))
                      ]}
                      placeholder="Pilih stasiun"
                      searchPlaceholder="Cari nama atau ID stasiun..."
                      emptyLabel="Stasiun tidak ditemukan"
                    />
                    <p className="text-xs text-gray-500 mt-1">Khusus role user_station, pilih stasiun yang terkait.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsRegisterOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" disabled={regLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">{regLoading ? 'Registering...' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

export default PersonelPage
