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
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { documentId, userPassphrase } = body || {}

    if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    if (!userPassphrase) return NextResponse.json({ error: 'userPassphrase is required' }, { status: 400 })

    // Load certificate and verify user is Authorized By (level 3) and sequence satisfied (level 2 approved)
    const { data: cert, error: certErr } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, authorized_by, version')
      .eq('id', documentId)
      .single()

    if (certErr || !cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })

    if (cert.authorized_by !== user.id) {
      return NextResponse.json({ error: 'You are not assigned as Authorized By for this certificate' }, { status: 403 })
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
        return NextResponse.json({ error: 'Verifikator 2 must approve before Authorized By can sign.' }, { status: 400 })
      }
    }

    // Prepare payload to BSRE. If your BSRE requires a hash, replace document_id with real hash.
    const bsrePayload: Record<string, any> = {
      passphrase: userPassphrase,
      document_id: String(cert.id),
    }

    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'
    let bsreData: any = null
    if (isMock) {
      // Simulate BSRE behavior: wrong passphrase -> 401, otherwise success
      if ((userPassphrase || '').toLowerCase() === 'wrong') {
        await logAction(request, user.id, 'bsre_sign', 'error', { documentId, reason: 'invalid_passphrase_mock' })
        return NextResponse.json({ error: 'Passphrase TTE salah' }, { status: 401 })
      }
      bsreData = {
        valid: true,
        timestamp: new Date().toISOString(),
        provider: 'BSRE-MOCK',
        signature: 'mock-signature-base64',
      }
    } else {
      const bsreUrl = process.env.BSRE_SIGN_API_URL
      if (!bsreUrl) {
        return NextResponse.json({ error: 'BSRE_SIGN_API_URL is not configured' }, { status: 500 })
      }
      let bsreRes: Response
      try {
        bsreRes = await fetch(bsreUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.BSRE_API_KEY || '',
            'Authorization': `Bearer ${process.env.BSRE_API_KEY || ''}`
          },
          body: JSON.stringify(bsrePayload)
        })
      } catch (networkErr: any) {
        await logAction(request, user.id, 'bsre_sign', 'error', { documentId, network_error: String(networkErr?.message || networkErr) })
        return NextResponse.json({ error: 'Tidak dapat menghubungi BSRE. Periksa URL/sertifikat TLS atau aktifkan BSRE_MOCK=true untuk pengujian.' }, { status: 502 })
      }

      if (bsreRes.status === 401) {
        await logAction(request, user.id, 'bsre_sign', 'error', { documentId, reason: 'invalid_passphrase' })
        return NextResponse.json({ error: 'Passphrase TTE salah' }, { status: 401 })
      }

      if (!bsreRes.ok) {
        const txt = await bsreRes.text().catch(() => '')
        await logAction(request, user.id, 'bsre_sign', 'error', { documentId, status: bsreRes.status, body: txt })
        return NextResponse.json({ error: txt || 'BSRE signing failed' }, { status: 502 })
      }

      // Read BSRE response for signature info
      bsreData = await bsreRes.json().catch(() => null)
    }

    // IMPORTANT: DO NOT update status approval yet!
    // Status approval must wait for PDF signing to succeed (which validates passphrase)
    // PDF signing will validate passphrase - if wrong, status should NOT be approved

    // Generate and save PDF BEFORE updating status to approved
    // CRITICAL: Status approval must wait for PDF signing to succeed
    // If PDF signing fails (e.g., passphrase salah), status should NOT be approved
    console.log(`[sign-level-3] Starting PDF generation and signing for certificate ${cert.id}...`)
    console.log(`[sign-level-3] Passphrase validation will be done during PDF signing...`)

    try {
      const { generateAndSaveCertificatePDF } = await import('../../../../lib/certificate-pdf-helper')

      // AWAIT PDF generation and signing - do not proceed if it fails
      // Passphrase validation happens here during PDF signing to BSrE
      const pdfResult = await generateAndSaveCertificatePDF(cert.id, user.id, userPassphrase, true)

      if (!pdfResult.success) {
        console.error(`[sign-level-3] ❌ PDF signing failed for certificate ${cert.id}:`, pdfResult.error)

        // Check if error is due to passphrase
        if (pdfResult.error?.includes('Passphrase') || pdfResult.error?.includes('passphrase') ||
          pdfResult.error?.includes('salah')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            reason: 'invalid_passphrase_pdf_signing',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'Passphrase yang dimasukkan salah. Silakan masukkan passphrase yang benar.'
          }, { status: 400 })
        }
        // Check if error is due to NIK not registered or missing
        else if (pdfResult.error === 'NIK_NOT_FOUND_IN_DB') {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            reason: 'nik_missing_in_db',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'NIK belum diatur di profil pengguna. Silakan lengkapi data profil Anda.',
            code: 'NIK_MISSING'
          }, { status: 400 })
        }
        else if (pdfResult.error?.includes('NIK') || pdfResult.error?.includes('nik') ||
          pdfResult.error?.includes('tidak terdaftar') || pdfResult.error?.includes('tidak ditemukan')) {
          await logAction(request, user.id, 'bsre_sign', 'error', {
            documentId,
            reason: 'nik_not_registered',
            error: pdfResult.error
          })
          return NextResponse.json({
            error: 'NIK peserta tidak terdaftar di BSrE. Pastikan NIK Anda sudah terdaftar.',
            code: 'NIK_INVALID'
          }, { status: 400 })
        }

        // For other PDF signing errors, fail the approval
        await logAction(request, user.id, 'bsre_sign', 'error', {
          documentId,
          reason: 'pdf_signing_failed',
          error: pdfResult.error
        })
        return NextResponse.json({
          error: pdfResult.error || 'Gagal menandatangani PDF. Status approval dibatalkan.'
        }, { status: 500 })
      }

      console.log(`[sign-level-3] ✅ PDF generated and signed successfully for certificate ${cert.id}: ${pdfResult.pdfPath}`)

    } catch (pdfError: any) {
      console.error('[sign-level-3] ❌ Error during PDF generation/signing:', pdfError)
      console.error('[sign-level-3] Error details:', pdfError.message, pdfError.stack)

      await logAction(request, user.id, 'bsre_sign', 'error', {
        documentId,
        reason: 'pdf_generation_exception',
        error: pdfError.message
      })

      return NextResponse.json({
        error: `Gagal menandatangani PDF: ${pdfError.message || 'Unknown error'}. Status approval dibatalkan.`
      }, { status: 500 })
    }

    // ONLY update status to approved AFTER PDF signing is successful
    // Now update the status because PDF signing passed, meaning passphrase was correct
    console.log(`[sign-level-3] Updating status to approved for certificate ${cert.id}, version ${effectiveVersion}...`)

    const { data: existingL3, error: checkErr } = await supabaseAdmin
      .from('certificate_verification')
      .select('id, status')
      .eq('certificate_id', cert.id)
      .eq('verification_level', 3)
      .eq('certificate_version', effectiveVersion)
      .maybeSingle()

    if (checkErr) {
      console.error('[sign-level-3] Error checking existing verification:', checkErr)
    }

    console.log(`[sign-level-3] Existing L3 verification:`, existingL3 ? `ID=${existingL3.id}, status=${existingL3.status}` : 'Not found')

    if (existingL3) {
      const { data: updatedData, error: updErr } = await supabaseAdmin
        .from('certificate_verification')
        .update({
          status: 'approved',
          notes: null,
          rejection_reason: null,
          approval_notes: 'Signed via BSRE',
          signature_data: bsreData || null,
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingL3.id)
        .select()
        .single()

      if (updErr) {
        console.error('[sign-level-3] Failed to update status:', updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
      console.log(`[sign-level-3] ✅ Status updated successfully:`, updatedData)

      // Verify the update was successful by querying it back
      const { data: verifyUpdate, error: verifyErr } = await supabaseAdmin
        .from('certificate_verification')
        .select('id, status, certificate_id, verification_level, certificate_version')
        .eq('id', existingL3.id)
        .single()

      if (verifyErr) {
        console.error('[sign-level-3] ⚠️ Warning: Could not verify updated status:', verifyErr)
      } else {
        console.log(`[sign-level-3] ✅ Verified updated status in database:`, verifyUpdate)
      }
    } else {
      const { data: insertedData, error: insErr } = await supabaseAdmin
        .from('certificate_verification')
        .insert({
          certificate_id: cert.id,
          verification_level: 3,
          status: 'approved',
          notes: null,
          rejection_reason: null,
          approval_notes: 'Signed via BSRE',
          verified_by: user.id,
          signature_data: bsreData || null,
          signed_at: new Date().toISOString(),
          certificate_version: effectiveVersion
        })
        .select()
        .single()

      if (insErr) {
        console.error('[sign-level-3] Failed to insert status:', insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
      console.log(`[sign-level-3] ✅ Status inserted successfully:`, insertedData)

      // Verify the insert was successful by querying it back
      // Use certificate_id and verification_level to ensure we can find it from verify-certificate endpoint
      const { data: verifyInsert, error: verifyErr } = await supabaseAdmin
        .from('certificate_verification')
        .select('id, status, certificate_id, verification_level, certificate_version')
        .eq('certificate_id', cert.id)
        .eq('verification_level', 3)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (verifyErr) {
        console.error('[sign-level-3] ⚠️ Warning: Could not verify inserted status:', verifyErr)
      } else if (verifyInsert) {
        console.log(`[sign-level-3] ✅ Verified inserted status in database:`, verifyInsert)
        console.log(`[sign-level-3] ✅ Record is queryable with certificate_id=${cert.id}, verification_level=3, status=approved`)
      } else {
        console.error('[sign-level-3] ⚠️ Warning: Inserted status not found when querying back - possible replication lag')
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500))
        const { data: retryVerify, error: retryErr } = await supabaseAdmin
          .from('certificate_verification')
          .select('id, status, certificate_id, verification_level, certificate_version')
          .eq('certificate_id', cert.id)
          .eq('verification_level', 3)
          .eq('status', 'approved')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (retryVerify) {
          console.log(`[sign-level-3] ✅ Found record after retry:`, retryVerify)
        } else {
          console.error('[sign-level-3] ❌ Still not found after retry:', retryErr)
        }
      }
    }

    // Create certificate log entry for signing (after status update)
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      const { data: currentCert } = await supabaseAdmin
        .from('certificate')
        .select('status')
        .eq('id', cert.id)
        .single()

      await createCertificateLog({
        certificate_id: cert.id,
        action: 'approved_assignor',
        performed_by: user.id,
        approval_notes: 'Signed via BSRE',
        verification_level: 3,
        previous_status: currentCert?.status || null,
        new_status: 'approved',
        metadata: {
          signature_data: bsreData
        }
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
      // Don't fail the request if logging fails
    }

    await logAction(request, user.id, 'bsre_sign', 'success', { documentId, certificateId: cert.id })
    return NextResponse.json({ message: 'TTE Berhasil' }, { status: 200 })
  } catch (e) {
    console.error('sign-level-3 error:', e)
    try {
      // best effort user id extraction for logging
      // no-op if cannot parse
    } catch { }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
