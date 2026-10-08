import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'

type DocumentResult = {
  document: 'certificate' | 'letter'
  document_id: number
  label: string
  ok: boolean
  skipped?: boolean
  status?: string
  error?: string
}

async function forward(
  request: NextRequest,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: any }> {
  const authorization = request.headers.get('authorization') || ''
  const response = await fetch(`${request.nextUrl.origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

/**
 * POST /api/signature/identification
 * Tandatangani dokumen yang siap pada SATU identifikasi (sertifikat dan/atau surat)
 * dengan satu passphrase. Endpoint ini hanya mengorkestrasi endpoint tanda tangan
 * yang sudah ada — tidak menduplikasi logika TTE.
 * Body: { calibration_order_item_id, passphrase }
 */
export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  try {
    const body = await request.json().catch(() => ({}))
    const itemId = Number(body?.calibration_order_item_id)
    const passphrase = typeof body?.passphrase === 'string' ? body.passphrase : ''

    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: 'calibration_order_item_id wajib diisi' }, { status: 400 })
    }
    if (!passphrase) {
      return NextResponse.json({ error: 'Passphrase TTE wajib diisi' }, { status: 400 })
    }

    const { data: item } = await supabaseAdmin
      .from('calibration_order_items')
      .select('id, no_identification, instrument_id')
      .eq('id', itemId)
      .maybeSingle()
    if (!item) {
      return NextResponse.json({ error: 'Identifikasi tidak ditemukan' }, { status: 404 })
    }

    const { data: assignment } = await supabaseAdmin
      .from('order_item_document_assignments')
      .select('authorized_by')
      .eq('calibration_order_item_id', itemId)
      .maybeSingle()

    // Hanya penandatangan yang ditugaskan pada identifikasi ini yang boleh
    // memproses TTE (termasuk admin tidak dikecualikan).
    const certificateSigner = await supabaseAdmin
      .from('certificate')
      .select('authorized_by')
      .eq('calibration_order_item_id', itemId)
      .maybeSingle()
    const letterSigner = await supabaseAdmin
      .from('letter')
      .select('authorized_by')
      .eq('calibration_order_item_id', itemId)
      .maybeSingle()

    const allowed = [
      assignment?.authorized_by,
      certificateSigner.data?.authorized_by,
      letterSigner.data?.authorized_by,
    ].some((id) => id && String(id) === caller.user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Anda bukan penandatangan pada identifikasi ini' },
        { status: 403 },
      )
    }

    const { data: certificate } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, no_order, status, authorized_by')
      .eq('calibration_order_item_id', itemId)
      .maybeSingle()

    const { data: letter } = await supabaseAdmin
      .from('letter')
      .select('id, no_letter, no_order, status, authorized_by')
      .eq('calibration_order_item_id', itemId)
      .maybeSingle()

    if (!certificate && !letter) {
      return NextResponse.json(
        { error: 'Tidak ada sertifikat atau surat pada identifikasi ini' },
        { status: 400 },
      )
    }

    const results: DocumentResult[] = []

    if (certificate) {
      if (certificate.status === 'completed') {
        results.push({
          document: 'certificate',
          document_id: certificate.id,
          label: certificate.no_certificate || `Sertifikat #${certificate.id}`,
          ok: true,
          skipped: true,
          status: 'completed',
        })
      } else {
        const outcome = await forward(request, '/api/certificate-verification/sign-level-3', {
          documentId: certificate.id,
          userPassphrase: passphrase,
        })
        results.push({
          document: 'certificate',
          document_id: certificate.id,
          label: certificate.no_certificate || `Sertifikat #${certificate.id}`,
          ok: outcome.ok,
          status: outcome.json?.status,
          error: outcome.ok ? undefined : outcome.json?.error || 'Gagal menandatangani sertifikat',
        })
      }
    }

    if (letter) {
      if (letter.status === 'completed') {
        results.push({
          document: 'letter',
          document_id: letter.id,
          label: letter.no_letter || `Surat #${letter.id}`,
          ok: true,
          skipped: true,
          status: 'completed',
        })
      } else {
        const outcome = await forward(request, '/api/letter-verification/sign-level-3', {
          letter_id: letter.id,
          passphrase,
        })
        results.push({
          document: 'letter',
          document_id: letter.id,
          label: letter.no_letter || `Surat #${letter.id}`,
          ok: outcome.ok,
          status: outcome.json?.status,
          error: outcome.ok ? undefined : outcome.json?.error || 'Gagal menandatangani surat',
        })
      }
    }

    const attempted = results.filter((row) => !row.skipped)
    return NextResponse.json({
      success: attempted.length > 0 && attempted.every((row) => row.ok),
      identification: item.no_identification,
      results,
    })
  } catch (error: any) {
    console.error('[signature/identification] error:', error)
    return NextResponse.json({ error: error?.message || 'Gagal memproses tanda tangan' }, { status: 500 })
  }
}
