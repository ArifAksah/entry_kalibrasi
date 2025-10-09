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
      .from('insp_verified_person')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { result, verified_by } = body as { result?: number; verified_by?: string }
    if (!result || !verified_by) {
      return NextResponse.json({ error: 'result and verified_by are required' }, { status: 400 })
    }
    const { data: r, error: rErr } = await supabaseAdmin
      .from('inspection_results')
      .select('id')
      .eq('id', result)
      .single()
    if (rErr || !r) return NextResponse.json({ error: 'Invalid inspection_results id' }, { status: 400 })

    const { data: p, error: pErr } = await supabaseAdmin
      .from('personel')
      .select('id')
      .eq('id', verified_by)
      .single()
    if (pErr || !p) return NextResponse.json({ error: 'Invalid personel id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('insp_verified_person')
      .insert({ result, verified_by })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
  }
}


