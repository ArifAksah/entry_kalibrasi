import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'
import { buildRepresentativeIdByCode } from '../../../lib/instrument-code-representative'
import {
  INSTRUMENT_NAME_TEXT_COLUMNS,
  isMissingColumnError,
  pickNameText,
} from '../../../lib/instrument-names-schema'

// Kompatibel dua schema. Kode alat tersimpan di instrument_names.code_alat.
// Tidak ada tabel master `instrument_code`. ID perwakilan = MIN(id) per code_alat
// agar konsisten dengan /api/instrument-names.

/** Ambil seluruh baris {id, <teks>, code_alat} memakai kolom teks yang tersedia. */
async function fetchCodeRows() {
  let lastError: any = null
  for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
    const { data, error } = await supabase
      .from('instrument_names')
      .select(`id, ${textCol}, code_alat`)
      .not('code_alat', 'is', null)
      .order('code_alat', { ascending: true })
      .order('id', { ascending: true })
    if (!error) {
      return {
        rows: (data || []).map((row: any) => ({
          id: Number(row.id),
          name: pickNameText(row),
          code_alat: row.code_alat == null ? null : String(row.code_alat),
        })),
        error: null as null,
      }
    }
    lastError = error
    if (!isMissingColumnError(error, textCol)) break
  }
  return { rows: [] as Array<{ id: number; name: string; code_alat: string | null }>, error: lastError }
}

export async function GET() {
  try {
    const { rows, error } = await fetchCodeRows()
    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    const representativeByCode = buildRepresentativeIdByCode(rows)

    const codes: Array<{ id: number; code_alat: string; name: string }> = []
    const seen = new Set<string>()
    for (const row of rows) {
      const code = String(row.code_alat || '').trim()
      if (!code || seen.has(code)) continue
      seen.add(code)
      codes.push({ id: representativeByCode.get(code)!, code_alat: code, name: code })
    }

    return NextResponse.json(codes)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch instrument codes' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const body = await request.json()
    const code = String(body.code_alat || '').trim()

    if (!code) {
      return NextResponse.json(
        { error: 'Kode alat is required' },
        { status: 400 },
      )
    }

    // Kode sudah dipakai? Kembalikan perwakilan yang ada (idempoten).
    const { data: existing } = await supabase
      .from('instrument_names')
      .select('id, code_alat')
      .eq('code_alat', code)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ...existing, name: code }, { status: 200 })
    }

    // Buat baris nama perwakilan untuk kode baru (dual-schema).
    let inserted: any = null
    let lastError: any = null
    for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
      const { data, error } = await supabase
        .from('instrument_names')
        .insert({ [textCol]: body.name || code, code_alat: code })
        .select('id, code_alat')
        .single()
      if (!error) { inserted = data; break }
      lastError = error
      if (!isMissingColumnError(error, textCol)) break
    }

    if (!inserted) {
      return NextResponse.json({ error: clientSafeMessage(lastError) }, { status: 500 })
    }

    return NextResponse.json({ ...inserted, name: body.name || code }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create instrument code' },
      { status: 500 },
    )
  }
}

