import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// GET - Get all notes
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      traceable_to_si_through,
      reference_document,
      calibration_methode,
      others
    } = body

    const { data, error } = await supabase
      .from('notes')
      .insert({
        traceable_to_si_through: traceable_to_si_through || null,
        reference_document: reference_document || null,
        calibration_methode: calibration_methode || null,
        others: others || null
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
