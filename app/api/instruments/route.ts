import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('instrument')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      const msg = (error as any)?.message || ''
      const code = (error as any)?.code || ''
      if (code === '42P01' || /relation .* does not exist/i.test(msg) || /permission denied/i.test(msg)) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create instrument' }, { status: 500 })
  }
}







