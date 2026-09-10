import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'
import { authenticateRequest, getUserRole } from '../../../../../lib/certificate-access'

// ⚠️ DEV-ONLY — REMOVE BEFORE PRODUCTION
// Reset sertifikat yang sudah completed/signed agar bisa di-TTE ulang
// dengan PDF hasil render terbaru (untuk iterasi perbaikan renderer).

function devGateEnabled() {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.NEXT_PUBLIC_DEV_RESET_PDF === 'true'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!devGateEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id } = await params
    const certificateId = parseInt(id)
    if (!Number.isFinite(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
    }

    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }
    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'calibrator') {
      return NextResponse.json({ error: 'Reset dev hanya untuk admin/calibrator' }, { status: 403 })
    }

    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, status, pdf_path, pdf_generated_at, issue_date, created_by, sent_by, authorized_by')
      .eq('id', certificateId)
      .maybeSingle()
    if (certError || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Calibrator hanya boleh reset sertifikat buatannya sendiri.
    if (role === 'calibrator') {
      const isOwner = [cert.created_by, cert.sent_by].some(
        (v: any) => v != null && String(v) === String(user.id)
      )
      if (!isOwner) {
        return NextResponse.json({ error: 'Hanya pembuat sertifikat yang dapat me-reset' }, { status: 403 })
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('certificate')
      .update({
        status: 'sent',
        pdf_path: null,
        pdf_generated_at: null,
        issue_date: null,
      })
      .eq('id', certificateId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Hanya hapus level 4 (penandatangan/assignor) — verifikator 1-3 tetap
    // approved sehingga tidak perlu approve ulang.
    const { error: deleteError } = await supabaseAdmin
      .from('certificate_verification')
      .delete()
      .eq('certificate_id', certificateId)
      .eq('verification_level', 4)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log(
      `[reset-for-resign] DEV reset cert ${certificateId} (${cert.no_certificate}) by user ${user.id}: pdf cleared, level-4 verification removed, status → sent`,
    )

    const { data: signer } = cert.authorized_by
      ? await supabaseAdmin
          .from('personel')
          .select('id, name, email')
          .eq('id', cert.authorized_by)
          .maybeSingle()
      : { data: null }

    return NextResponse.json({
      success: true,
      message: `Sertifikat ${cert.no_certificate} dikembalikan ke status "sent" (tanpa PDF). Silakan TTE ulang.`,
      signer: signer ? { id: signer.id, name: signer.name, email: signer.email } : null,
    })
  } catch (e: any) {
    console.error('[reset-for-resign] error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to reset' }, { status: 500 })
  }
}
