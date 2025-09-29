import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('inspection_person')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch inspection_person' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { result, inspection_by } = body as { result?: number; inspection_by?: string }
    if (result) {
      const { data: r, error: rErr } = await supabaseAdmin
        .from('inspection_results')
        .select('id')
        .eq('id', result)
        .single()
      if (rErr || !r) return NextResponse.json({ error: 'Invalid inspection_result id' }, { status: 400 })
    }
    if (inspection_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', inspection_by)
        .single()
      if (pErr || !p) return NextResponse.json({ error: 'Invalid personel id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('inspection_person')
      .insert({ result: result || null, inspection_by: inspection_by || null })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create inspection_person' }, { status: 500 })
  }
}


