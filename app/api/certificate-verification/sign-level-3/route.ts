import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// In-memory lock untuk mencegah race condition double-submit
// Jika dua request datang bersamaan untuk sertifikat yang sama,
// hanya satu yang boleh melanjutkan proses signing
const signingLocks = new Map<string, boolean>()

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
  // ID unik per percobaan untuk traceability di audit log
  const attemptId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  let userIdForLog = 'unknown'
  let documentIdForLog = 'unknown'
  // lockKey dideklarasikan di luar try agar bisa diakses di catch block
  let lockKey: string | undefined

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

    // Ensure level 3 (Verifikator 3) is approved before penandatangan can sign
    {
      const { data: v3, error: v3Err } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', cert.id)
        .eq('verification_level', 3)
        .eq('certificate_version', effectiveVersion)
        .maybeSingle()

      if (!v3 || v3?.status !== 'approved') {
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          reason: 'level_3_not_approved'
        })
        return NextResponse.json({ error: 'Sertifikat belum diterbitkan' }, { status: 401 })
      }
    }

    // Check if already signed (Level 4 / Authorized By approved)
    {
      const { data: v4 } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', cert.id)
        .eq('verification_level', 4)
        .eq('certificate_version', effectiveVersion)
        .maybeSingle()

      if (v4 && v4.status === 'approved') {
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          attemptId,
          reason: 'already_signed'
        })
        return NextResponse.json({ error: 'Dokumen telah ditandatangani' }, { status: 400 })
      }
    }

    // ── LOCK: Cegah double-submit race condition ──────────────────────────────
    lockKey = `cert_${cert.id}_v${effectiveVersion}`
    if (signingLocks.get(lockKey)) {
      console.warn(`[sign-level-3] ⚠️ Duplicate request blocked for cert ${cert.id} (lock active)`)
      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        attemptId,
        reason: 'duplicate_request_blocked'
      })
      return NextResponse.json({ error: 'Proses penandatanganan sedang berlangsung, harap tunggu.' }, { status: 429 })
    }
    signingLocks.set(lockKey, true)
    console.log(`[sign-level-3] 🔒 Lock acquired for cert ${cert.id}`)
    // ─────────────────────────────────────────────────────────────────────────

    // Prepare payload to BSRE
    const bsrePayload: Record<string, any> = {
      passphrase: userPassphrase,
      document_id: String(cert.id),
    }

    let bsreData: any = null
    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'

    if (isMock) {
      const mockPassphrase = process.env.BSRE_MOCK_PASSPHRASE || 'demo123'
      if ((userPassphrase || '') !== mockPassphrase) {
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
        signingLocks.delete(lockKey) // Release lock on error
        console.error(`[sign-level-3] ❌ PDF signing failed for certificate ${cert.id}:`, pdfResult.error)

        // ── Cek NIK TERLEBIH DAHULU (sebelum cek passphrase) ──────────────────
        // Karena BSrE juga mengembalikan 401/400 saat NIK tidak valid,
        // sehingga pesan error bisa disalah-artikan sebagai salah passphrase

        // NIK tidak ada di database sama sekali
        if (pdfResult.error === 'NIK_NOT_FOUND_IN_DB' || pdfResult.error?.startsWith('NIK_NOT_FOUND')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            attemptId,
            reason: 'nik_not_in_db',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'NIK belum diatur di profil Anda. Silakan lengkapi data NIK di halaman profil.',
            code: 'NIK_MISSING'
          }, { status: 400 })
        }

        // NIK ada di database, tapi tidak terdaftar / tidak dikenali oleh BSrE
        if (pdfResult.error?.startsWith('NIK_INVALID_IN_BSRE') || pdfResult.error?.includes('NIK_INVALID')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            attemptId,
            reason: 'nik_invalid_in_bsre',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'NIK Anda tidak dikenali oleh sistem BSrE. Pastikan NIK sudah terdaftar di BSrE dan sesuai dengan data profil Anda.',
            code: 'NIK_INVALID_BSRE'
          }, { status: 400 })
        }

        // NIK bermasalah (general)
        if (pdfResult.error?.includes('NIK')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            attemptId,
            reason: 'nik_issue',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'NIK tidak ditemukan atau tidak terdaftar di profil Anda. Silakan lengkapi data NIK di halaman profil.',
            code: 'NIK_MISSING'
          }, { status: 400 })
        }

        // ── Baru setelah NIK tidak bermasalah, cek apakah ini error passphrase ──
        if (
          pdfResult.error?.includes('Passphrase') ||
          pdfResult.error?.includes('passphrase') ||
          pdfResult.error?.includes('salah') ||
          pdfResult.error?.includes('401') ||
          pdfResult.error?.includes('TTE') ||
          pdfResult.error?.includes('password') ||
          pdfResult.error?.includes('tidak valid') ||
          pdfResult.error?.includes('Kemungkinan passphrase') ||
          pdfResult.error?.includes('BSrE mengembalikan response tidak valid') ||
          pdfResult.error?.includes('HTTP 400') ||
          pdfResult.error?.includes('HTTP 401') ||
          pdfResult.error?.includes('HTTP 403')
        ) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            attemptId,
            reason: 'invalid_passphrase',
            error: pdfResult.error
          })
          return NextResponse.json({ error: 'Passphrase yang Anda masukkan salah. Silakan coba lagi.' }, { status: 400 })
        }

        // Other errors
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          attemptId,
          reason: 'pdf_signing_failed',
          error: pdfResult.error
        })
        return NextResponse.json({ error: pdfResult.error || 'Gagal menandatangani PDF' }, { status: 500 })
      }

      console.log(`[sign-level-3] ✅ PDF generated and signed successfully`)

    } catch (pdfError: any) {
      signingLocks.delete(lockKey) // Release lock on exception
      console.error('[sign-level-3] ❌ Error during PDF generation/signing:', pdfError)
      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        attemptId,
        reason: 'pdf_generation_exception',
        error: pdfError.message
      })
      return NextResponse.json({ error: 'Terjadi kesalahan sistem saat memproses PDF' }, { status: 500 })
    }

    // Update status to approved (level 4 = penandatangan / authorized_by)
    // Using upsert to handle both new and existing records atomically,
    // avoiding unique constraint violations if the record already exists.
    const { error: upsertErr } = await supabaseAdmin
      .from('certificate_verification')
      .upsert({
        certificate_id: cert.id,
        verification_level: 4,
        status: 'approved',
        approval_notes: 'Signed via BSRE',
        verified_by: user.id,
        signature_data: bsreData || { provider: 'BSrE', signed: true },
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        certificate_version: effectiveVersion
      }, {
        onConflict: 'certificate_id,verification_level,certificate_version',
        ignoreDuplicates: false
      })

    if (upsertErr) {
      signingLocks.delete(lockKey) // Release lock on DB error
      console.error('[sign-level-3] ❌ Failed to upsert verification record:', upsertErr)
      await logAction(request, user.id, 'bsre_sign', 'error', { documentId, attemptId, reason: 'db_upsert_failed', error: upsertErr.message })

      // Check if this is a constraint violation on verification_level
      // Code 23514 = check_violation in PostgreSQL
      if (upsertErr.code === '23514' && upsertErr.message?.includes('verification_level_check')) {
        return NextResponse.json({
          error: 'Konfigurasi database belum mendukung level verifikasi Penandatangan (level 4). ' +
                 'Silakan jalankan migration SQL: database/fix_verification_level_4_constraint.sql di Supabase SQL Editor.',
          code: 'DB_CONSTRAINT_ERROR'
        }, { status: 500 })
      }

      return NextResponse.json({ error: 'Berhasil ditandatangani, namun gagal menyimpan status di database. Hubungi administrator.' }, { status: 500 })
    }
    console.log('[sign-level-3] ✅ Level 4 verification record upserted (approved)')



    // Also update certificate status to 'completed'
    const { error: certUpdateErr } = await supabaseAdmin
      .from('certificate')
      .update({ status: 'completed' })
      .eq('id', cert.id)
    if (certUpdateErr) {
      console.error('[sign-level-3] ❌ Failed to update certificate status:', certUpdateErr)
      // Non-fatal: verification record is already saved, just log the error
    } else {
      console.log('[sign-level-3] ✅ Certificate status updated to completed')
    }

    // Create certificate log
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      await createCertificateLog({
        certificate_id: cert.id,
        action: 'approved_assignor',
        performed_by: user.id,
        approval_notes: 'Signed via BSRE',
        verification_level: 4,
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
    signingLocks.delete(lockKey) // ✅ Release lock after success
    console.log(`[sign-level-3] 🔓 Lock released for cert ${cert.id}`)
    await logAction(request, user.id, 'bsre_sign', 'success', {
      documentId,
      attemptId,
      waktu: durationStr,
      message: 'Proses berhasil'
    })

    // Return respon lengkap
    return NextResponse.json({
      success: true,
      message: 'Dokumen berhasil ditandatangani',
      documentId: documentId,
      waktu: durationStr
    }, { status: 200 })
  } catch (e: any) {
    console.error('sign-level-3 error:', e)
    // Release lock on unexpected error (lockKey might not exist if error before lock)
    if (typeof lockKey !== 'undefined') signingLocks.delete(lockKey)
    await logAction(request, userIdForLog, 'bsre_sign', 'error', {
      documentId: documentIdForLog,
      attemptId,
      reason: 'internal_error',
      error: e.message
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
