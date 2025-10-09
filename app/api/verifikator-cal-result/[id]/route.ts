import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET single
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('verifikator_cal_result')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch verifikator record' }, { status: 500 })
  }
}

// PUT update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { cal_result, verified_by } = body as { cal_result?: number; verified_by?: string }

    // Validate FKs when provided
    if (cal_result) {
    const { data: calData, error: calErr } = await supabaseAdmin
        .from('calibration_result')
        .select('id')
        .eq('id', cal_result)
        .single()
      if (calErr || !calData) {
        return NextResponse.json({ error: 'Invalid calibration_result id' }, { status: 400 })
      }
    }
    if (verified_by) {
      const { data: personelData, error: personelErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verified_by)
        .single()
      if (personelErr || !personelData) {
        return NextResponse.json({ error: 'Invalid personel id' }, { status: 400 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('verifikator_cal_result')
      .update({ cal_result, verified_by })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update verifikator record' }, { status: 500 })
  }
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('verifikator_cal_result')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete verifikator record' }, { status: 500 })
  }
}


