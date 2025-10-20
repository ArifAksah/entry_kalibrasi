'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import Alert from '../../components/ui/Alert';
import { useAlert } from '../../hooks/useAlert';
import { supabase } from '../../lib/supabase';

const RegisterPage: React.FC = () => {
  const { alert, showSuccess, showError, showWarning, hideAlert } = useAlert()
  const [form, setForm] = useState({
    name: '',
    nip: '',
    position: '',
    phone: '',
    email: '',
    password: '',
    role: '' as any,
    station_id: '' as any,
  })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [pwStrength, setPwStrength] = useState<{ score: number; label: string; color: string }>({ score: 0, label: 'Very weak', color: 'bg-red-500' })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [stations, setStations] = useState<Array<{ id: number; name: string; station_id: string }>>([])

  useEffect(() => {
    const loadStations = async () => {
      try {
        const r = await fetch('/api/stations?page=1&pageSize=100')
        const d = await r.json()
        if (r.ok) {
          const first = Array.isArray(d) ? d : (d?.data ?? [])
          // if there are multiple pages, fetch them all quickly
          const totalPages = (Array.isArray(d) ? 1 : (d?.totalPages ?? 1)) as number
          if (totalPages > 1) {
            const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
              .map(p => fetch(`/api/stations?page=${p}&pageSize=100`).then(res => res.ok ? res.json() : { data: [] })))
            const restData = rest.flatMap(j => Array.isArray(j) ? j : (j?.data ?? []))
            setStations([...first, ...restData])
          } else {
            setStations(first)
          }
        }
      } catch {}
    }
    loadStations()
  }, [])

  // Password strength evaluation
  useEffect(() => {
    const evaluate = (pw: string) => {
      let score = 0
      if (pw.length >= 8) score++
      if (/[A-Z]/.test(pw)) score++
      if (/[a-z]/.test(pw)) score++
      if (/[0-9]/.test(pw)) score++
      if (/[^A-Za-z0-9]/.test(pw)) score++
      // normalize 0-5 to 0-4 scale
      if (score > 4) score = 4
      const map: Record<number, { label: string; color: string }> = {
        0: { label: 'Very weak', color: 'bg-red-500' },
        1: { label: 'Weak',      color: 'bg-orange-500' },
        2: { label: 'Fair',      color: 'bg-amber-500' },
        3: { label: 'Good',      color: 'bg-green-500' },
        4: { label: 'Strong',    color: 'bg-emerald-600' },
      }
      return { score, ...map[score] }
    }
    setPwStrength(evaluate(form.password))
  }, [form.password])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    hideAlert()
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/confirm-email` : undefined
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { name: form.name, phone: form.phone, position: form.position, nip: form.nip },
        },
      })
      if (signUpError) throw new Error(signUpError.message)
      const userId = signUpData.user?.id
      if (!userId) throw new Error('Failed to get user id')

      // Use API route with service role to bypass RLS
      const res = await fetch('/api/personel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: form.name,
          nip: form.nip,
          position: form.position,
          phone: form.phone,
          email: form.email,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save personel profile')

      // Assign role via admin endpoint
      if (form.role) {
        if (form.role === 'user_station' && !form.station_id) {
          throw new Error('Untuk role user_station, wajib memilih Station.')
        }
        const roleRes = await fetch('/api/user-roles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role: form.role, station_id: form.station_id ? parseInt(form.station_id as any) : null })
        })
        const roleBody = await roleRes.json().catch(()=>({}))
        if (!roleRes.ok) throw new Error(roleBody?.error || 'Gagal menyimpan role user')
      }

      showSuccess('Registration successful. Please check your email to confirm.')
      setForm({ name: '', nip: '', position: '', phone: '', email: '', password: '', role: '' as any, station_id: '' as any })
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-4xl mx-auto">
            {/* Alert Component */}
            {alert.show && (
              <Alert
                type={alert.type}
                message={alert.message}
                onClose={hideAlert}
                autoHide={alert.autoHide}
                duration={alert.duration}
              />
            )}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <h1 className="text-2xl font-bold text-gray-900">User Registration</h1>
              <p className="text-sm text-gray-600 mt-1">Tambahkan personel baru, akun login, dan role akses sekaligus.</p>
            </div>
            <div className="p-6">
              {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
              {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{success}</div>}

              <form onSubmit={onSubmit} className="space-y-8">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Informasi Personel</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input required value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                      <input value={form.nip} onChange={e=>setForm({ ...form, nip: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                      <input value={form.position} onChange={e=>setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input value={form.phone} onChange={e=>setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Akun & Akses</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input required type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs text-gray-500">Undangan konfirmasi akan dikirim ke email ini.</p>
                        <button type="button" onClick={()=>setPreviewOpen(true)} className="text-xs text-blue-600 hover:text-blue-700">Preview email</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={e=>setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="button" onClick={()=>setShowPass(s=>!s)} className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-800">{showPass ? 'Hide' : 'Show'}</button>
                      </div>
                      <div className="mt-2">
                        <div className="w-full h-2 bg-gray-200 rounded">
                          <div className={`h-2 ${pwStrength.color} rounded`} style={{ width: `${(pwStrength.score+1)*20}%` }} />
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Strength: {pwStrength.label}. Gunakan 8+ karakter, campuran huruf besar, kecil, angka, dan simbol.</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select value={(form as any).role || ''} onChange={e=>setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Pilih Role</option>
                        <option value="admin">Admin</option>
                        <option value="calibrator">Calibrator</option>
                        <option value="verifikator">Verifikator</option>
                        <option value="assignor">Assignor</option>
                        <option value="user_station">User Station</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Station (opsional)</label>
                      <select value={(form as any).station_id || ''} onChange={e=>setForm({ ...form, station_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Tidak ada</option>
                        {stations.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name} ({s.station_id})</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Khusus role user_station, pilih stasiun yang terkait.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{loading ? 'Registering...' : 'Register'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );

  /* Email preview modal */
  if (previewOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">Preview Email Undangan</h3>
            <button className="text-gray-600 hover:text-gray-800" onClick={()=>setPreviewOpen(false)}>✕</button>
          </div>
          <div className="p-6 space-y-4 text-sm text-gray-800">
            <p>To: <span className="font-medium">{form.email || 'user@example.com'}</span></p>
            <div className="border rounded-lg p-4 bg-gray-50">
              <p>Halo {form.name || 'User'},</p>
              <p className="mt-2">Anda diundang untuk bergabung ke sistem SIKAP-MKG BMKG. Silakan konfirmasi email dan setel password Anda melalui tautan berikut:</p>
              <p className="mt-2"><a className="text-blue-600 underline">[Link konfirmasi dikirim oleh Supabase]</a></p>
              <p className="mt-2">Jika Anda merasa tidak pernah meminta ini, abaikan email ini.</p>
              <p className="mt-4">Terima kasih,</p>
              <p>Admin SIKAP-MKG</p>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end">
            <button className="px-4 py-2 border rounded" onClick={()=>setPreviewOpen(false)}>Tutup</button>
          </div>
        </div>
      </div>
    )
  }
  
}

export default RegisterPage;


