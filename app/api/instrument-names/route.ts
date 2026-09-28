import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'
import { buildRepresentativeIdByCode } from '../../../lib/instrument-code-representative'

// Schema production: instrument_names(id, name, code_alat, created_at).
// Frontend lama mengharapkan field `instrument_code_id` + objek `instrument_code`.
// ID perwakilan kode = MIN(id) per code_alat (deterministik, konsisten dengan
// /api/instrument-code).
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

    // Ambil seluruh kode untuk menentukan MIN(id) per kode secara global,
    // bukan hanya dari hasil yang sedang difilter.
    const { data: allCodes } = await supabase
      .from('instrument_names')
      .select('id, code_alat')
      .not('code_alat', 'is', null)

    const representativeByCode = buildRepresentativeIdByCode(allCodes || [])

    const mapped = (data || []).map((item: any) => {
      const repId = item.code_alat ? representativeByCode.get(String(item.code_alat).trim()) ?? null : null
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
