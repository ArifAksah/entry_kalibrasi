import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client to bypass RLS and get all stations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(
  supabaseUrl!,
  serviceRoleKey!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    console.log('Starting to fetch all stations...')

    const pageSize = 1000
    const allStations: any[] = []
    let from = 0
    let totalCount: number | null = null

    while (true) {
      const { data, error, count } = await supabaseAdmin
        .from('station')
        .select('*', { count: totalCount === null ? 'exact' : undefined })
        .order('name', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Supabase error fetching all stations:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (totalCount === null) {
        totalCount = count ?? null
      }

      const batch = data || []
      allStations.push(...batch)

      if (batch.length < pageSize) break
      from += pageSize
    }

    console.log(`Successfully fetched ${allStations.length} stations (total count: ${totalCount ?? allStations.length})`)

    if (allStations.length > 0) {
      console.log('First 3 stations:', allStations.slice(0, 3).map(s => ({ id: s.id, name: s.name, station_id: s.station_id })))
    }

    return NextResponse.json(allStations)
  } catch (e) {
    console.error('Unexpected error in GET /api/stations/all:', e)
    return NextResponse.json({ error: 'Failed to fetch all stations' }, { status: 500 })
  }
}
