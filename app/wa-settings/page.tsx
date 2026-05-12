'use client'

import React, { useEffect, useState, useRef } from 'react'
import QRCode from 'react-qr-code'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'

type WAStatus = {
  connected: boolean
  hasQR: boolean
}

export default function WASettingsPage() {
  const [status, setStatus] = useState<WAStatus | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const WA_URL = process.env.NEXT_PUBLIC_WA_SERVICE_URL || 'http://localhost:3001'

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${WA_URL}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: WAStatus = await res.json()
      setStatus(data)
      setError(null)

      // If has QR and not connected, fetch QR
      if (data.hasQR && !data.connected) {
        const qrRes = await fetch(`${WA_URL}/qr`)
        if (qrRes.ok) {
          const qrJson = await qrRes.json()
          setQrData(qrJson.qr)
        }
      } else {
        setQrData(null)
      }
    } catch (err: any) {
      setError('WA Service tidak dapat dihubungi. Pastikan service berjalan di port 3001.')
      setStatus(null)
      setQrData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Poll every 3 seconds
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch(`${WA_URL}/logout`, { method: 'POST' })
      await fetchStatus()
    } catch {
      setError('Gagal logout')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
        <SideNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">WhatsApp Settings</h1>

              {loading && (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3" />
                  <p className="text-gray-500">Menghubungkan ke WA Service...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800">Service Tidak Tersedia</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                      <p className="text-xs text-red-500 mt-2">Jalankan: <code className="bg-red-100 px-1.5 py-0.5 rounded">cd wa-service && npm run dev</code></p>
                    </div>
                  </div>
                </div>
              )}

              {!loading && status && (
                <>
                  {/* Connection Status */}
                  <div className={`rounded-xl shadow-sm border p-6 mb-6 ${status.connected ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {status.connected ? 'WhatsApp Terhubung' : 'Menunggu Koneksi'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {status.connected
                              ? 'Notifikasi WhatsApp aktif dan siap mengirim pesan.'
                              : 'Scan QR code di bawah untuk menghubungkan WhatsApp.'}
                          </p>
                        </div>
                      </div>
                      {status.connected && (
                        <button
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {loggingOut ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QR Code Display */}
                  {!status.connected && qrData && (
                    <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">Scan QR Code</h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Buka WhatsApp → Settings → Linked Devices → Link a Device
                      </p>
                      <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
                        <QRCode value={qrData} size={256} level="M" />
                      </div>
                      <p className="text-xs text-gray-400 mt-4">QR code akan refresh otomatis setiap beberapa detik</p>
                    </div>
                  )}

                  {/* Waiting for QR */}
                  {!status.connected && !qrData && (
                    <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3" />
                      <p className="text-gray-500">Menunggu QR code dari WA Service...</p>
                      <p className="text-xs text-gray-400 mt-2">Pastikan WA Service berjalan</p>
                    </div>
                  )}

                  {/* Connected Info */}
                  {status.connected && (
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi</h2>
                      <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span>Status</span>
                          <span className="font-medium text-green-700">Aktif</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span>Notifikasi yang dikirim via WA</span>
                          <span className="text-gray-900">Konfirmasi akun, Sertifikat terbit, Draft ke verifikator</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span>Service URL</span>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{WA_URL}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
