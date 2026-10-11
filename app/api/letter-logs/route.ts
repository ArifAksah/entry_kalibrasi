import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientSafeMessage } from '../../../lib/api-error'

// Service role agar tidak terganjal RLS (dibaca dari server).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET - Log Surat Keterangan dengan pagination & filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const action = searchParams.get('action') || ''
    const letterId = searchParams.get('letter_id') || ''

    let query = supabaseAdmin.from('letter_logs').select('*', { count: 'exact' })

    if (action) query = query.eq('action', action)
    if (letterId) query = query.eq('letter_id', parseInt(letterId))
    if (search) {
      query = query.or(
        `performed_by_name.ilike.%${search}%,notes.ilike.%${search}%,approval_notes.ilike.%${search}%,rejection_reason.ilike.%${search}%`,
      )
    }

    const { count } = await query

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching letter logs:', error)
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    const totalItems = count || 0
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    return NextResponse.json({
      data: data || [],
      totalItems,
      totalPages,
      currentPage: page,
      pageSize,
    })
  } catch (e) {
    console.error('Unexpected error in GET /api/letter-logs:', e)
    return NextResponse.json({ error: 'Failed to fetch letter logs' }, { status: 500 })
  }
}
