'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import bmkgLogo from '../../bmkg.png'

type LetterVerifyResponse = {
  valid: boolean
  pdf_url?: string | null
  source: { system: string; name: string; owner: string; statement: string }
  letter: {
    no_letter: string | null
    no_order?: string | null
    no_identification?: string | null
    issue_date?: string | null
    status?: string | null
    status_label?: string | null
    owner_name?: string | null
    instrument_name?: string | null
  }
  signature: {
    signed: boolean
    provider?: string | null
    signed_at?: string | null
    signer: { name: string } | null
  }
}

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
  }).format(date)
}

export default function PublicLetterVerificationPage() {
  const params = useParams()
  const publicId = params.public_id as string
  const [data, setData] = useState<LetterVerifyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!publicId) return
      try {
        const response = await fetch(`/api/public/letters/${publicId}`)
        const json = await response.json()
        if (!response.ok) throw new Error(json?.error || 'Surat Keterangan tidak ditemukan')
        setData(json)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Gagal memverifikasi')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [publicId])

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-white p-5 shadow">
          <Image src={bmkgLogo} alt="BMKG" width={56} height={56} />
          <div>
            <div className="text-lg font-bold text-slate-900">Verifikasi Surat Keterangan</div>
            <div className="text-sm text-slate-600">Laboratorium Kalibrasi BMKG</div>
          </div>
        </div>

        {loading && <div className="rounded-xl bg-white p-6 text-slate-600 shadow">Memeriksa dokumen…</div>}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 shadow">{error}</div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div
              className={`rounded-xl border p-5 shadow ${
                data.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <div className="text-lg font-bold">
                {data.valid ? 'Dokumen Sah' : 'Dokumen Belum Selesai'}
              </div>
              <div className="text-sm">{data.source.statement}</div>
              {data.pdf_url && (
                <a
                  href={data.pdf_url}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162a60]"
                >
                  Unduh PDF Bertanda Tangan
                </a>
              )}
            </div>

            <div className="rounded-xl bg-white p-5 shadow">
              <div className="mb-3 text-base font-bold text-slate-900">Data Surat Keterangan</div>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {[
                  ['Nomor', data.letter.no_letter || '-'],
                  ['No. Order', data.letter.no_order || '-'],
                  ['No. Identifikasi', data.letter.no_identification || '-'],
                  ['Tanggal Terbit', formatDate(data.letter.issue_date)],
                  ['Status', data.letter.status_label || '-'],
                  ['Pemilik', data.letter.owner_name || '-'],
                  ['Alat', data.letter.instrument_name || '-'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl bg-white p-5 shadow">
              <div className="mb-3 text-base font-bold text-slate-900">Tanda Tangan Elektronik</div>
              <div className="text-sm text-slate-700">
                <div>Ditandatangani: {data.signature.signed ? 'Ya' : 'Belum'}</div>
                <div>Penyedia: {data.signature.provider || '-'}</div>
                <div>Waktu: {formatDate(data.signature.signed_at, true)}</div>
                <div>Penandatangan: {data.signature.signer?.name || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
