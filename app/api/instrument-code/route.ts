import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'
import { buildRepresentativeIdByCode } from '../../../lib/instrument-code-representative'

// Schema production: kode alat tersimpan langsung di instrument_names.code_alat.
// Tidak ada tabel master `instrument_code`. Endpoint ini membentuk daftar kode
// unik agar UI lama (dropdown kode) tetap berfungsi. ID perwakilan = MIN(id) per
// code_alat agar konsisten dengan /api/instrument-names.
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('instrument_names')
      .select('id, name, code_alat')
      .not('code_alat', 'is', null)
      .order('code_alat', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    const representativeByCode = buildRepresentativeIdByCode(data || [])

    const codes: Array<{ id: number; code_alat: string; name: string }> = []
    const seen = new Set<string>()
    for (const row of data || []) {
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

    // Buat baris nama perwakilan untuk kode baru.
    const { data, error } = await supabase
      .from('instrument_names')
      .insert({ name: body.name || code, code_alat: code })
      .select('id, code_alat')
      .single()

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    return NextResponse.json({ ...data, name: body.name || code }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create instrument code' },
      { status: 500 },
    )
  }
}
