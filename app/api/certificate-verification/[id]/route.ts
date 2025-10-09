import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Type definitions
interface CertificateData {
  id: string;
  certificate_number: string;
  customer_name: string;
  instrument_name: string;
  verifikator_1: string;
  verifikator_2: string;
  authorized_by: string; // Pastikan ini ada
  version?: string;
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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Get specific certificate verification
      const { data, error } = await supabaseAdmin
        .from('certificate_verification')
        .select(`
          *,
          certificates:certificate_id (
            id,
            certificate_number,
            customer_name,
            instrument_name,
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
          certificates:certificate_id (
            id,
            certificate_number,
            customer_name,
            instrument_name
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
      .from('certificates')
      .select('id, certificate_number, verifikator_1, verifikator_2, authorized_by, version')
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
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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

    return NextResponse.json(data)
  } catch (e) {
    console.error('Error updating verification:', e)
    return NextResponse.json({ error: 'Failed to update certificate verification' }, { status: 500 })
  }
}

// =======================
// DELETE - Delete certificate verification by ID
// =======================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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