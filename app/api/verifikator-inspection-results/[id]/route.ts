import { NextRequest, NextResponse } from 'next/server'
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
    const { data, error } = await supabaseAdmin
      .from('insp_verified_person')
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
    const { result, verified_by } = body as { result?: number; verified_by?: string }

    if (result) {
      const { data: r, error: rErr } = await supabaseAdmin
        .from('inspection_results')
        .select('id')
        .eq('id', result)
        .single()
      if (rErr || !r) return NextResponse.json({ error: 'Invalid inspection_results id' }, { status: 400 })
    }
    if (verified_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verified_by)
        .single()
      if (pErr || !p) return NextResponse.json({ error: 'Invalid personel id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('insp_verified_person')
      .update({ result, verified_by })
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
      .from('insp_verified_person')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}


