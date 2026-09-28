import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  resolveInstrumentNameTextColumn,
  pickNameText,
} from '../../../../../lib/instrument-names-schema'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  sent: 'Dalam Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  completed: 'Selesai'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_id: string }> }
) {
  try {
    const { public_id } = await params

    if (!public_id) {
      return NextResponse.json({ error: 'Public ID is required' }, { status: 400 })
    }

    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificate')
      .select(`
        no_certificate,
        no_identification,
        issue_date,
        status,
        authorized_by,
        station,
        instrument,
        pdf_generated_at
      `)
      .eq('public_id', public_id)
      .eq('status', 'completed')
      .maybeSingle()

    if (certError) {
      console.error('[Public API] Certificate query error:', certError)
      return NextResponse.json({ error: 'Failed to fetch certificate' }, { status: 500 })
    }

    if (!cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const [stationResult, instrumentResult, signerResult] = await Promise.all([
      cert.station
        ? supabaseAdmin
          .from('station')
          .select('name')
          .eq('id', cert.station)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      cert.instrument
        ? supabaseAdmin
          .from('instrument')
          .select('name, instrument_names_id')
          .eq('id', cert.instrument)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      cert.authorized_by
        ? supabaseAdmin
          .from('personel')
          .select('name')
          .eq('id', cert.authorized_by)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ])

    const stationName = stationResult.data?.name || '-'
    let instrumentName = instrumentResult.data?.name || '-'
    if (instrumentResult.data?.instrument_names_id) {
      const nameTextCol = await resolveInstrumentNameTextColumn(supabaseAdmin)
      const { data: nameRow } = await supabaseAdmin
        .from('instrument_names')
        .select(`id, ${nameTextCol}`)
        .eq('id', instrumentResult.data.instrument_names_id)
        .maybeSingle()
      instrumentName = pickNameText(nameRow) || instrumentName
    }
    const signer = cert.authorized_by
      ? { name: signerResult.data?.name || 'Tidak diketahui' }
      : null

    return NextResponse.json({
      valid: true,
      source: {
        system: 'SIMKAL',
        name: 'Sistem Informasi Manajemen Kalibrasi',
        owner: 'BMKG',
        statement: 'Sertifikat ini tercatat dan diterbitkan melalui SIMKAL (Sistem Informasi Manajemen Kalibrasi).'
      },
      certificate: {
        no_certificate: cert.no_certificate,
        no_identification: cert.no_identification,
        issue_date: cert.issue_date,
        status: cert.status,
        status_label: statusLabel[cert.status] || cert.status || '-',
        station_name: stationName,
        instrument_name: instrumentName
      },
      signature: {
        signed: true,
        provider: 'BSrE',
        signed_at: cert.pdf_generated_at || null,
        signer
      }
    })
  } catch (error: any) {
    console.error('[Public API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
