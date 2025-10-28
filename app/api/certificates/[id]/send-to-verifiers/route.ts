import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const certificateId = parseInt(params.id)
    const { sent_by } = await request.json()

    if (!certificateId || isNaN(certificateId)) {
      return NextResponse.json(
        { error: 'Invalid certificate ID' },
        { status: 400 }
      )
    }

    if (!sent_by) {
      return NextResponse.json(
        { error: 'sent_by is required' },
        { status: 400 }
      )
    }

    // Get certificate details
    const { data: certificate, error: certError } = await supabase
      .from('certificate')
      .select('*')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Check if certificate is in draft status
    if (certificate.status !== 'draft') {
      return NextResponse.json(
        { error: 'Certificate is not in draft status' },
        { status: 400 }
      )
    }

    // Check if verifikator_1, verifikator_2, and assignor are assigned
    if (!certificate.verifikator_1 || !certificate.verifikator_2 || !certificate.assignor) {
      return NextResponse.json(
        { error: 'Verifikator 1, Verifikator 2, and Assignor must be assigned before sending' },
        { status: 400 }
      )
    }

    // Validate that verifikator_1 and verifikator_2 exist in personel table
    const { data: verifikator1Data, error: verifikator1Error } = await supabase
      .from('personel')
      .select('id')
      .eq('id', certificate.verifikator_1)
      .single()

    if (verifikator1Error || !verifikator1Data) {
      return NextResponse.json(
        { error: 'Verifikator 1 does not exist in personel table' },
        { status: 400 }
      )
    }

    const { data: verifikator2Data, error: verifikator2Error } = await supabase
      .from('personel')
      .select('id')
      .eq('id', certificate.verifikator_2)
      .single()

    if (verifikator2Error || !verifikator2Data) {
      return NextResponse.json(
        { error: 'Verifikator 2 does not exist in personel table' },
        { status: 400 }
      )
    }

    // Update certificate status to 'sent' and set sent timestamp
    const { error: updateError } = await supabase
      .from('certificate')
      .update({
        status: 'sent',
        sent_to_verifiers_at: new Date().toISOString(),
        sent_by: sent_by
      })
      .eq('id', certificateId)

    if (updateError) {
      console.error('Error updating certificate:', updateError)
      return NextResponse.json(
        { error: 'Failed to update certificate status' },
        { status: 500 }
      )
    }

    // Create verification records for verifikator 1 and 2
    const verificationRecords = [
      {
        certificate_id: certificateId,
        verification_level: 1,
        status: 'pending',
        verified_by: certificate.verifikator_1,
        certificate_version: certificate.version || 1
      },
      {
        certificate_id: certificateId,
        verification_level: 2,
        status: 'pending',
        verified_by: certificate.verifikator_2,
        certificate_version: certificate.version || 1
      }
    ]

    // Debug logging
    console.log('=== Creating Verification Records ===')
    console.log('Certificate ID:', certificateId)
    console.log('Verifikator 1:', certificate.verifikator_1)
    console.log('Verifikator 2:', certificate.verifikator_2)
    console.log('Certificate Version:', certificate.version || 1)
    console.log('Verification Records:', verificationRecords)
    console.log('=====================================')

    // Use a more aggressive approach: delete all verification records first
    // This ensures we start with a completely clean state
    console.log('=== Deleting existing verification records ===')
    const { error: deleteError } = await supabase
      .from('certificate_verification')
      .delete()
      .eq('certificate_id', certificateId)
    
    if (deleteError) {
      console.error('Error deleting existing verification records:', deleteError)
      // Rollback certificate status
      await supabase
        .from('certificate')
        .update({
          status: 'draft',
          sent_to_verifiers_at: null,
          sent_by: null
        })
        .eq('id', certificateId)
      
      return NextResponse.json(
        { error: `Failed to reset verification records: ${deleteError.message}` },
        { status: 500 }
      )
    }
    
    console.log('Existing verification records deleted successfully')

    // Now insert fresh verification records using a single insert operation
    console.log('=== Creating new verification records ===')
    const { error: insertError } = await supabase
      .from('certificate_verification')
      .insert(verificationRecords.map(record => ({
        ...record,
        status: 'pending',
        notes: null,
        rejection_reason: null,
        rejection_reason_detailed: null,
        rejection_destination: null,
        rejection_timestamp: null,
        approval_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))
    
    if (insertError) {
      console.error('Error creating verification records:', insertError)
      // Rollback certificate status
      await supabase
        .from('certificate')
        .update({
          status: 'draft',
          sent_to_verifiers_at: null,
          sent_by: null
        })
        .eq('id', certificateId)
      
      return NextResponse.json(
        { error: `Failed to create verification records: ${insertError.message}` },
        { status: 500 }
      )
    }
    
    console.log('New verification records created successfully')

    // TODO: Send notifications to verifikator 1, verifikator 2, and assignor
    // This could be implemented with email notifications or in-app notifications

    return NextResponse.json({
      success: true,
      message: 'Certificate sent to verifiers successfully',
      certificate: {
        id: certificateId,
        status: 'sent',
        sent_to_verifiers_at: new Date().toISOString(),
        sent_by: sent_by
      }
    })

  } catch (error) {
    console.error('Error in send-to-verifiers API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
