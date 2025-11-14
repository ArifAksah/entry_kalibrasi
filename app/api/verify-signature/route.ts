import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ valid: false, message: 'documentId is required' }, { status: 400 })

    const { data: verification, error } = await supabaseAdmin
      .from('certificate_verification')
      .select('signature_data, certificate_version')
      .eq('certificate_id', documentId)
      .eq('verification_level', 3)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ valid: false, message: error.message }, { status: 500 })
    }

    if (!verification?.signature_data) {
      return NextResponse.json({ valid: false, message: 'Dokumen belum ditandatangani' }, { status: 400 })
    }

    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'
    if (isMock) {
      // Simulate a valid verification when signature_data exists
      return NextResponse.json({
        valid: true,
        timestamp: new Date().toISOString(),
        signer: 'MOCK-SIGNER',
        certificate_version: verification.certificate_version,
        raw: { provider: 'BSRE-MOCK', note: 'Verification mocked' }
      })
    }

    const verifyUrl = (process.env.BSRE_VERIFY_API_URL || `${process.env.BSRE_SIGN_API_URL}/verify`)
    if (!verifyUrl) return NextResponse.json({ valid: false, message: 'BSRE verify URL belum dikonfigurasi' }, { status: 500 })

    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BSRE_API_KEY || '',
        'Authorization': `Bearer ${process.env.BSRE_API_KEY || ''}`
      },
      body: JSON.stringify({
        document_id: String(documentId),
        signature_data: verification.signature_data
      })
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json({ valid: false, message: errText || 'Gagal memverifikasi dokumen' }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))

    return NextResponse.json({
      valid: !!data.valid,
      timestamp: data.timestamp,
      signer: data.signer,
      certificate_version: verification.certificate_version,
      raw: data
    })
  } catch (e) {
    return NextResponse.json({ valid: false, message: 'Gagal memverifikasi dokumen' }, { status: 500 })
  }
}
