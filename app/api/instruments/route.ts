import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10', 10) || 10))
    const q = (searchParams.get('q') || '').trim()

    const base = supabaseAdmin
      .from('instrument')
      .select('*', { count: 'exact' })

    const qb = q
      ? base.or([
          `manufacturer.ilike.%${q}%`,
          `type.ilike.%${q}%`,
          `serial_number.ilike.%${q}%`,
          `name.ilike.%${q}%`,
          `others.ilike.%${q}%`,
        ].join(','))
      : base

    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(start, end)

    if (error) {
      const msg = (error as any)?.message || ''
      const code = (error as any)?.code || ''
      if (code === '42P01' || /relation .* does not exist/i.test(msg) || /permission denied/i.test(msg)) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 1 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const total = count || 0
    return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch instruments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { manufacturer, type, serial_number, others, name } = body

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({
        error: 'Manufacturer, type, serial number, and name are required',
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('instrument')
      .insert({ manufacturer, type, serial_number, others, name })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create instrument' }, { status: 500 })
  }
}







