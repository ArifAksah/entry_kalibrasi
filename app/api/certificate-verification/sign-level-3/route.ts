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

    // Upsert level-3 verification as approved
    const { data: existingL3 } = await supabaseAdmin
      .from('certificate_verification')
      .select('id')
      .eq('certificate_id', cert.id)
      .eq('verification_level', 3)
      .eq('certificate_version', effectiveVersion)
      .maybeSingle()

    if (existingL3) {
      const { error: updErr } = await supabaseAdmin
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
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    } else {
      const { error: insErr } = await supabaseAdmin
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
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    await logAction(request, user.id, 'bsre_sign', 'success', { documentId, certificateId: cert.id })
    return NextResponse.json({ message: 'TTE Berhasil' }, { status: 200 })
  } catch (e) {
    console.error('sign-level-3 error:', e)
    try {
      // best effort user id extraction for logging
      // no-op if cannot parse
    } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
