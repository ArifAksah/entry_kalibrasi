import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Service role client to bypass RLS for validation and writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)

// GET - All verifikator_cal_result
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('verifikator_cal_result')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch verifikator records' }, { status: 500 })
  }
}

// POST - Create
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cal_result, verified_by } = body as { cal_result?: number; verified_by?: string }

    if (!cal_result || !verified_by) {
      return NextResponse.json({ error: 'cal_result and verified_by are required' }, { status: 400 })
    }

    // Validate FK calibration_result
    const { data: calData, error: calErr } = await supabaseAdmin
      .from('calibration_result')
      .select('id')
      .eq('id', cal_result)
      .single()
    if (calErr || !calData) {
      return NextResponse.json({ error: 'Invalid calibration_result id' }, { status: 400 })
    }

    // Validate FK personel
    const { data: personelData, error: personelErr } = await supabaseAdmin
      .from('personel')
      .select('id')
      .eq('id', verified_by)
      .single()
    if (personelErr || !personelData) {
      return NextResponse.json({ error: 'Invalid personel id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('verifikator_cal_result')
      .insert({ cal_result, verified_by })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create verifikator record' }, { status: 500 })
  }
}


