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

type DashboardData = {
  role?: string
  title?: string
  subtitle?: string
  cards?: DashboardCard[]
  queue?: QueueItem[]
  actionItems?: ActionItem[]
  recentRejects?: RejectItem[]
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || !role) return

      try {
        setLoading(true)

        const { data: { session } } = await import('../../../lib/supabase').then((module) => module.supabase.auth.getSession())
        if (!session) {
          setError('No active session')
          return
        }

        const response = await fetch('/api/dashboard/role-based', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load dashboard data')
        }

        const data = await response.json()
        setDashboardData(data)
        setError(null)
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Failed to load dashboard data')
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Dashboard Personal</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">
          {dashboardData.title || 'Dashboard'}
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
