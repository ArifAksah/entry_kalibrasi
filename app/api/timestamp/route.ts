import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { documentId, documentHash } = await request.json()
    if (!documentId || !documentHash) return NextResponse.json({ success: false, message: 'documentId dan documentHash wajib' }, { status: 400 })

    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'
    if (isMock) {
      const timestamp = new Date().toISOString()
      const token = 'mock-timestamp-token'
      const { error } = await supabaseAdmin
        .from('certificate_verification')
        .update({
          timestamp_data: { token, timestamp, provider: 'BSRE-MOCK' },
          updated_at: new Date().toISOString()
        })
        .eq('certificate_id', documentId)
        .eq('verification_level', 3)
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      return NextResponse.json({ success: true, timestamp })
    }

    const tsUrl = (process.env.BSRE_TIMESTAMP_API_URL || `${process.env.BSRE_SIGN_API_URL}/timestamp`)
    if (!tsUrl) return NextResponse.json({ success: false, message: 'BSRE timestamp URL belum dikonfigurasi' }, { status: 500 })

    const res = await fetch(tsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BSRE_API_KEY || '',
        'Authorization': `Bearer ${process.env.BSRE_API_KEY || ''}`
      },
      body: JSON.stringify({ document_hash: documentHash })
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return NextResponse.json({ success: false, message: txt || 'Gagal mendapatkan timestamp' }, { status: 502 })
    }

    const { timestamp, token } = await res.json()

    const { error } = await supabaseAdmin
      .from('certificate_verification')
      .update({
        timestamp_data: { token, timestamp },
        updated_at: new Date().toISOString()
      })
      .eq('certificate_id', documentId)
      .eq('verification_level', 3)

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    return NextResponse.json({ success: true, timestamp })
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Gagal menambahkan timestamp' }, { status: 500 })
  }
}
