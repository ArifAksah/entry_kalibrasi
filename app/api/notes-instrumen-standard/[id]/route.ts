import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('notes_instrumen_standard')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { notes, instrumen_standard } = body as { notes?: number; instrumen_standard?: number }

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
      .update({ notes: notes || null, instrumen_standard: instrumen_standard || null })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('notes_instrumen_standard')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}












