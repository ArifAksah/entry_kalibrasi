'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { Spinner } from '../../components/ui/Loading'
import { EditButton, ViewButton } from '../../components/ui/ActionIcons'

const LettersPage: React.FC = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letters, setLetters] = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Surat Keterangan</h1>
                <p className="text-sm text-gray-600">
                  Dokumen hasil pemeriksaan (Test Certificate) yang terikat pada Order &amp; Identifikasi yang sama dengan sertifikat.
                </p>
              </div>
              <Link
                href="/letters/new"
                className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90"
              >
                + Buat Surat Keterangan
              </Link>
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
                            <ViewButton
                              title="Lihat"
                              onClick={() => router.push(`/letters/${l.id}/view`)}
                            />
                            <EditButton
                              title="Edit"
                              onClick={() => router.push(`/letters/${l.id}/edit`)}
                            />
                            <button
                              type="button"
                              title="Cetak"
                              onClick={() => window.open(`/letters/${l.id}/print`, '_blank')}
                              className="inline-flex items-center rounded-lg border border-transparent p-1.5 text-indigo-600 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6z"
                                />
                              </svg>
                            </button>
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
    </ProtectedRoute>
  )
}

export default LettersPage
