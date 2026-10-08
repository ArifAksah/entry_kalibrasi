'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { Spinner } from '../../components/ui/Loading'
import { CheckIcon, EditIcon, ViewIcon } from '../../components/ui/ActionIcons'
import Breadcrumb from '../../components/ui/Breadcrumb'
import { BatikBackground } from '../../components/ui/BatikBackground'

const PlusIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const LettersPage: React.FC = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letters, setLetters] = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [sendTarget, setSendTarget] = useState<any | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refreshLetters = async () => {
    const res = await fetch('/api/letters')
    const data = await res.json()
    if (res.ok) setLetters(Array.isArray(data) ? data : (data?.data ?? []))
  }

  const confirmSend = async () => {
    if (!sendTarget) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/letters/${sendTarget.id}/send-to-verifiers`, {
        method: 'POST',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal mengirim konsep Surat Keterangan')
      await refreshLetters()
      setNotice(`Konsep ${sendTarget.no_letter || `Surat #${sendTarget.id}`} berhasil dikirim ke verifikator.`)
      setSendTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim konsep Surat Keterangan')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const [lRes, iRes, sRes] = await Promise.all([
          fetch('/api/letters'),
          fetch('/api/instruments?page=1&pageSize=1000'),
          fetch('/api/stations?page=1&pageSize=1000'),
        ])
        const [lData, iData, sData] = await Promise.all([
          lRes.json(),
          iRes.json(),
          sRes.json(),
        ])
        if (!lRes.ok) throw new Error(lData?.error || 'Gagal memuat surat')
        setLetters(Array.isArray(lData) ? lData : (lData?.data ?? []))
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setStations(Array.isArray(sData) ? sData : (sData?.data ?? []))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const instrumentName = (id?: number | null) => {
    const i = instruments.find((x) => Number(x.id) === Number(id))
    return i ? (i.name_alias || i.type || i.name || `Instrumen #${id}`) : id ? `Instrumen #${id}` : '-'
  }
  const stationName = (id?: number | null) => {
    const s = stations.find((x) => Number(x.id) === Number(id))
    return s?.name || (id ? `Stasiun #${id}` : '-')
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 space-y-4">
            {notice && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice(null)} className="text-xs hover:underline">Tutup</button>
              </div>
            )}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 relative overflow-hidden z-0">
              <BatikBackground />
              <div className="relative z-[1] flex justify-between items-center">
                <div>
                  <Breadcrumb
                    items={[{ label: 'Documents', href: '#' }, { label: 'Surat Keterangan' }]}
                  />
                  <h1 className="mt-1 text-2xl font-bold text-gray-900">Surat Keterangan</h1>
                  <p className="text-sm text-gray-600">
                    Dokumen hasil pemeriksaan (Test Certificate) yang terikat pada Order &amp; Identifikasi yang sama dengan sertifikat.
                  </p>
                </div>
                <Link
                  href="/letters/new"
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1e377c] to-[#2a4a9d] px-4 py-2 text-sm text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:from-[#2a4a9d] hover:to-[#1e377c] hover:shadow-lg"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="font-semibold">Buat Surat Keterangan</span>
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">No. Surat / No. Order</th>
                      <th className="px-4 py-3">Instrumen</th>
                      <th className="px-4 py-3">Pemilik</th>
                      <th className="px-4 py-3">Tanggal Pemeriksaan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {letters.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{l.no_letter || '-'}</div>
                          <div className="text-xs text-gray-500">
                            {l.no_order || '-'}
                            {l.no_identification ? ` • ${l.no_identification}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">{instrumentName(l.instrument)}</td>
                        <td className="px-4 py-3">{stationName(l.owner)}</td>
                        <td className="px-4 py-3">{l.inspection_date || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                            {l.status || 'draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Lihat"
                              onClick={() => router.push(`/letters/${l.id}/view`)}
                              className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-blue-600 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                            >
                              <ViewIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => router.push(`/letters/${l.id}/edit`)}
                              className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-purple-600 transition-all duration-200 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-800"
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Cetak"
                              onClick={() => window.open(`/letters/${l.id}/print`, '_blank')}
                              className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-purple-600 transition-all duration-200 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-800"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                              </svg>
                            </button>
                            {l.pdf_path && (
                              <button
                                type="button"
                                title="Unduh PDF"
                                onClick={() => window.open(`/api/letters/${l.id}/pdf`, '_blank')}
                                className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-green-600 transition-all duration-200 hover:border-green-200 hover:bg-green-50 hover:text-green-800"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </button>
                            )}
                            {(l.status || 'draft') === 'draft' && (
                              <button
                                type="button"
                                title="Kirim Konsep"
                                onClick={() => setSendTarget(l)}
                                className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-emerald-600 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <CheckIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {letters.length === 0 && (
                  <div className="p-6 text-sm text-gray-500">Belum ada surat keterangan.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {sendTarget && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Kirim Konsep Surat Keterangan</h3>
            <p className="mt-2 text-sm text-gray-700">
              Kirim <span className="font-semibold">{sendTarget.no_letter || `Surat #${sendTarget.id}`}</span> ke
              verifikator untuk diperiksa?
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Setelah dikirim, hasil pemeriksaan akan <strong>dibekukan</strong> dan penugasan
              verifikator/penandatangan ikut terkunci. Perubahan hanya bisa lewat penolakan verifikator.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendTarget(null)}
                disabled={sending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmSend}
                disabled={sending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? 'Mengirim...' : 'Ya, Kirim Konsep'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

export default LettersPage
