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
    
    // Get all stations without pagination for assignment purposes
    const { data, error, count } = await supabaseAdmin
      .from('station')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error fetching all stations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`Successfully fetched ${data?.length || 0} stations (total count: ${count})`)
    
    // Log first few stations for debugging
    if (data && data.length > 0) {
      console.log('First 3 stations:', data.slice(0, 3).map(s => ({ id: s.id, name: s.name, station_id: s.station_id })))
    }

    return NextResponse.json(data || [])
  } catch (e) {
    console.error('Unexpected error in GET /api/stations/all:', e)
    return NextResponse.json({ error: 'Failed to fetch all stations' }, { status: 500 })
  }
}
