import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)

type CertRow = { id: number; issue_date: string | null; no_certificate?: string | null }

export async function GET() {
  try {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [sensorsCntRes, stationsCntRes, certsTotalRes, certsRowsRes, recentCertsRes, calResultsCntRes] = await Promise.all([
      supabaseAdmin.from('sensor').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('station').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('certificate').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('certificate')
        .select('id, issue_date')
        .gte('issue_date', twelveMonthsAgo.toISOString()),
      supabaseAdmin
        .from('certificate')
        .select('id, no_certificate, issue_date')
        .order('issue_date', { ascending: false })
        .limit(5),
      supabaseAdmin.from('calibration_result').select('id', { count: 'exact', head: true }),
    ])

    const sensorsCount = sensorsCntRes.count || 0
    const stationsCount = stationsCntRes.count || 0
    const certificatesTotal = certsTotalRes.count || 0
    const calibrationResultsTotal = calResultsCntRes.count || 0

    const certRows: CertRow[] = Array.isArray(certsRowsRes.data) ? (certsRowsRes.data as CertRow[]) : []

    // Build month keys for last 12 months
    const monthKeys: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthKeys.push(key)
    }

    const byMonth: Record<string, number> = monthKeys.reduce((acc, k) => {
      acc[k] = 0
      return acc
    }, {} as Record<string, number>)

    for (const row of certRows) {
      if (!row.issue_date) continue
      const d = new Date(row.issue_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key in byMonth) byMonth[key] += 1
    }

    const timeseries = monthKeys.map((k) => ({ month: k, count: byMonth[k] }))

    const thisMonthKey = `${startOfThisMonth.getFullYear()}-${String(startOfThisMonth.getMonth() + 1).padStart(2, '0')}`
    const lastMonthKey = `${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, '0')}`

    const certsThisMonth = byMonth[thisMonthKey] || 0
    const certsLastMonth = byMonth[lastMonthKey] || 0
    const certsChangePct = certsLastMonth === 0 ? (certsThisMonth > 0 ? 100 : 0) : Math.round(((certsThisMonth - certsLastMonth) / certsLastMonth) * 100)

    const recentCertificates = Array.isArray(recentCertsRes.data) ? recentCertsRes.data : []

    return NextResponse.json({
      totals: {
        sensors: sensorsCount,
        stations: stationsCount,
        certificates: certificatesTotal,
        calibration_results: calibrationResultsTotal,
      },
      certificates: {
        thisMonth: certsThisMonth,
        lastMonth: certsLastMonth,
        changePercent: certsChangePct,
        timeseries,
        recent: recentCertificates,
      },
      period: {
        start: twelveMonthsAgo.toISOString(),
        end: now.toISOString(),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to build dashboard summary' }, { status: 500 })
  }
}









