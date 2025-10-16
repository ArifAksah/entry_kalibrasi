import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    // Use admin client to bypass RLS so dropdowns can list personel
    const { data, error } = await supabaseAdmin
      .from('personel')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch personel' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, nip, position, phone, email } = body
    if (!id || !name || !email) {
      return NextResponse.json({ error: 'id, name and email are required' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('personel')
      .insert({ id, name, nip, position, phone, email })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create personel' }, { status: 500 })
  }
}