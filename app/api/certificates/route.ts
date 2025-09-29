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
    const { data, error } = await supabaseAdmin
      .from('certificate')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { 
      no_certificate, 
      no_order, 
      no_identification, 
      issue_date, 
      station, 
      instrument,
      authorized_by,
      verifikator_1,
      verifikator_2,
      results
    } = body

    if (!no_certificate || !no_order || !no_identification || !issue_date) {
      return NextResponse.json({
        error: 'Certificate number, order number, identification number, and issue date are required',
      }, { status: 400 })
    }

    // Validate station foreign key if provided
    if (station) {
      const { data: stationData, error: stationError } = await supabaseAdmin
        .from('station')
        .select('id')
        .eq('id', station)
        .single()

      if (stationError || !stationData) {
        return NextResponse.json({
          error: 'Station does not exist. Please select a valid station.',
        }, { status: 400 })
      }
    }

    // Validate instrument foreign key if provided
    if (instrument) {
      const { data: instrumentData, error: instrumentError } = await supabaseAdmin
        .from('instrument')
        .select('id')
        .eq('id', instrument)
        .single()

      if (instrumentError || !instrumentData) {
        return NextResponse.json({
          error: 'Instrument does not exist. Please select a valid instrument.',
        }, { status: 400 })
      }
    }

    // Validate authorized_by (personel) if provided; else default to user.id
    let authorizedPersonId: string = user.id
    if (authorized_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', authorized_by)
        .single()
      if (pErr || !p) {
        return NextResponse.json({ error: 'Invalid authorized_by (personel) id' }, { status: 400 })
      }
      authorizedPersonId = authorized_by
    }

    // Validate verifikator_1 if provided
    let v1: string | null = null
    if (verifikator_1) {
      const { data: p1, error: p1Err } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verifikator_1)
        .single()
      if (p1Err || !p1) {
        return NextResponse.json({ error: 'Invalid verifikator_1 (personel) id' }, { status: 400 })
      }
      v1 = verifikator_1
    }

    // Validate verifikator_2 if provided
    let v2: string | null = null
    if (verifikator_2) {
      const { data: p2, error: p2Err } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verifikator_2)
        .single()
      if (p2Err || !p2) {
        return NextResponse.json({ error: 'Invalid verifikator_2 (personel) id' }, { status: 400 })
      }
      v2 = verifikator_2
    }

    const { data, error } = await supabaseAdmin
      .from('certificate')
      .insert({ 
        no_certificate, 
        no_order, 
        no_identification, 
        authorized_by: authorizedPersonId, 
        verifikator_1: v1, 
        verifikator_2: v2, 
        issue_date, 
        station: station ? parseInt(station) : null, 
        instrument: instrument ? parseInt(instrument) : null,
        results: results ?? null
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 })
  }
}
