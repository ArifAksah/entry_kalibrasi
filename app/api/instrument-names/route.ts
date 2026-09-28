import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'

// Schema production: instrument_names(id, name, code_alat, created_at).
// Frontend lama mengharapkan field `instrument_code_id` + objek `instrument_code`.
// Kita petakan secara virtual: id perwakilan = id instrument_names pertama pada
// kelompok code_alat yang sama.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codeId = searchParams.get('instrument_code_id')

    let filterCode: string | null = null
    if (codeId) {
      const { data } = await supabase
        .from('instrument_names')
        .select('code_alat')
        .eq('id', codeId)
        .maybeSingle()
      filterCode = data?.code_alat || null
    }

    let query = supabase
      .from('instrument_names')
      .select('id, name, code_alat, created_at')
      .order('name', { ascending: true })

    if (filterCode) query = query.eq('code_alat', filterCode)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    const representativeByCode = new Map<string, number>()
    for (const item of data || []) {
      if (item.code_alat && !representativeByCode.has(item.code_alat)) {
        representativeByCode.set(item.code_alat, Number(item.id))
      }
    }

    const mapped = (data || []).map((item: any) => {
      const repId = item.code_alat ? representativeByCode.get(item.code_alat) ?? null : null
      return {
        id: item.id,
        name: item.name,
        code_alat: item.code_alat,
        instrument_code_id: repId,
        instrument_code_name: item.code_alat,
        instrument_code: item.code_alat
          ? { id: repId, code_alat: item.code_alat }
          : null,
        created_at: item.created_at,
      }
    })

    return NextResponse.json(mapped)
  } catch (error: any) {
    console.error('Error in GET /api/instrument-names:', error)
    return NextResponse.json(
      { error: clientSafeMessage(error, 'Failed to fetch instrument names') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const body = await request.json()
    const { name, names, code_alat, instrument_code_id } = body

    const nameValue = names || name
    if (!nameValue) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Resolve kode dari salah satu sumber.
    let resolvedCode: string | null = code_alat ?? null
    if (!resolvedCode && instrument_code_id) {
      const { data } = await supabase
        .from('instrument_names')
        .select('code_alat')
        .eq('id', instrument_code_id)
        .maybeSingle()
      resolvedCode = data?.code_alat ?? null
    }

    const { data, error } = await supabase
      .from('instrument_names')
      .insert({ name: nameValue, code_alat: resolvedCode })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    return NextResponse.json(
      { ...data, name: data.name, code_alat: data.code_alat },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create instrument name' },
      { status: 500 },
    )
  }
}
