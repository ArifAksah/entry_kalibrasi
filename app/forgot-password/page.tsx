'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

const ForgotPasswordPage: React.FC = () => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSuccess(data.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim email reset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
        <h1 className="text-xl font-bold text-white mb-1">Lupa Password</h1>
        <p className="text-slate-300 text-sm mb-4">Masukkan email Anda. Kami akan mengirim tautan untuk mengatur ulang password.</p>
        {error && <div className="mb-3 text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm">{error}</div>}
        {success && <div className="mb-3 text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-lg px-3 py-2 text-sm">{success}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e=>setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="user@example.com"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={()=>router.push('/login')} className="text-slate-300 text-sm hover:text-white">Kembali ke Login</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
              {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ForgotPasswordPage


