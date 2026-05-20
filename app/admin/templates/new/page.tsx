'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_PAGE_SETTINGS } from '@/lib/rich-text-editor/types'

const CERTIFICATE_TYPES = [
  'fc',
  'lc',
  'fc_balai_1',
  'fc_balai_2',
  'fc_balai_3',
  'fc_balai_4',
  'fc_balai_5',
  'lc_balai_1',
  'lc_balai_2',
  'lc_balai_3',
  'lc_balai_4',
  'lc_balai_5',
  'standar',
]

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [certificateType, setCertificateType] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Nama template wajib diisi')
      return
    }
    if (!certificateType) {
      setError('Tipe sertifikat wajib dipilih')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Sesi login tidak ditemukan. Silakan login ulang.')
        setCreating(false)
        return
      }

      const body = {
        name: name.trim(),
        certificate_type: certificateType,
        page_settings: DEFAULT_PAGE_SETTINGS,
      }

      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Gagal membuat template')
        return
      }

      const created = await res.json()
      router.push(`/admin/templates/${created.id}/word-upload`)
    } catch {
      setError('Gagal membuat template. Periksa koneksi internet.')
    } finally {
      setCreating(false)
    }
  }, [name, certificateType, router])

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/templates')}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Daftar
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Buat Template Baru</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Template
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Contoh: Template FC Pusat"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipe Sertifikat
            </label>
            <select
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Pilih tipe sertifikat...</option>
              {CERTIFICATE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-semibold text-gray-900">Upload Word Template</span>
            </div>
            <p className="text-xs text-gray-600">
              Setelah membuat template, Anda akan diarahkan ke halaman upload file .docx
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => router.push('/admin/templates')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Membuat...' : 'Buat Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
