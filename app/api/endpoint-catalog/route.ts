import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from('endpoint_catalog').select('*').order('resource').order('method').order('path')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch endpoints' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, error } = await supabaseAdmin.from('endpoint_catalog').insert(body).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create endpoint' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    // support single or array
    const rows = Array.isArray(body) ? body : [body]
    const { data, error } = await supabaseAdmin.from('endpoint_catalog').upsert(rows, { onConflict: 'method,path' }).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to upsert endpoint' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabaseAdmin.from('endpoint_catalog').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ message: 'deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete endpoint' }, { status: 500 })
  }
}




