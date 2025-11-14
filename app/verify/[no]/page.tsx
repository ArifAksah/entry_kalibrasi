'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type VerifyResponse = {
  valid: boolean
  certificate?: {
    number: string
    order: string
    issue_date: string
    version: number
  }
  verification?: {
    status: string
    signed_at?: string
    signature_data?: any
    timestamp_data?: any
    certificate_version?: number
  } | null
  error?: string
  message?: string
}

export default function VerifyCertificatePage() {
  const params = useParams<{ no: string }>()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const no = params.no
        if (!no) {
          setError('Certificate number is missing')
          setLoading(false)
          return
        }
        const res = await fetch(`/api/verify-certificate?no=${encodeURIComponent(String(no))}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || json?.message || 'Verification failed')
        setData(json)
      } catch (e: any) {
        setError(e?.message || 'Failed to verify certificate')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params.no])

  const issueISO = data?.certificate?.issue_date ? new Date(data.certificate.issue_date).toISOString().slice(0,10) : '-'
  const signedAtISO = data?.verification?.signed_at ? new Date(data.verification.signed_at).toISOString().slice(0,10) : null

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white shadow rounded-lg p-6">
        <h1 className="text-xl font-bold mb-2">Verifikasi Sertifikat</h1>
        <p className="text-sm text-gray-600 mb-6">Halaman ini menampilkan status keaslian sertifikat yang diterbitkan oleh sistem ini.</p>

        {loading && (
          <div className="text-gray-700">Memverifikasi...</div>
        )}

        {!loading && error && (
          <div className="text-red-600">{error}</div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Nomor Sertifikat</div>
              <div className="text-lg font-semibold">{data.certificate?.number}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Nomor Order</div>
                <div className="font-medium">{data.certificate?.order}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tanggal Terbit</div>
                <div className="font-medium">{issueISO}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Versi Dokumen</div>
                <div className="font-medium">{data.certificate?.version}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status Verifikasi</div>
                <div className={`font-semibold ${data.valid ? 'text-green-700' : 'text-red-700'}`}>
                  {data.valid ? 'Valid (ditandatangani elektronik)' : 'Tidak valid / belum ditandatangani'}
                </div>
              </div>
            </div>

            {data.valid && (
              <div className="rounded-md border p-4 bg-green-50 border-green-200">
                <div className="font-semibold text-green-800 mb-1">Detail Penandatanganan</div>
                <div className="text-sm text-green-800">Tanggal Tanda Tangan: {signedAtISO ?? '-'}</div>
                {data.verification?.timestamp_data && (
                  <div className="text-sm text-green-800">Timestamp (LTV): aktif</div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-600">
              Dokumen ini diterbitkan oleh sistem Laboratorium Kalibrasi BMKG. Keaslian diverifikasi melalui database internal dan proses TTE.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
