import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const no = searchParams.get('no')
    const id = searchParams.get('id')
    
    if (!no && !id) {
      return NextResponse.json({ error: 'Either "no" or "id" parameter is required' }, { status: 400 })
    }

    console.log('🔍 [API] Checking verification for certificate:', id ? `ID=${id}` : `NO=${no}`)

    // Find certificate by ID (preferred) or certificate number
    let cert, certErr
    if (id) {
      // Use ID - guaranteed unique
      const result = await supabaseAdmin
        .from('certificate')
        .select('id, no_certificate, no_order, issue_date, station, instrument, version, created_at')
        .eq('id', id)
        .maybeSingle()
      cert = result.data
      certErr = result.error
    } else {
      // Use certificate number - get the latest one if duplicates exist
      const result = await supabaseAdmin
        .from('certificate')
        .select('id, no_certificate, no_order, issue_date, station, instrument, version, created_at')
        .eq('no_certificate', no)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      cert = result.data
      certErr = result.error
    }

    if (certErr) {
      console.error('❌ [API] Error fetching certificate:', certErr)
      return NextResponse.json({ error: certErr.message }, { status: 500 })
    }
    if (!cert) {
      console.log('⚠️ [API] Certificate not found:', no)
      return NextResponse.json({ valid: false, message: 'Certificate not found' }, { status: 404 })
    }

    console.log('✅ [API] Certificate found, ID:', cert.id, 'Version:', cert.version ?? 1)

    // Check level 3 verification approved - try WITHOUT version filter first
    const { data: verif, error: vErr } = await supabaseAdmin
      .from('certificate_verification')
      .select('status, signed_at, signature_data, certificate_version')
      .eq('certificate_id', cert.id)
      .eq('verification_level', 3)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (vErr) {
      console.error('❌ [API] Error checking verification:', vErr)
      // Don't fail - just return invalid
      return NextResponse.json({
        valid: false,
        certificate: {
          number: cert.no_certificate,
          order: cert.no_order,
          issue_date: cert.issue_date,
          version: cert.version ?? 1,
        },
        verification: null,
      })
    }

    const valid = !!verif && verif.status === 'approved'
    console.log('🎯 [API] Verification status:', valid ? 'APPROVED (Black)' : 'NOT APPROVED (Red)')
    console.log('📋 [API] Verification data:', verif)

    return NextResponse.json({
      valid,
      certificate: {
        number: cert.no_certificate,
        order: cert.no_order,
        issue_date: cert.issue_date,
        version: cert.version ?? 1,
      },
      verification: verif || null,
    })
  } catch (e: any) {
    console.error('💥 [API] Unexpected error:', e)
    return NextResponse.json({ 
      error: e?.message || 'Internal error',
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 })
  }
}
