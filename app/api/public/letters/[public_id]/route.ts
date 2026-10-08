import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  sent: 'Dalam Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  completed: 'Selesai',
}

/** GET /api/public/letters/[public_id] — verifikasi publik Surat Keterangan via QR. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_id: string }> },
) {
  try {
    const { public_id } = await params
    if (!public_id) return NextResponse.json({ error: 'Public ID wajib diisi' }, { status: 400 })

    const { data: letter, error } = await supabaseAdmin
      .from('letter')
      .select('id, no_letter, no_order, no_identification, issue_date, status, authorized_by, owner, instrument, pdf_generated_at, signed_at, pdf_path')
      .eq('public_id', public_id)
      .maybeSingle()

    if (error) {
      console.error('[Public Letter API] query error:', error)
      return NextResponse.json({ error: 'Gagal memuat Surat Keterangan' }, { status: 500 })
    }
    if (!letter) {
      return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })
    }

    const [ownerResult, instrumentResult, signerResult] = await Promise.all([
      letter.owner
        ? supabaseAdmin.from('station').select('name, address').eq('id', letter.owner).maybeSingle()
        : Promise.resolve({ data: null }),
      letter.instrument
        ? supabaseAdmin.from('instrument').select('name_alias, type, manufacturer, serial_number').eq('id', letter.instrument).maybeSingle()
        : Promise.resolve({ data: null }),
      letter.authorized_by
        ? supabaseAdmin.from('personel').select('name, signer_title').eq('id', letter.authorized_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const completed = letter.status === 'completed' && Boolean(letter.signed_at)

    return NextResponse.json({
      valid: completed,
      document_type: 'letter',
      /** Tautan unduh PDF bertanda tangan (publik, memakai public_id). */
      pdf_url: completed
        ? `/api/letters/${letter.id}/pdf?public_id=${encodeURIComponent(public_id)}`
        : null,
      source: {
        system: 'SIMKAL',
        name: 'BMKG',
        owner: ownerResult.data?.name || '-',
        statement: completed
          ? 'Surat Keterangan ini sah dan ditandatangani secara elektronik.'
          : 'Surat Keterangan belum selesai ditandatangani.',
      },
      letter: {
        no_letter: letter.no_letter,
        no_order: letter.no_order,
        no_identification: letter.no_identification,
        issue_date: letter.issue_date,
        status: letter.status,
        status_label: statusLabel[letter.status as string] || letter.status,
        owner_name: ownerResult.data?.name || null,
        instrument_name:
          instrumentResult.data?.name_alias
          || instrumentResult.data?.type
          || null,
      },
      signature: {
        signed: Boolean(letter.signed_at),
        provider: letter.signed_at ? 'BSrE' : null,
        signed_at: letter.signed_at,
        signer: signerResult.data ? { name: signerResult.data.name } : null,
      },
    })
  } catch (error) {
    console.error('[Public Letter API] unexpected error:', error)
    return NextResponse.json({ error: 'Gagal memverifikasi Surat Keterangan' }, { status: 500 })
  }
}
