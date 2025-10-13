import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET - Get all certificate verifications
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // If table does not exist yet or permissions block, return empty array instead of 500
      const msg = (error as any)?.message || ''
      const code = (error as any)?.code || ''
      if (code === '42P01' || /relation .* does not exist/i.test(msg) || /permission denied/i.test(msg)) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch certificate verifications' }, { status: 500 })
  }
}

// POST - Create certificate verification
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { 
      certificate_id, 
      verification_level, // 1 or 2
      status, // 'pending', 'approved', 'rejected'
      notes,
      rejection_reason,
      approval_notes,
      verified_by,
      certificate_version
    } = body

    // Use user.id from auth instead of verified_by from body
    const actualVerifiedBy = user.id

    if (!certificate_id || !verification_level || !status) {
      return NextResponse.json({
        error: 'Certificate ID, verification level, and status are required',
      }, { status: 400 })
    }

    // Validate certificate exists
    const { data: certData, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, verifikator_1, verifikator_2, authorized_by, version')
      .eq('id', certificate_id)
      .single()

    if (certError || !certData) {
      return NextResponse.json({
        error: 'Certificate does not exist',
      }, { status: 400 })
    }

    // Debug logging
    console.log('=== Certificate Verification Debug ===')
    console.log('Verification Level:', verification_level)
    console.log('Certificate ID:', certificate_id)
    console.log('Certificate V1:', certData.verifikator_1)
    console.log('Certificate V2:', certData.verifikator_2)
    console.log('Verified By (from body):', verified_by)
    console.log('Actual Verified By (from auth):', actualVerifiedBy)
    console.log('User ID Type:', typeof actualVerifiedBy)
    console.log('V1 Type:', typeof certData.verifikator_1)
    console.log('V2 Type:', typeof certData.verifikator_2)
    console.log('=====================================')

    // Check if verifikator fields are null (certificate created before validation)
    if (!certData.verifikator_1 || !certData.verifikator_2) {
      return NextResponse.json({
        error: 'Certificate does not have verifikator assignments. Please edit the certificate to assign verifikators.',
      }, { status: 400 })
    }

    // Validate verification level assignment
    if (verification_level === 1 && certData.verifikator_1 !== actualVerifiedBy) {
      return NextResponse.json({
        error: 'You are not assigned as Verifikator 1 for this certificate',
      }, { status: 403 })
    }

    if (verification_level === 2 && certData.verifikator_2 !== actualVerifiedBy) {
      return NextResponse.json({
        error: 'You are not assigned as Verifikator 2 for this certificate',
      }, { status: 403 })
    }

    if (verification_level === 3 && certData.authorized_by !== actualVerifiedBy) {
      return NextResponse.json({
        error: 'You are not assigned as Authorized By for this certificate',
      }, { status: 403 })
    }

    // Block if any rejection exists for this certificate (must revise first)
    {
      const { data: anyVerif, error: anyErr } = await supabaseAdmin
        .from('certificate_verification')
        .select('status, verification_level')
        .eq('certificate_id', certificate_id)

      if (!anyErr && anyVerif?.some(v => v.status === 'rejected')) {
        return NextResponse.json({
          error: 'Certificate has been rejected. Please revise the certificate and resubmit for verification.'
        }, { status: 400 })
      }
    }

    // Enforce sequence: Verifikator 2 can only verify after Verifikator 1 approved
    if (verification_level === 2) {
      const { data: v1, error: v1Err } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', certificate_id)
        .eq('verification_level', 1)
        .eq('certificate_version', certificate_version ?? certData.version ?? 1)
        .maybeSingle()
      if (v1Err) {
        // tolerate missing table errors elsewhere; here return explicit requirement
      }
      if (!v1 || v1.status !== 'approved') {
        return NextResponse.json({
          error: 'Verifikator 2 can verify only after Verifikator 1 has approved.'
        }, { status: 400 })
      }
    }

    // Enforce sequence: Authorized By can only verify after Verifikator 2 approved
    if (verification_level === 3) {
      const { data: v2, error: v2Err } = await supabaseAdmin
        .from('certificate_verification')
        .select('status')
        .eq('certificate_id', certificate_id)
        .eq('verification_level', 2)
        .eq('certificate_version', certificate_version ?? certData.version ?? 1)
        .maybeSingle()
      if (v2Err) {
        // tolerate missing table errors elsewhere; here return explicit requirement
      }
      if (!v2 || v2.status !== 'approved') {
        return NextResponse.json({
          error: 'Authorized By can verify only after Verifikator 2 has approved.'
        }, { status: 400 })
      }
    }

    // Check if verification already exists for this level
    const { data: existingVerification, error: existingError } = await supabaseAdmin
      .from('certificate_verification')
      .select('id')
      .eq('certificate_id', certificate_id)
      .eq('verification_level', verification_level)
      .single()

    if (existingVerification) {
      return NextResponse.json({
        error: 'Verification for this level already exists',
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .insert({ 
        certificate_id,
        verification_level,
        status,
        notes: notes || null,
        rejection_reason: rejection_reason || null,
        approval_notes: approval_notes || null,
        verified_by: actualVerifiedBy,
        certificate_version: certificate_version ?? certData.version ?? 1
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create certificate verification' }, { status: 500 })
  }
}
