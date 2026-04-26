import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

/**
 * GET /api/certificates/generate-number
 *
 * Query params (opsional semua, ada default):
 *   ?cert_type=sert|s_ket        (default: sert)
 *   ?place=FC|LC                 (default: FC)
 *   ?code=AWS|TT|PP|...          (default: placeholder 'XXX' di preview)
 *   ?no_ident=032                (default: placeholder 'NNN' di preview)
 *
 * Mengembalikan PREVIEW nomor sertifikat sesuai format IKK:
 *   Sert.FC-AWS/032.001/DIK/IV/2026
 *
 * ⚠️ Angka yang dikembalikan TIDAK DIJAMIN FINAL. Nomor definitif baru
 * di-assign saat POST /api/certificates berhasil (atomik di DB).
 * Response memuat `is_preview: true`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const certType = (searchParams.get('cert_type') || 'sert').toLowerCase()
    const place    = (searchParams.get('place') || 'FC').toUpperCase()
    const code     = searchParams.get('code') || null
    const noIdent  = searchParams.get('no_ident') || null

    const { data: rpcRows, error: rpcError } = await supabaseAdmin
      .rpc('preview_next_certificate_number', {
        p_cert_type: certType,
        p_place:     place,
        p_code:      code,
        p_no_ident:  noIdent,
      })

    if (rpcError) {
      console.error('[generate-number] RPC error:', rpcError.message)
      return NextResponse.json({
        error: 'Preview function tidak tersedia. Jalankan migration certificate_ikk_format.sql.',
        detail: rpcError.message,
      }, { status: 500 })
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (!row?.no_order || !row?.no_certificate) {
      return NextResponse.json({ error: 'Preview function returned empty result' }, { status: 500 })
    }

    return NextResponse.json({
      no_order: row.no_order,
      no_certificate: row.no_certificate,
      cert_type: certType,
      place,
      code,
      no_ident: noIdent,
      is_preview: true,
    })
  } catch (e: any) {
    console.error('Error generating certificate number:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
