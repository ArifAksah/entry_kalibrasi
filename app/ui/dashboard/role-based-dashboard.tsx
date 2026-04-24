'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { usePermissions } from '../../../hooks/usePermissions'

type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

type DashboardCard = {
  label: string
  value: number
  hint: string
  tone: Tone
}

type QueueItem = {
  label: string
  value: number
}

type ActionItem = {
  id: number
  no_certificate: string
  subtitle: string
  status: string
  href: string
  priority?: 'high' | 'medium' | 'low'
}

type RejectItem = {
  id: number
  no_certificate: string
  category: string
  level: string
  reason: string
  timestamp: string | null
}

type StationSummary = {
  id: number
  name: string
  station_wmo_id: string | null
  address: string | null
  region: string | null
  province: string | null
  regency: string | null
  instrument_count: number
  certificate_count: number
  draft_count: number
  completed_count: number
}

type DashboardData = {
  role?: string
  title?: string
  subtitle?: string
  cards?: DashboardCard[]
  queue?: QueueItem[]
  actionItems?: ActionItem[]
  recentRejects?: RejectItem[]
  stations?: StationSummary[]
}

const toneClasses: Record<Tone, string> = {
  slate: 'bg-slate-50 border-slate-200 text-slate-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  purple: 'bg-purple-50 border-purple-200 text-purple-900'
}

const priorityClasses = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200'
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID')
}

const getGreetingByHour = (date: Date) => {
  const hour = date.getHours()

  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const getDisplayName = (email?: string | null) => {
  if (!email) return 'Pengguna'

  const baseName = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!baseName) return 'Pengguna'

  return baseName
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
)

const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth()
  const { role } = usePermissions()
  const [dashboardData, setDashboardData] = useState<DashboardData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const greeting = getGreetingByHour(new Date())
  const displayName = getDisplayName(user?.email)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || !role) return

      try {
        setLoading(true)

        const { data: { session } } = await import('../../../lib/supabase').then((module) => module.supabase.auth.getSession())
        if (!session) {
          setError('Sesi aktif tidak ditemukan')
          return
        }

        const response = await fetch('/api/dashboard/role-based', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Gagal memuat data dashboard')
        }

        const data = await response.json()
        setDashboardData(data)
        setError(null)
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Gagal memuat data dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, role])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-slate-100 p-8 animate-pulse">
          <div className="h-5 w-48 rounded bg-slate-200"></div>
          <div className="mt-3 h-4 w-80 rounded bg-slate-200"></div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
              <div className="h-4 w-24 rounded bg-slate-200"></div>
              <div className="mt-3 h-9 w-16 rounded bg-slate-200"></div>
              <div className="mt-3 h-3 w-32 rounded bg-slate-200"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ringkasan Kerja</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">
          {greeting}, {displayName}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {dashboardData.subtitle || 'Ringkasan informasi yang paling relevan untuk akun Anda.'}
        </p>
      </section>

      {(dashboardData.cards || []).length > 0 && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(dashboardData.cards || []).map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border p-6 shadow-sm ${toneClasses[card.tone]}`}
            >
              <p className="text-sm font-medium opacity-80">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              <p className="mt-3 text-sm opacity-75">{card.hint}</p>
            </div>
          ))}
        </section>
      )}

      {dashboardData.role === 'user_station' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Stasiun Saya</h3>
              <p className="mt-1 text-sm text-slate-500">
                Daftar stasiun yang ditugaskan kepada akun Anda beserta ringkasan instrumen dan sertifikatnya.
              </p>
            </div>
            <a
              href="/stations"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
            >
              Kelola Stasiun
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {(dashboardData.stations || []).length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="Belum ada stasiun yang ditugaskan"
                description="Akun Anda belum memiliki stasiun tugas. Hubungi admin untuk meminta penugasan stasiun."
              />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(dashboardData.stations || []).map((station) => {
                const locationParts = [station.regency, station.province].filter(Boolean) as string[]
                return (
                  <div
                    key={station.id}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{station.name}</p>
                        {station.station_wmo_id && (
                          <p className="mt-1 text-xs text-slate-500">WMO ID: {station.station_wmo_id}</p>
                        )}
                        {locationParts.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">{locationParts.join(', ')}</p>
                        )}
                        {station.region && (
                          <span className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {station.region}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                        <p className="text-[11px] font-medium text-slate-500">Instrumen</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{station.instrument_count}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                        <p className="text-[11px] font-medium text-slate-500">Sertifikat</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{station.certificate_count}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                        <p className="text-[11px] font-medium text-slate-500">Draft</p>
                        <p className="mt-1 text-lg font-semibold text-amber-700">{station.draft_count}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Selesai: <span className="font-semibold text-green-700">{station.completed_count}</span>
                      </span>
                      <a
                        href={`/certificates?station=${station.id}`}
                        className="inline-flex items-center gap-1 text-slate-600 transition-colors group-hover:text-blue-600"
                      >
                        Detail
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Butuh Aksi Saya</h3>
              <p className="mt-1 text-sm text-slate-500">Daftar pekerjaan yang paling relevan untuk dilanjutkan.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(dashboardData.actionItems || []).length === 0 ? (
              <EmptyState
                title="Belum ada pekerjaan prioritas"
                description="Saat ini tidak ada item yang membutuhkan aksi langsung dari akun ini."
              />
            ) : (
              (dashboardData.actionItems || []).map((item) => (
                <a
                  key={`${item.id}-${item.no_certificate}`}
                  href={item.href}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.no_certificate}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {item.status}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityClasses[item.priority || 'low']}`}>
                      {item.priority === 'high' ? 'Prioritas tinggi' : item.priority === 'medium' ? 'Prioritas sedang' : 'Prioritas rendah'}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Antrean Tahap</h3>
            <p className="mt-1 text-sm text-slate-500">Distribusi pekerjaan pada tahap yang paling relevan.</p>
            <div className="mt-5 space-y-3">
              {(dashboardData.queue || []).length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada antrean yang perlu ditampilkan.</p>
              ) : (
                (dashboardData.queue || []).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="text-lg font-semibold text-slate-950">{item.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Ringkasan Reject</h3>
            <p className="mt-1 text-sm text-slate-500">Riwayat penolakan terbaru yang perlu dipantau.</p>
            <div className="mt-5 space-y-4">
              {(dashboardData.recentRejects || []).length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada riwayat reject terbaru.</p>
              ) : (
                (dashboardData.recentRejects || []).map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
                      {index < (dashboardData.recentRejects || []).length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-red-200"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.no_certificate}</p>
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.level} • {formatDateTime(item.timestamp)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3">{item.reason}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RoleBasedDashboard
