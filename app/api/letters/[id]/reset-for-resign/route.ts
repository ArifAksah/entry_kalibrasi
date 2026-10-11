import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createLetterLog } from '@/lib/letter-log-helper'

/**
 * POST /api/letters/[id]/reset-for-resign (admin)
 * Membuka kembali penandatanganan final Surat Keterangan yang sudah ditandatangani,
 * agar dapat ditandatangani ulang (mis. setelah penandatangan berubah).
 * Verifikasi Verifikator 1-3 tetap dipertahankan; hanya level 4 yang direset.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(request)
  if (gate instanceof NextResponse) return gate

  const letterId = Number((await params).id)
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'ID surat tidak valid' }, { status: 400 })
  }

  const { data: letter } = await supabaseAdmin
    .from('letter')
    .select('id, status, version, no_letter, pdf_path, signed_at')
    .eq('id', letterId)
    .maybeSingle()
  if (!letter) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  const version = letter.version || 1
  const now = new Date().toISOString()

  const { error: verificationError } = await supabaseAdmin
    .from('letter_verification')
    .update({
      status: 'pending',
      signed_at: null,
      signature_data: null,
      timestamp_data: null,
      updated_at: now,
    })
    .eq('letter_id', letterId)
    .eq('verification_level', 4)
    .eq('letter_version', version)
  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 400 })
  }

  const { error: letterError } = await supabaseAdmin
    .from('letter')
    .update({
      status: 'verified',
      signed_at: null,
      completed_at: null,
      signature_data: null,
      timestamp_data: null,
      pdf_path: null,
      pdf_generated_at: null,
      repair_status: 'none',
      // Tanggal Terbit diisi ulang otomatis saat TTE berikutnya.
      issue_date: null,
    })
    .eq('id', letterId)
  if (letterError) {
    return NextResponse.json({ error: letterError.message }, { status: 400 })
  }

  await createLetterLog({
    letter_id: letterId,
    action: 'updated',
    performed_by: gate.user.id,
    previous_status: letter.status,
    new_status: 'verified',
    notes: `Reset untuk TTE ulang${reason ? `: ${reason}` : ''}`,
  })

  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: gate.user.id,
      action: 'letter_reset_for_resign',
      status: 'success',
      details: { letter_id: letterId, reason, previous_status: letter.status },
    })
  } catch (logError) {
    console.error('[letter reset-for-resign] gagal menulis audit log:', logError)
  }

  return NextResponse.json({ success: true, status: 'verified' })
}
