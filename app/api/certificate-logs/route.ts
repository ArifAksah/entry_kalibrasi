import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client to avoid RLS issues on server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET - Get certificate logs with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const action = searchParams.get('action') || ''
    const certificateId = searchParams.get('certificate_id') || ''

    // Build query
    let query = supabaseAdmin
      .from('certificate_logs')
      .select('*', { count: 'exact' })

    // Apply filters
    if (action) {
      query = query.eq('action', action)
    }

    if (certificateId) {
      query = query.eq('certificate_id', parseInt(certificateId))
    }

    if (search) {
      query = query.or(`performed_by_name.ilike.%${search}%,notes.ilike.%${search}%,approval_notes.ilike.%${search}%,rejection_reason.ilike.%${search}%`)
    }

    // Get total count
    const { count } = await query

    // Apply pagination and ordering
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching certificate logs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const totalItems = count || 0
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    return NextResponse.json({
      data: data || [],
      totalItems,
      totalPages,
      currentPage: page,
      pageSize
    })
  } catch (e) {
    console.error('Unexpected error in GET /api/certificate-logs:', e)
    return NextResponse.json({ error: 'Failed to fetch certificate logs' }, { status: 500 })
  }
}

