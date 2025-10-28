import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Support server-side search and pagination
    // Query params: q (string), page (number, default 1), pageSize (number, default 10)
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const requestedPageSize = parseInt(searchParams.get('pageSize') || '10', 10) || 10
    // Allow larger page sizes for assignment purposes
    const pageSize = requestedPageSize > 1000 ? requestedPageSize : Math.max(1, Math.min(1000, requestedPageSize))
    const search = (searchParams.get('q') || '').trim()

    const base = supabaseAdmin
      .from('station')
      .select('*', { count: 'exact' })

    const qb = search
      ? base.or(
          [
            `station_id.ilike.%${search}%`,
            `name.ilike.%${search}%`,
            `type.ilike.%${search}%`,
            `address.ilike.%${search}%`,
            `region.ilike.%${search}%`,
            `province.ilike.%${search}%`,
            `regency.ilike.%${search}%`,
          ].join(',')
        )
      : base

    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(start, end)

    if (error) {
      console.error('Error fetching stations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const total = count || 0
    console.log(`Fetched ${data?.length || 0} stations (page ${page}, pageSize ${pageSize}, total ${total})`)
    return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      station_id, 
      name, 
      address, 
      latitude, 
      longitude, 
      elevation, 
      time_zone, 
      region, 
      province, 
      regency,
      type
    } = body

    if (!station_id || !name || !address || !latitude || !longitude || !elevation || !time_zone || !region || !province || !regency || !type) {
      return NextResponse.json({
        error: 'All fields are required',
      }, { status: 400 })
    }

    // Validate that user exists in personel table
    const { data: personelData, error: personelError } = await supabaseAdmin
      .from('personel')
      .select('id')
      .eq('id', user.id)
      .single()

    if (personelError || !personelData) {
      return NextResponse.json({
        error: 'User not found in personel table. Please register first.',
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('station')
      .insert({ 
        station_id, 
        name, 
        address, 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude), 
        elevation: parseFloat(elevation), 
        time_zone, 
        region, 
        province, 
        regency,
        type, 
        created_by: user.id 
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create station' }, { status: 500 })
  }
}
