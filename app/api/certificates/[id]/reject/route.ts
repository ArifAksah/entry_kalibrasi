import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET - Get rejection options for verifikator 2
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = parseInt(id)

    if (!certificateId || isNaN(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
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

    // Get certificate info
    const { data: certificate, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, sent_by, verifikator_1, verifikator_2, status')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check if user is verifikator 2
    if (certificate.verifikator_2 !== user.id) {
      return NextResponse.json({ 
        error: 'You are not authorized to view rejection options for this certificate' 
      }, { status: 403 })
    }

    // Get personel info for display
    const { data: personel, error: personelError } = await supabaseAdmin
      .from('personel')
      .select('id, name')
      .in('id', [certificate.sent_by, certificate.verifikator_1])

    if (personelError) {
      return NextResponse.json({ error: 'Failed to fetch personel info' }, { status: 500 })
    }

    const creator = personel.find(p => p.id === certificate.sent_by)
    const verifikator1 = personel.find(p => p.id === certificate.verifikator_1)

    const options = [
      {
        value: 'creator',
        label: 'Kembali ke Pembuat Sertifikat',
        description: `Sertifikat akan dikembalikan ke ${creator?.name || 'Pembuat'} untuk diperbaiki`,
        icon: '👤'
      },
      {
        value: 'verifikator_1',
        label: 'Kembali ke Verifikator 1',
        description: `Sertifikat akan dikembalikan ke ${verifikator1?.name || 'Verifikator 1'} untuk review ulang`,
        icon: '🔍'
      }
    ]

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        no_certificate: certificate.no_certificate,
        status: certificate.status
      },
      options
    })

  } catch (error) {
    console.error('Error getting rejection options:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Process rejection with destination
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = parseInt(id)

    if (!certificateId || isNaN(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
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
    const { 
      verification_level, 
      rejection_reason, 
      rejection_destination = 'creator' 
    } = body

    if (!verification_level || !rejection_reason) {
      return NextResponse.json({ 
        error: 'Verification level and rejection reason are required' 
      }, { status: 400 })
    }

    // Validate verification level
    if (![1, 2].includes(verification_level)) {
      return NextResponse.json({ 
        error: 'Invalid verification level. Must be 1 or 2' 
      }, { status: 400 })
    }

    // Validate rejection destination for verifikator 2
    if (verification_level === 2 && !['creator', 'verifikator_1'].includes(rejection_destination)) {
      return NextResponse.json({ 
        error: 'Invalid rejection destination. Must be "creator" or "verifikator_1"' 
      }, { status: 400 })
    }

    // For verifikator 1, always go to creator
    const actualDestination = verification_level === 1 ? 'creator' : rejection_destination

    // Get certificate info
    const { data: certificate, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, verifikator_1, verifikator_2, sent_by, status')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check authorization
    const isVerifikator1 = certificate.verifikator_1 === user.id
    const isVerifikator2 = certificate.verifikator_2 === user.id

    if (!isVerifikator1 && !isVerifikator2) {
      return NextResponse.json({ 
        error: 'You are not authorized to reject this certificate' 
      }, { status: 403 })
    }

    // Check if user is trying to reject the correct level
    if ((isVerifikator1 && verification_level !== 1) || (isVerifikator2 && verification_level !== 2)) {
      return NextResponse.json({ 
        error: 'You can only reject your assigned verification level' 
      }, { status: 403 })
    }

    // Get current verification
    const { data: verification, error: verifError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('certificate_id', certificateId)
      .eq('verification_level', verification_level)
      .single()

    if (verifError || !verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    // Check if verification is already processed
    if (verification.status !== 'pending') {
      return NextResponse.json({ 
        error: 'This verification has already been processed' 
      }, { status: 400 })
    }

    // Create rejection history entry
    const rejectionEntry = {
      verification_level,
      rejection_reason,
      rejection_destination: actualDestination,
      rejection_timestamp: new Date().toISOString(),
      rejected_by: user.id
    }

    // Get current rejection history
    const { data: currentCert, error: currentError } = await supabaseAdmin
      .from('certificate')
      .select('rejection_history, rejection_count')
      .eq('id', certificateId)
      .single()

    if (currentError) {
      return NextResponse.json({ error: 'Failed to get certificate data' }, { status: 500 })
    }

    const rejectionHistory = currentCert.rejection_history || []
    const newRejectionHistory = [...rejectionHistory, rejectionEntry]

    // Update verification record
    const { error: updateVerifError } = await supabaseAdmin
      .from('certificate_verification')
      .update({
        status: 'rejected',
        rejection_reason_detailed: rejection_reason,
        rejection_destination: actualDestination,
        rejection_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', verification.id)

    if (updateVerifError) {
      return NextResponse.json({ 
        error: 'Failed to update verification record' 
      }, { status: 500 })
    }

    // Update certificate status and rejection info
    const newStatus = actualDestination === 'creator' ? 'draft' : 'sent'
    
    const { error: updateCertError } = await supabaseAdmin
      .from('certificate')
      .update({
        status: newStatus,
        rejection_count: (currentCert.rejection_count || 0) + 1,
        last_rejection_by: user.id,
        last_rejection_at: new Date().toISOString(),
        rejection_history: newRejectionHistory
      })
      .eq('id', certificateId)

    if (updateCertError) {
      return NextResponse.json({ 
        error: 'Failed to update certificate status' 
      }, { status: 500 })
    }

    // If going back to verifikator 1, reset their verification status
    if (actualDestination === 'verifikator_1') {
      const { error: resetVerif1Error } = await supabaseAdmin
        .from('certificate_verification')
        .update({
          status: 'pending',
          notes: null,
          rejection_reason_detailed: null,
          approval_notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('certificate_id', certificateId)
        .eq('verification_level', 1)

      if (resetVerif1Error) {
        console.error('Failed to reset verifikator 1 status:', resetVerif1Error)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate rejected successfully',
      certificate: {
        id: certificateId,
        status: newStatus,
        rejection_destination: actualDestination
      },
      rejection: rejectionEntry
    })

  } catch (error) {
    console.error('Error processing rejection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





