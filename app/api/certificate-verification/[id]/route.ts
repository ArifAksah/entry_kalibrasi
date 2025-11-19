import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Type definitions
interface CertificateData {
  id: number;
  no_certificate: string;
  no_order?: string;
  no_identification?: string;
  verifikator_1: string;
  verifikator_2: string;
  authorized_by: string;
  version?: number;
}

interface CertificateVerification {
  id: string;
  certificate_id: string;
  verification_level: number;
  verified_by: string;
  status: string;
  notes?: string;
  rejection_reason?: string;
  approval_notes?: string;
  created_at: string;
  updated_at: string;
  certificates?: CertificateData;
}

// =======================
// GET - Get all certificate verifications or specific one
// =======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (id) {
      // Get specific certificate verification
      const { data, error } = await supabaseAdmin
        .from('certificate_verification')
        .select(`
          *,
          certificate:certificate_id (
            id,
            no_certificate,
            no_order,
            no_identification,
            verifikator_1,
            verifikator_2,
            authorized_by,
            version
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)
    } else {
      // Get all certificate verifications
      const { data, error } = await supabaseAdmin
        .from('certificate_verification')
        .select(`
          *,
          certificate:certificate_id (
            id,
            no_certificate,
            no_order,
            no_identification
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)
    }
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch certificate verifications' }, { status: 500 })
  }
}

// =======================
// POST - Create new certificate verification
// =======================
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      certificate_id, 
      verification_level, 
      notes, 
      status = 'pending' 
    } = body

    if (!certificate_id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    if (!verification_level) {
      return NextResponse.json({ error: 'Verification level is required' }, { status: 400 })
    }

    // Get certificate data with all necessary fields
    const { data: certData, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, verifikator_1, verifikator_2, authorized_by, version')
      .eq('id', certificate_id)
      .single()

    if (certError || !certData) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Type assertion untuk menghindari error TypeScript
    const certificate = certData as CertificateData

    // Check if user is authorized for the verification level
    let isAuthorized = false

    switch (verification_level) {
      case 1:
        isAuthorized = certificate.verifikator_1 === user.id
        break
      case 2:
        isAuthorized = certificate.verifikator_2 === user.id
        break
      case 3:
        // PERBAIKAN: Gunakan type assertion
        isAuthorized = certificate.authorized_by === user.id
        break
      default:
        return NextResponse.json({ error: 'Invalid verification level' }, { status: 400 })
    }

    if (!isAuthorized) {
      return NextResponse.json({
        error: `You are not assigned as ${ 
          verification_level === 1 ? 'Verifikator 1' : 
          verification_level === 2 ? 'Verifikator 2' : 
          'Authorized By' 
        } for this certificate`
      }, { status: 403 })
    }

    // Check if verification already exists for this level
    const { data: existingVerification, error: checkError } = await supabaseAdmin
      .from('certificate_verification')
      .select('id')
      .eq('certificate_id', certificate_id)
      .eq('verification_level', verification_level)
      .single()

    if (existingVerification && !checkError) {
      return NextResponse.json({ 
        error: 'Verification already exists for this level' 
      }, { status: 409 })
    }

    // Create new verification
    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .insert({
        certificate_id,
        verification_level,
        verified_by: user.id,
        status,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('Error creating verification:', e)
    return NextResponse.json({ error: 'Failed to create certificate verification' }, { status: 500 })
  }
}

// =======================
// PUT - Update certificate verification by ID
// =======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { status, notes, rejection_reason, approval_notes } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Get current verification
    const { data: currentVerification, error: getError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('id', id)
      .single()

    if (getError || !currentVerification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    // Check if user is authorized to update this verification
    if (currentVerification.verified_by !== user.id) {
      return NextResponse.json({ 
        error: 'You are not authorized to update this verification' 
      }, { status: 403 })
    }

    // Update verification
    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .update({
        status,
        notes: notes || null,
        rejection_reason: rejection_reason || null,
        approval_notes: approval_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If Verifikator 1 approved after a rejection from Verifikator 2,
    // reset Verifikator 2 status back to 'pending' for the same certificate (and version if available)
    try {
      if (status === 'approved' && currentVerification.verification_level === 1) {
        const certVersion = (currentVerification as any).certificate_version ?? null

        let query = supabaseAdmin
          .from('certificate_verification')
          .update({
            status: 'pending',
            notes: null,
            rejection_reason: null,
            // Clear optional detailed rejection fields if they exist
            rejection_reason_detailed: null,
            rejection_destination: null,
            rejection_timestamp: null,
            approval_notes: null,
            updated_at: new Date().toISOString(),
          })
          .eq('certificate_id', currentVerification.certificate_id)
          .eq('verification_level', 2)
          .eq('status', 'rejected')

        // Scope to same certificate version if present
        if (certVersion !== null) {
          // @ts-ignore - column may exist in DB even if not in TS type
          query = query.eq('certificate_version', certVersion)
        }

        const { error: resetErr } = await query
        if (resetErr) {
          // Do not fail the main request; log for debugging
          console.error('Failed to reset Verifikator 2 status to pending:', resetErr)
        }
      }
    } catch (resetCatchErr) {
      console.error('Error while attempting to reset V2 status:', resetCatchErr)
      // swallow
    }

    // Create log entry for verification action (approval/rejection)
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      const verificationLevel = currentVerification.verification_level
      const actionMap: Record<string, string> = {
        'approved': verificationLevel === 1 ? 'approved_v1' : verificationLevel === 2 ? 'approved_v2' : 'approved_assignor',
        'rejected': verificationLevel === 1 ? 'rejected_v1' : verificationLevel === 2 ? 'rejected_v2' : 'rejected_assignor'
      }
      const logAction = actionMap[status] || 'updated'
      
      // Get current certificate status
      const { data: currentCert } = await supabaseAdmin
        .from('certificate')
        .select('status')
        .eq('id', currentVerification.certificate_id)
        .single()
      
      await createCertificateLog({
        certificate_id: currentVerification.certificate_id,
        action: logAction as any,
        performed_by: user.id,
        notes: notes || null,
        rejection_reason: rejection_reason || null,
        approval_notes: approval_notes || null,
        verification_level: verificationLevel,
        previous_status: currentCert?.status || null,
        new_status: status === 'approved' ? (verificationLevel === 3 ? 'approved' : 'sent') : 'rejected'
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Error updating verification:', e)
    return NextResponse.json({ error: 'Failed to update certificate verification' }, { status: 500 })
  }
}

// =======================
// DELETE - Delete certificate verification by ID
// =======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get current verification
    const { data: currentVerification, error: getError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('id', id)
      .single()

    if (getError || !currentVerification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    // Check if user is authorized
    if (currentVerification.verified_by !== user.id) {
      return NextResponse.json({ 
        error: 'You are not authorized to delete this verification' 
      }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('certificate_verification')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Verification deleted successfully' })
  } catch (e) {
    console.error('Error deleting verification:', e)
    return NextResponse.json({ error: 'Failed to delete certificate verification' }, { status: 500 })
  }
}