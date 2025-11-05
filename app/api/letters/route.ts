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
      .from('letter')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch letters' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { no_letter, instrument, owner, issue_date, inspection_result, authorized_by, approver_name, inspection_payload, verification } = body

    if (instrument) {
      const { data: inst, error: instErr } = await supabaseAdmin
        .from('instrument')
        .select('id')
        .eq('id', instrument)
        .single()
      if (instErr || !inst) return NextResponse.json({ error: 'Invalid instrument id' }, { status: 400 })
    }

    if (owner) {
      const { data: st, error: stErr } = await supabaseAdmin
        .from('station')
        .select('id')
        .eq('id', owner)
        .single()
      if (stErr || !st) return NextResponse.json({ error: 'Invalid owner (station) id' }, { status: 400 })
    }

    if (inspection_result) {
      const { data: insr, error: insrErr } = await supabaseAdmin
        .from('inspection_results')
        .select('id')
        .eq('id', inspection_result)
        .single()
      if (insrErr || !insr) return NextResponse.json({ error: 'Invalid inspection_result id' }, { status: 400 })
    }

    if (authorized_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', authorized_by)
        .single()
      if (pErr || !p) return NextResponse.json({ error: 'Invalid authorized_by (personel) id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('letter')
      .insert({ 
        no_letter, 
        instrument: instrument || null, 
        owner: owner || null, 
        issue_date: issue_date || null, 
        inspection_result: inspection_result || null, 
        authorized_by: authorized_by || null,
        approver_name: approver_name || null,
        inspection_payload: inspection_payload || null,
        verification: verification || null
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create letter' }, { status: 500 })
  }
}











