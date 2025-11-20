import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function logAction(
  req: NextRequest,
  userId: string,
  action: string,
  status: 'success' | 'error',
  details: Record<string, any> = {}
) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      status,
      details,
      ip_address: ip,
      user_agent: userAgent
    })
  } catch (e) {
    // swallow logging errors
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userIdForLog = 'unknown'
  let documentIdForLog = 'unknown'

  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    userIdForLog = user.id

    const body = await request.json()
    const { documentId, userPassphrase } = body || {}
    documentIdForLog = documentId

    if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    if (!userPassphrase) return NextResponse.json({ error: 'userPassphrase is required' }, { status: 400 })

    // Load certificate and verify user is Authorized By (level 3)
    const { data: cert, error: certErr } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, authorized_by, version, status')
      .eq('id', documentId)
      .single()

    if (certErr || !cert) {
      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        reason: 'certificate_not_found'
      })
      return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })
    }

    // Check if certificate is issued (status check) - Mapping to "Sertifikat belum diterbitkan"
    // Assuming 'draft' or similar status means not issued. Adjust logic if needed.
    // If the user specifically wants "Sertifikat belum diterbitkan" for 401, we need a condition.
    // Usually level 3 signing happens BEFORE issuance (it IS the issuance step often), 
    // but if the requirement is "Sertifikat belum diterbitkan" on 401, maybe it checks if level 2 is done?
    // The previous code checked level 2. Let's keep that check.

    if (cert.authorized_by !== user.id) {
      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        reason: 'unauthorized_signer',
        expected: cert.authorized_by,
        actual: user.id
      })
      return NextResponse.json({ error: 'Anda bukan penandatangan yang berwenang' }, { status: 403 })
    }

    const effectiveVersion = (cert as any).version ?? 1

    // Ensure level 2 is approved
    {
      const { data: v2, error: v2Err } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', cert.id)
        .eq('verification_level', 2)
        .eq('certificate_version', effectiveVersion)
        .maybeSingle()

      if (!v2 || v2?.status !== 'approved') {
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          reason: 'level_2_not_approved'
        })
        // Mapping this to "Sertifikat belum diterbitkan" as it's not ready for signing
        return NextResponse.json({ error: 'Sertifikat belum diterbitkan' }, { status: 401 })
      }
    }

    // Check if already signed (Level 3 approved)
    {
      const { data: v3 } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', cert.id)
        .eq('verification_level', 3)
        .eq('certificate_version', effectiveVersion)
        .maybeSingle()

      if (v3 && v3.status === 'approved') {
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          reason: 'already_signed'
        })
        return NextResponse.json({ error: 'Dokumen telah ditandatangani' }, { status: 400 })
      }
    }

    // Prepare payload to BSRE
    const bsrePayload: Record<string, any> = {
      passphrase: userPassphrase,
      document_id: String(cert.id),
    }

    let bsreData: any = null
    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'

    if (isMock) {
      if ((userPassphrase || '').toLowerCase() === 'wrong') {
        await logAction(request, user.id, 'bsre_sign', 'error', { documentId, reason: 'invalid_passphrase_mock' })
        return NextResponse.json({ error: 'Passphrase anda salah' }, { status: 400 })
      }
      bsreData = {
        valid: true,
        timestamp: new Date().toISOString(),
        provider: 'BSRE-MOCK',
        signature: 'mock-signature-base64',
      }
    } else {
      // Real BSrE check via PDF signing
      // We don't call BSrE directly here for payload check, we rely on the PDF generation helper
      // which calls BSrE.
    }

    console.log(`[sign-level-3] Starting PDF generation and signing for certificate ${cert.id}...`)

    try {
      const { generateAndSaveCertificatePDF } = await import('../../../../lib/certificate-pdf-helper')

      // AWAIT PDF generation and signing
      const pdfResult = await generateAndSaveCertificatePDF(cert.id, user.id, userPassphrase, true)

      if (!pdfResult.success) {
        console.error(`[sign-level-3] ❌ PDF signing failed for certificate ${cert.id}:`, pdfResult.error)

        // Check if error is due to passphrase
        if (pdfResult.error?.includes('Passphrase') || pdfResult.error?.includes('passphrase') ||
          pdfResult.error?.includes('salah') || pdfResult.error?.includes('401')) {

          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            reason: 'invalid_passphrase',
            error: pdfResult.error
          })
          return NextResponse.json({ error: 'Passphrase anda salah' }, { status: 400 })
        }

        // Check if NIK issues
        if (pdfResult.error === 'NIK_NOT_FOUND_IN_DB' || pdfResult.error?.includes('NIK')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            reason: 'nik_issue',
            error: pdfResult.error
          })
          // Using the same error message for simplicity or specific one if needed
          // User request didn't specify NIK error format, but let's be helpful
          return NextResponse.json({ error: 'NIK tidak ditemukan atau tidak terdaftar' }, { status: 400 })
        }

        // Other errors
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          reason: 'pdf_signing_failed',
          error: pdfResult.error
        })
        return NextResponse.json({ error: pdfResult.error || 'Gagal menandatangani PDF' }, { status: 500 })
      }

      console.log(`[sign-level-3] ✅ PDF generated and signed successfully`)

    } catch (pdfError: any) {
      console.error('[sign-level-3] ❌ Error during PDF generation/signing:', pdfError)
      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        reason: 'pdf_generation_exception',
        error: pdfError.message
      })
      return NextResponse.json({ error: 'Terjadi kesalahan sistem saat memproses PDF' }, { status: 500 })
    }

    // Update status to approved
    const { data: existingL3 } = await supabaseAdmin
      .from('certificate_verification')
      .select('id')
      .eq('certificate_id', cert.id)
      .eq('verification_level', 3)
      .eq('certificate_version', effectiveVersion)
      .maybeSingle()

    if (existingL3) {
      await supabaseAdmin
        .from('certificate_verification')
        .update({
          status: 'approved',
          approval_notes: 'Signed via BSRE',
          signature_data: bsreData || { provider: 'BSrE', signed: true },
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingL3.id)
    } else {
      await supabaseAdmin
        .from('certificate_verification')
        .insert({
          certificate_id: cert.id,
          verification_level: 3,
          status: 'approved',
          approval_notes: 'Signed via BSRE',
          verified_by: user.id,
          signature_data: bsreData || { provider: 'BSrE', signed: true },
          signed_at: new Date().toISOString(),
          certificate_version: effectiveVersion
        })
    }

    // Create certificate log
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      await createCertificateLog({
        certificate_id: cert.id,
        action: 'approved_assignor',
        performed_by: user.id,
        approval_notes: 'Signed via BSRE',
        verification_level: 3,
        previous_status: cert.status,
        new_status: 'approved',
        metadata: { signature_data: bsreData }
      })
    } catch (e) { /* ignore log error */ }

    // Calculate duration
    // Hitung durasi
    const endTime = Date.now()
    const duration = endTime - startTime
    const durationStr = `${duration} ms`

    // Success Log
    await logAction(request, user.id, 'bsre_sign', 'success', {
      documentId,
      waktu: durationStr,
      message: 'Proses berhasil'
    })

    // Return respon lengkap (Revisi)
    return NextResponse.json({
      success: true,
      message: 'Dokumen berhasil ditandatangani',
      documentId: documentId,
      waktu: durationStr
    }, { status: 200 })
  } catch (e: any) {
    console.error('sign-level-3 error:', e)
    await logAction(request, userIdForLog, 'bsre_sign', 'error', {
      documentId: documentIdForLog,
      reason: 'internal_error',
      error: e.message
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
