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

    // Get verification status for each certificate (gracefully handle missing table)
    const certificateIds = data?.map(c => c.id) || []
    let verifications: Array<{ certificate_id: number; verification_level: number; status: string; certificate_version?: number }> = []

    if (certificateIds.length) {
      try {
        const { data: v, error: verifError } = await supabaseAdmin
          .from('certificate_verification')
          .select('certificate_id, verification_level, status, certificate_version')
          .in('certificate_id', certificateIds)

        if (!verifError && v) {
          verifications = v
        }
        // If the table doesn't exist yet or any error occurs, fall back to empty verifications
      } catch {}
    }

    // Combine certificates with verification status
    const certificatesWithStatus = (data || []).map(cert => {
      const certVersion = (cert as any).version ?? 1
      const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion)
      const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion)
      return {
        ...cert,
        verifikator_1_status: verif1?.status || 'pending',
        verifikator_2_status: verif2?.status || 'pending',
      }
    })

    return NextResponse.json(certificatesWithStatus)
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

    // Validate verifikator fields are required
    if (!verifikator_1 || !verifikator_2) {
      return NextResponse.json({
        error: 'Verifikator 1 and Verifikator 2 are required',
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

    // Debug logging for certificate creation
    console.log('=== Creating Certificate ===')
    console.log('Verifikator 1:', v1)
    console.log('Verifikator 2:', v2)
    console.log('Authorized By:', authorizedPersonId)
    console.log('============================')

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
        results: results ?? null,
        version: 1
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 })
  }
}
