'use client'

import React, { useEffect, useState, useMemo } from 'react'
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

type ExpiringInstrumentItem = {
  id: number
  instrument_name: string
  instrument_code: string
  valid_from: string | null
  expires_at: string | null
  certificate_no: string
  certificate_order: string | null
  no_identification: string | null
  issue_date: string | null
  status: 'expired' | 'warning' | 'valid' | 'missing'
  days_remaining: number | null
  certificate_id?: number | null
}

type TrendPoint = {
  year: number
  correction: number | null
  uncertainty: number | null
}

type TrendSeries = {
  instrument_id: number
  instrument_name: string
  instrument_code: string
  points: TrendPoint[]
}

type UserStationDashboardData = {
  stationName: string
  stationCount: number
  totalInstruments: number
  validCertificates: number
  pendingCalibration: number
  activeInstruments: number
    expiringInstruments: ExpiringInstrumentItem[]
  trendSeries: TrendSeries[]
  stationAddress?: string
  stationRegion?: string
  stationWmoId?: string
  recentActivities?: ActivityItem[]
  verifikatorName?: string
  verifikatorContact?: string
}

type ActivityItem = {
  id: number
  type: string
  description: string
  timestamp: string
  link?: string
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
  stationDashboard?: UserStationDashboardData | null
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

const formatCompactDate = (value: string | null | undefined) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
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

const StationMetricCard: React.FC<{
  label: string
  value: number
  hint: string
  tone: 'blue' | 'green' | 'amber' | 'slate'
  icon: React.ReactNode
}> = ({ label, value, hint, tone, icon }) => {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900'
  }

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${classes[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <span className="rounded-lg bg-white/70 p-2">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs leading-relaxed opacity-80">{hint}</p>
    </div>
  )
}

const StatusPill: React.FC<{ status: ExpiringInstrumentItem['status'] }> = ({ status }) => {
  const label = status === 'expired'
    ? 'Expired'
    : status === 'warning'
      ? 'Segera Habis'
      : status === 'missing'
        ? 'Belum Ada'
        : 'Aktif'
  const className = status === 'expired'
    ? 'border-red-200 bg-red-50 text-red-700'
    : status === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'missing'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>
}

const StationTrendChart: React.FC<{ series: TrendSeries[] }> = ({ series }) => {
  const [selectedId, setSelectedId] = useState<number | null>(series[0]?.instrument_id ?? null)
  const selected = series.find((item) => item.instrument_id === selectedId) || series[0]

  useEffect(() => {
    if (!selectedId && series[0]) setSelectedId(series[0].instrument_id)
    if (selectedId && series.length > 0 && !series.some((item) => item.instrument_id === selectedId)) {
      setSelectedId(series[0].instrument_id)
    }
  }, [series, selectedId])

  if (!selected) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Belum ada data tren sertifikat standar.
      </div>
    )
  }

  const points = selected.points
  const values = points.flatMap((point) => [point.correction, point.uncertainty].filter((value): value is number => typeof value === 'number'))
  const dataMin = values.length > 0 ? Math.min(...values) : 0
  const dataMax = values.length > 0 ? Math.max(...values) : 1
  // Pad the range a little so the line isn't drawn flush against the chart edges.
  const spread = dataMax - dataMin
  const margin = spread > 0 ? spread * 0.15 : Math.max(Math.abs(dataMax), 1) * 0.15 || 1
  const min = dataMin - margin
  const max = dataMax + margin
  const range = max - min || 1
  const width = 560
  const height = 260
  const pad = 34
  const xFor = (index: number) => points.length <= 1 ? width / 2 : pad + (index * (width - pad * 2)) / (points.length - 1)
  const yFor = (value: number) => height - pad - ((value - min) / range) * (height - pad * 2)
  const buildPath = (key: 'correction' | 'uncertainty') => {
    let hasPoint = false
    return points
      .map((point, index) => {
        const value = point[key]
        if (typeof value !== 'number') return ''
        const command = hasPoint ? 'L' : 'M'
        hasPoint = true
        return `${command} ${xFor(index)} ${yFor(value)}`
      })
      .filter(Boolean)
      .join(' ')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Analisis Nilai Koreksi Instrumen</h3>
          <p className="mt-1 text-xs text-slate-500">Tren koreksi dan uncertainty dari sertifikat standar historis.</p>
        </div>
        <select
          value={selected.instrument_id}
          onChange={(event) => setSelectedId(Number(event.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
        >
          {series.map((item) => (
            <option key={item.instrument_id} value={item.instrument_id}>
              {item.instrument_name}
            </option>
          ))}
        </select>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad + ratio * (height - pad * 2)
          const label = max - ratio * range
          return (
            <g key={ratio}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={4} y={y + 4} fontSize="10" fill="#64748b">{label.toFixed(2)}</text>
            </g>
          )
        })}
        <path d={buildPath('correction')} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildPath('uncertainty')} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.year}>
            {typeof point.correction === 'number' && <circle cx={xFor(index)} cy={yFor(point.correction)} r="4" fill="#2563eb" />}
            {typeof point.uncertainty === 'number' && <circle cx={xFor(index)} cy={yFor(point.uncertainty)} r="4" fill="#f59e0b" />}
            <text x={xFor(index)} y={height - 8} textAnchor="middle" fontSize="11" fill="#475569">{point.year}</text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Koreksi</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Uncertainty</span>
      </div>
    </div>
  )
}

const ActivityIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconClasses: Record<string, string> = {
    certificate: 'bg-blue-100 text-blue-600',
    instrument: 'bg-purple-100 text-purple-600',
    calibration: 'bg-green-100 text-green-600',
    verification: 'bg-amber-100 text-amber-600'
  }

  const icons: Record<string, React.ReactNode> = {
    certificate: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    instrument: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M4 9h16M6 5h12a2 2 0 012 2v12H4V7a2 2 0 012-2z" />
      </svg>
    ),
    calibration: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    verification: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  }

  return (
    <div className={`rounded-lg p-2 ${iconClasses[type] || iconClasses.certificate}`}>
      {icons[type] || icons.certificate}
    </div>
  )
}

const exportToCSV = (data: ExpiringInstrumentItem[], filename: string) => {
  const headers = ['Nama Alat', 'Kode Alat', 'Identifikasi', 'Mulai Berlaku', 'Tanggal Berakhir', 'Status', 'Sisa Hari', 'No. Sertifikat']
  const rows = data.map(item => [
    item.instrument_name,
    item.instrument_code,
    item.no_identification || '-',
    item.valid_from || '-',
    item.expires_at || '-',
    item.status,
    item.days_remaining?.toString() || '-',
    item.certificate_no
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

const UserStationDashboard: React.FC<{
  data: UserStationDashboardData
  greeting: string
  displayName: string
}> = ({ data, greeting, displayName }) => {
  // State for filters and search
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'warning' | 'valid'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Filtered instruments
  const filteredInstruments = useMemo(() => {
    return data.expiringInstruments.filter(item => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesSearch = searchTerm === '' || 
        item.instrument_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.instrument_code.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [data.expiringInstruments, statusFilter, searchTerm])
  
  // Count expired instruments
  const expiredCount = data.expiringInstruments.filter(i => i.status === 'expired').length
  const warningCount = data.expiringInstruments.filter(i => i.status === 'warning').length
  
  // Recent activities (mock if not available)
  const recentActivities = data.recentActivities || [
    { id: 1, type: 'certificate' as const, description: 'Sertifikat kalibrasi diterbitkan', timestamp: 'Baru saja', link: '/certificates' },
    { id: 2, type: 'instrument' as const, description: 'Data instrumen diperbarui', timestamp: '1 jam yang lalu', link: '/instruments' },
    { id: 3, type: 'calibration' as const, description: 'Kalibrasi selesai dilakukan', timestamp: '2 jam yang lalu', link: '/calibration-results' },
  ]

  return (
  <div className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ringkasan Kerja</p>
          <h2 className="mt-3 text-xl font-bold text-slate-950">{greeting}, {displayName}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pantau status operasional peralatan dan ketersediaan dokumen sertifikat di {data.stationName}.
          </p>
      
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 mt-5">
            <a
              href="/certificates"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1e377c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#162c63] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Buat Sertifikat Baru
            </a>
            <a
              href="/instruments"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lihat Semua Instrumen
            </a>
            <a
              href="/calibration-results"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Hasil Kalibrasi
            </a>
            <button
              onClick={() => exportToCSV(filteredInstruments, 'instrumen_jatuh_tempo')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </section>
    
        {/* Alert Banner for Expired Instruments */}
        {expiredCount > 0 && (
          <section className="rounded-xl border-2 border-red-300 bg-red-50 p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 rounded-full bg-red-100 p-2">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">
                  {expiredCount} Instrumen Sudah Expired!
                </p>
                <p className="text-sm text-red-600">
                  Segera ajukan kalibrasi ulang untuk menghindari gangguan operasional.
                </p>
              </div>
              <a
                href="/certificates"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                Ajukan Sekarang
              </a>
            </div>
          </section>
        )}

    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StationMetricCard
        label="Total Instrumen Terdaftar"
        value={data.totalInstruments}
        hint="Jumlah total alat yang ada di stasiun tugas Anda."
        tone="blue"
        icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" /></svg>}
      />
      <StationMetricCard
        label="Masa Berlaku Valid"
        value={data.validCertificates}
        hint="Instrumen dengan sertifikat kalibrasi yang masih berlaku."
        tone="green"
        icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
      />
      <StationMetricCard
        label="Menunggu Kalibrasi"
        value={data.pendingCalibration}
        hint="Sertifikat habis atau mendekati jatuh tempo dalam 30 hari."
        tone="amber"
        icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
      <StationMetricCard
        label="Instrumen Aktif"
        value={data.activeInstruments}
        hint="Instrumen terdaftar di sistem untuk stasiun tugas."
        tone="slate"
        icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M4 9h16M6 5h12a2 2 0 012 2v12H4V7a2 2 0 012-2z" /></svg>}
      />
    </section>

    {/* Station Info & Recent Activity */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          {/* Station Information Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-5 w-5 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-base font-semibold text-slate-950">Informasi Stasiun</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Nama Stasiun</span>
                <span className="text-sm font-semibold text-slate-900">{data.stationName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Jumlah Stasiun</span>
                <span className="text-sm font-semibold text-slate-900">{data.stationCount}</span>
              </div>
              {data.stationWmoId && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">WMO ID</span>
                  <span className="text-sm font-semibold text-slate-900">{data.stationWmoId}</span>
                </div>
              )}
              {data.stationRegion && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Wilayah</span>
                  <span className="text-sm font-semibold text-slate-900">{data.stationRegion}</span>
                </div>
              )}
              {data.stationAddress && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Alamat</span>
                  <span className="text-sm font-semibold text-slate-900 text-right max-w-[200px] truncate">{data.stationAddress}</span>
                </div>
              )}
              {data.verifikatorName && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">Verifikator</span>
                  <span className="text-sm font-semibold text-slate-900">{data.verifikatorName}</span>
                </div>
              )}
            </div>
            <a
              href="/stations"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e377c] hover:text-[#162c63] transition-colors"
            >
              Kelola Stasiun
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-5 w-5 text-[#1e377c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-950">Aktivitas Terbaru</h3>
            </div>
            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Belum ada aktivitas terbaru.</p>
              ) : (
                recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <ActivityIcon type={activity.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">{activity.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{activity.timestamp}</p>
                    </div>
                    {activity.link && (
                      <a
                        href={activity.link}
                        className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Lihat
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Trend Chart & Expiring Instruments Table */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
                  <h3 className="text-base font-semibold text-slate-950">Sertifikat UUT Akan Jatuh Tempo</h3>
                  <p className="mt-1 text-xs text-slate-500">Daftar sertifikat UUT dengan masa berlaku terdekat. Gunakan filter untuk mempermudah pencarian.</p>
                </div>

                {/* Filter & Search */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Cari nama alat atau kode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-[#1e377c] focus:ring-2 focus:ring-[#1e377c]/20"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e377c] focus:ring-2 focus:ring-[#1e377c]/20"
                  >
                    <option value="all">Semua Status</option>
                    <option value="expired">Expired ({expiredCount})</option>
                    <option value="warning">Segera Habis ({warningCount})</option>
                    <option value="valid">Aktif</option>
                    <option value="missing">Belum Ada</option>
                  </select>
                  {(searchTerm || statusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setStatusFilter('all')
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reset
                    </button>
                  )}
                </div>

                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Nama Alat</th>
                <th className="px-4 py-3 font-semibold">Kode Alat</th>
                <th className="px-4 py-3 font-semibold">Identifikasi</th>
                <th className="px-4 py-3 font-semibold">Mulai Berlaku</th>
                <th className="px-4 py-3 font-semibold">Tanggal Berakhir</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Sertifikat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expiringInstruments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Tidak ada data sertifikat UUT untuk ditampilkan.
                  </td>
                </tr>
              ) : (
                filteredInstruments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.instrument_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.instrument_code}</td>
                    <td className="px-4 py-3 text-slate-600">{item.no_identification || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatCompactDate(item.valid_from)}</div>
                      {item.issue_date && (
                        <div className="mt-0.5 text-[11px] text-slate-400">Terbit {formatCompactDate(item.issue_date)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatCompactDate(item.expires_at)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                      {item.days_remaining != null && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} hari lewat` : `${item.days_remaining} hari lagi`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.certificate_no !== '-' ? (
                        <a
                          href={item.certificate_id ? `/certificates/${item.certificate_id}/view` : '/certificates'}
                          className="inline-flex flex-col items-end justify-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          <span className="max-w-[150px] truncate">{item.certificate_no}</span>
                          {item.certificate_order && (
                            <span className="max-w-[150px] truncate font-normal text-slate-500">{item.certificate_order}</span>
                          )}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Gunakan menu Instrumen untuk melihat detail sensor dan memperbarui sertifikat standar.</p>
      </div>

      <div className="rounded-xl border border-cyan-200 bg-white p-5 shadow-sm">
        <StationTrendChart series={data.trendSeries} />
            </div>
    </section>
  </div>
  )
}

const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth()
  const { role, loading: permissionsLoading } = usePermissions()
  const [dashboardData, setDashboardData] = useState<DashboardData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const greeting = getGreetingByHour(new Date())
  const displayName = getDisplayName(user?.email)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return
      // Wait for permissions to finish loading before fetching dashboard
      if (permissionsLoading) return

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
  }, [user, role, permissionsLoading])

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

  if (dashboardData.role === 'user_station' && dashboardData.stationDashboard) {
    return (
      <UserStationDashboard
        data={dashboardData.stationDashboard}
        greeting={greeting}
        displayName={displayName}
      />
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
