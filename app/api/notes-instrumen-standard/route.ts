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
      .from('notes_instrumen_standard')
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
    const { notes, instrumen_standard } = body as { notes?: number; instrumen_standard?: number }

    // Validate foreign keys
    if (notes) {
      const { data: n, error: nErr } = await supabaseAdmin
        .from('notes')
        .select('id')
        .eq('id', notes)
        .single()
      if (nErr || !n) return NextResponse.json({ error: 'Invalid notes id' }, { status: 400 })
    }
    if (instrumen_standard) {
      const { data: s, error: sErr } = await supabaseAdmin
        .from('sensor')
        .select('id')
        .eq('id', instrumen_standard)
        .single()
      if (sErr || !s) return NextResponse.json({ error: 'Invalid sensor id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('notes_instrumen_standard')
      .insert({ notes: notes || null, instrumen_standard: instrumen_standard || null })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
  }
}











