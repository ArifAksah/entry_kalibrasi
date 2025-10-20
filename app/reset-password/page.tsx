'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Alert from '../../components/ui/Alert'
import { useAlert } from '../../hooks/useAlert'

const ResetPasswordPage: React.FC = () => {
  const router = useRouter()
  const params = useSearchParams()
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    if (token) {
      // Token is available from URL
    } else {
      showError('Token reset password tidak ditemukan')
    }
  }, [params, showError])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    hideAlert()
    try {
      if (!password || password.length < 8) throw new Error('Password minimal 8 karakter')
      if (password !== confirm) throw new Error('Konfirmasi password tidak sama')
      
      const token = params.get('token')
      if (!token) throw new Error('Token tidak ditemukan')
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      showSuccess(data.message)
      setTimeout(()=>router.push('/login'), 2000)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Gagal memperbarui password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center px-4">
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
      
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
        <h1 className="text-xl font-bold text-white mb-1">Reset Password</h1>
        <p className="text-slate-300 text-sm mb-4">Masukkan password baru Anda.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Password Baru</label>
            <input
              type="password"
              required
              value={password}
              onChange={e=>setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Konfirmasi Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e=>setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Ulangi password"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={()=>router.push('/login')} className="text-slate-300 text-sm hover:text-white">Kembali ke Login</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordPage


