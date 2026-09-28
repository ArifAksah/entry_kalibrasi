import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'
import { buildRepresentativeIdByCode } from '../../../lib/instrument-code-representative'
import {
  INSTRUMENT_NAME_TEXT_COLUMNS,
  isMissingColumnError,
  normalizeInstrumentNameRow,
} from '../../../lib/instrument-names-schema'

// Kompatibel dua schema: sebagian deployment punya kolom `name`, sebagian `names`.
// Frontend lama mengharapkan field `instrument_code_id` + objek `instrument_code`.
// ID perwakilan kode = MIN(id) per code_alat (deterministik, konsisten dengan
// /api/instrument-code).

/** Ambil daftar nama dari instrument_names, fallback kolom teks yang tersedia. */
async function fetchInstrumentNames(
  selectColumns: 'code_alat' | 'full',
  filterCode?: string | null,
) {
  for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
    const columns =
      selectColumns === 'full'
        ? `id, ${textCol}, code_alat, created_at`
        : `id, ${textCol}, code_alat`

    let query = supabase.from('instrument_names').select(columns)
    if (selectColumns === 'full') query = query.order(textCol, { ascending: true })
    if (filterCode) query = query.eq('code_alat', filterCode)

    const { data, error } = await query
    if (!error) {
      return {
        rows: (data || []).map((row: any) => normalizeInstrumentNameRow(row)),
        textColumn: textCol,
        error: null as null,
      }
    }
    if (!isMissingColumnError(error, textCol)) {
      return { rows: [], textColumn: textCol, error }
    }
    // kolom tidak ada → coba nama kolom berikutnya
  }
  return { rows: [], textColumn: 'name', error: { message: 'instrument_names tidak punya kolom teks nama' } }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codeId = searchParams.get('instrument_code_id')

    let filterCode: string | null = null
    if (codeId) {
      for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
        const { data, error } = await supabase
          .from('instrument_names')
          .select(`id, ${textCol}, code_alat`)
          .eq('id', codeId)
          .maybeSingle()
        if (!error) {
          filterCode = data?.code_alat || null
          break
        }
        if (!isMissingColumnError(error, textCol)) {
          return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
        }
      }
    }

    const result = await fetchInstrumentNames('full', filterCode)
    if (result.error) {
      return NextResponse.json({ error: clientSafeMessage(result.error) }, { status: 500 })
    }

    // Ambil seluruh kode untuk menentukan MIN(id) per kode secara global.
    const { data: allCodes } = await supabase
      .from('instrument_names')
      .select('id, code_alat')
      .not('code_alat', 'is', null)

    const representativeByCode = buildRepresentativeIdByCode(allCodes || [])

    const mapped = result.rows.map((item) => {
      const repId = item.code_alat
        ? representativeByCode.get(String(item.code_alat).trim()) ?? null
        : null
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

    // Coba insert dengan 'name', fallback ke 'names' bila kolom tidak ada.
    let inserted: any = null
    let lastError: any = null
    for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
      const { data, error } = await supabase
        .from('instrument_names')
        .insert({ [textCol]: nameValue, code_alat: resolvedCode })
        .select()
        .single()
      if (!error) {
        inserted = data
        break
      }
      lastError = error
      if (!isMissingColumnError(error, textCol)) break
    }

    if (!inserted) {
      return NextResponse.json({ error: clientSafeMessage(lastError) }, { status: 500 })
    }

    const normalized = normalizeInstrumentNameRow(inserted)
    return NextResponse.json(
      { ...inserted, name: normalized.name, code_alat: normalized.code_alat },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create instrument name' },
      { status: 500 },
    )
  }
}
