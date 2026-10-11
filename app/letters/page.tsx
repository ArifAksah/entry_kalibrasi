'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

const STATUS_OPTIONS = ['draft', 'sent', 'verified', 'completed', 'rejected'] as const

const statusLabel = (status?: string | null) => {
  const key = (status || 'draft').toLowerCase()
  const map: Record<string, string> = {
    draft: 'Draft',
    sent: 'Dikirim',
    verified: 'Terverifikasi',
    completed: 'Selesai',
    rejected: 'Ditolak',
  }
  return map[key] || status || 'Draft'
}

const statusBadgeClass = (status?: string | null) => {
  const key = (status || 'draft').toLowerCase()
  if (key === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (key === 'verified') return 'bg-indigo-100 text-indigo-700'
  if (key === 'sent') return 'bg-blue-100 text-blue-700'
  if (key === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

const LettersPage: React.FC = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letters, setLetters] = useState<any[]>([])
  const [totalLetters, setTotalLetters] = useState(0)
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [sendTarget, setSendTarget] = useState<any | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Filter/pagination (server-side)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [actionOpenId, setActionOpenId] = useState<number | null>(null)
  const [actionMenuStyle, setActionMenuStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        status: statusFilter,
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/letters?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat surat')
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      setLetters(list)
      setTotalLetters(Number(data?.total ?? list.length))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter, page, pageSize])

  useEffect(() => {
    reload()
  }, [reload])

  // Debounce pencarian: tunda 350ms agar tidak fetch tiap ketikan.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Data pendukung untuk menampilkan nama instrumen/pemilik.
  useEffect(() => {
    const run = async () => {
      try {
        const [iRes, sRes] = await Promise.all([
          fetch('/api/instruments?page=1&pageSize=1000'),
          fetch('/api/stations?page=1&pageSize=1000'),
        ])
        const [iData, sData] = await Promise.all([iRes.json(), sRes.json()])
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setStations(Array.isArray(sData) ? sData : (sData?.data ?? []))
      } catch {
        /* abaikan: hanya untuk label */
      }
    }
    run()
  }, [])

  // Dropdown aksi per baris — dirender lewat portal agar tidak terpotong oleh
  // container tabel (auto-flip ke atas bila ruang bawah sempit).
  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, id: number) => {
    if (actionOpenId === id) {
      setActionOpenId(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 224
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 260 && rect.top > spaceBelow
    const style: React.CSSProperties = {
      position: 'fixed',
      width,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      zIndex: 9999,
    }
    if (openUp) {
      style.bottom = window.innerHeight - rect.top + 4
      style.maxHeight = Math.min(320, Math.max(120, rect.top - 8))
    } else {
      style.top = rect.bottom + 4
      style.maxHeight = Math.min(320, Math.max(120, spaceBelow - 8))
    }
    setActionMenuStyle(style)
    setActionOpenId(id)
  }

  useEffect(() => {
    if (actionOpenId == null) return
    const close = () => setActionOpenId(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [actionOpenId])

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
      await reload()
      setNotice(`Konsep ${sendTarget.no_letter || `Surat #${sendTarget.id}`} berhasil dikirim ke verifikator.`)
      setSendTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim konsep Surat Keterangan')
    } finally {
      setSending(false)
    }
  }

  const instrumentName = (id?: number | null) => {
    const i = instruments.find((x) => Number(x.id) === Number(id))
    return i ? (i.name_alias || i.type || i.name || `Instrumen #${id}`) : id ? `Instrumen #${id}` : '-'
  }
  const stationName = (id?: number | null) => {
    const s = stations.find((x) => Number(x.id) === Number(id))
    return s?.name || (id ? `Stasiun #${id}` : '-')
  }

  const totalPages = Math.max(1, Math.ceil(totalLetters / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageNumbers = useMemo(() => {
    const windowSize = 5
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2))
    const end = Math.min(totalPages, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    const nums: number[] = []
    for (let p = start; p <= end; p += 1) nums.push(p)
    return nums
  }, [currentPage, totalPages])

  const hasFilter = query.trim() !== '' || statusFilter !== 'all'

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

            {loading && letters.length === 0 ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-sm">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                      />
                    </svg>
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Cari no. surat / order / instrumen / pemilik..."
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/20"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      Status
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value)
                          setPage(1)
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-[#1e377c] focus:outline-none"
                      >
                        <option value="all">Semua</option>
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      Baris
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setPage(1)
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-[#1e377c] focus:outline-none"
                      >
                        {[10, 25, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto">
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
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(l.status)}`}
                            >
                              {statusLabel(l.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(event) => openActionMenu(event, l.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                actionOpenId === l.id
                                  ? 'border-[#1e377c] bg-[#1e377c] text-white'
                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              Aksi
                              <svg
                                className={`h-3.5 w-3.5 transition-transform ${actionOpenId === l.id ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {letters.length === 0 && (
                    <div className="p-6 text-sm text-gray-500">
                      {hasFilter
                        ? 'Tidak ada surat yang cocok dengan filter.'
                        : 'Belum ada surat keterangan.'}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-gray-500">
                    Menampilkan {totalLetters === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, totalLetters)} dari {totalLetters} surat
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                      ‹
                    </button>
                    {pageNumbers.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[34px] rounded-lg border px-3 py-1.5 text-sm ${
                          p === currentPage
                            ? 'border-[#1e377c] bg-[#1e377c] text-white'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mounted && actionOpenId != null && (() => {
        const target = letters.find((row) => row.id === actionOpenId)
        if (!target) return null
        const itemClass =
          'flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-gray-700 transition-colors'
        return createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActionOpenId(null)} />
            <div
              style={actionMenuStyle}
              className="flex flex-col overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  setActionOpenId(null)
                  router.push(`/letters/${target.id}/view`)
                }}
                className={`${itemClass} hover:bg-blue-50 hover:text-blue-700`}
              >
                <ViewIcon className="w-4 h-4 text-blue-600" />
                Lihat Surat
              </button>
              {(target.status || 'draft') === 'draft' && (
                <button
                  type="button"
                  onClick={() => {
                    setActionOpenId(null)
                    router.push(`/letters/${target.id}/edit`)
                  }}
                  className={`${itemClass} hover:bg-purple-50 hover:text-purple-700`}
                >
                  <EditIcon className="w-4 h-4 text-purple-600" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActionOpenId(null)
                  window.open(`/letters/${target.id}/print`, '_blank')
                }}
                className={`${itemClass} hover:bg-gray-50`}
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Cetak
              </button>
              {target.pdf_path && (
                <button
                  type="button"
                  onClick={() => {
                    setActionOpenId(null)
                    window.open(`/api/letters/${target.id}/pdf`, '_blank')
                  }}
                  className={`${itemClass} hover:bg-green-50 hover:text-green-700`}
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Unduh PDF
                </button>
              )}
              {(target.status || 'draft') === 'draft' && (
                <button
                  type="button"
                  onClick={() => {
                    setActionOpenId(null)
                    setSendTarget(target)
                  }}
                  className={`${itemClass} border-t border-gray-100 hover:bg-emerald-50 hover:text-emerald-700`}
                >
                  <CheckIcon className="w-4 h-4 text-emerald-600" />
                  Kirim Konsep
                </button>
              )}
            </div>
          </>,
          document.body,
        )
      })()}

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
