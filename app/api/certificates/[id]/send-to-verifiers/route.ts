import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '../../../../../lib/wa'
import { buildDraftSubmissionMessage } from '../../../../../lib/wa-messages'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VERIFICATION_ASSIGNMENTS = [
  { level: 1, field: 'verifikator_1' },
  { level: 2, field: 'verifikator_2' },
  { level: 3, field: 'verifikator_3' },
  { level: 4, field: 'authorized_by' }
] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = parseInt(id)
    const { sent_by } = await request.json()

    if (!certificateId || isNaN(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
    }

    if (!sent_by) {
      return NextResponse.json({ error: 'sent_by is required' }, { status: 400 })
    }

    const { data: certificate, error: certError } = await supabase
      .from('certificate')
      .select('*')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (certificate.status !== 'draft') {
      return NextResponse.json({ error: 'Certificate is not in draft status' }, { status: 400 })
    }

    if (!certificate.verifikator_1 || !certificate.verifikator_2 || !certificate.verifikator_3 || !certificate.authorized_by) {
      return NextResponse.json({
        error: 'Verifikator 1, Verifikator 2, Verifikator 3, and Penandatangan must be assigned before sending'
      }, { status: 400 })
    }

    const assignedIds = [
      certificate.verifikator_1,
      certificate.verifikator_2,
      certificate.verifikator_3,
      certificate.authorized_by
    ]

    const { data: assignedPersonel, error: personelError } = await supabase
      .from('personel')
      .select('id')
      .in('id', assignedIds)

    if (personelError || !assignedPersonel || assignedPersonel.length !== assignedIds.length) {
      return NextResponse.json({
        error: 'One or more assigned verifiers/signers do not exist in personel table'
      }, { status: 400 })
    }

    const currentVersion = certificate.version || 1
    const rejectionHistory = Array.isArray(certificate.rejection_history) ? [...certificate.rejection_history] : []
    const latestRejection = rejectionHistory
      .sort((a: any, b: any) => new Date(b?.rejection_timestamp || 0).getTime() - new Date(a?.rejection_timestamp || 0).getTime())[0] || null
    const resetFromLevel = Number(latestRejection?.reset_from_level || 1)

    const { data: allVerifications, error: verificationsError } = await supabase
      .from('certificate_verification')
      .select('*')
      .eq('certificate_id', certificateId)

    if (verificationsError) {
      return NextResponse.json({ error: 'Failed to load verification history' }, { status: 500 })
    }

    const getPreservedApproval = (level: number) => {
      return (allVerifications || [])
        .filter((verification: any) =>
          verification.verification_level === level &&
          verification.status === 'approved' &&
          (verification.certificate_version ?? 1) <= currentVersion
        )
        .sort((a: any, b: any) => {
          const versionA = a.certificate_version ?? 1
          const versionB = b.certificate_version ?? 1
          if (versionA !== versionB) return versionB - versionA
          return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
        })[0] || null
    }

    const now = new Date().toISOString()
    const verificationRecords = VERIFICATION_ASSIGNMENTS.map(({ level, field }) => {
      const assignedUserId = certificate[field]
      const preservedApprovalCandidate = level < resetFromLevel ? getPreservedApproval(level) : null
      const preservedApproval = preservedApprovalCandidate?.verified_by === assignedUserId
        ? preservedApprovalCandidate
        : null

      return {
        certificate_id: certificateId,
        verification_level: level,
        verified_by: assignedUserId,
        certificate_version: currentVersion,
        status: preservedApproval ? 'approved' : 'pending',
        notes: null,
        rejection_reason: null,
        rejection_reason_detailed: null,
        rejection_destination: null,
        rejection_timestamp: null,
        approval_notes: preservedApproval?.approval_notes || null,
        created_at: preservedApproval?.created_at || now,
        updated_at: now
      }
    })

    const { error: deleteCurrentVersionError } = await supabase
      .from('certificate_verification')
      .delete()
      .eq('certificate_id', certificateId)
      .eq('certificate_version', currentVersion)

    if (deleteCurrentVersionError) {
      return NextResponse.json({
        error: `Failed to reset current verification records: ${deleteCurrentVersionError.message}`
      }, { status: 500 })
    }

    const { error: insertError } = await supabase
      .from('certificate_verification')
      .insert(verificationRecords)

    if (insertError) {
      return NextResponse.json({
        error: `Failed to create verification records: ${insertError.message}`
      }, { status: 500 })
    }

    const sentAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('certificate')
      .update({
        status: 'sent',
        sent_to_verifiers_at: sentAt,
        results_frozen_at: certificate.results_frozen_at ?? sentAt,
        sent_by: sent_by,
        repair_status: 'none'
      })
      .eq('id', certificateId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update certificate status' }, { status: 500 })
    }

    try {
      const { createCertificateLog } = await import('../../../../../lib/certificate-log-helper')
      await createCertificateLog({
        certificate_id: certificateId,
        action: 'sent',
        performed_by: sent_by,
        previous_status: 'draft',
        new_status: 'sent',
        notes: latestRejection
          ? `Certificate resubmitted after rejection. Review resumes from level ${resetFromLevel}.`
          : 'Certificate sent to verifiers for verification'
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
    }

    // Send WhatsApp notifications to verifiers and penandatangan (fire-and-forget)
    void (async () => {
      try {
        // Fetch calibrator name from personel table
        const { data: calibrator } = await supabase
          .from('personel')
          .select('name')
          .eq('id', sent_by)
          .single()

        const calibratorName = calibrator?.name || 'Unknown'

        // Fetch phone numbers for all recipients
        const recipientIds = [
          certificate.verifikator_1,
          certificate.verifikator_2,
          certificate.verifikator_3,
          certificate.authorized_by
        ]

        const { data: recipients } = await supabase
          .from('personel')
          .select('id, name, phone')
          .in('id', recipientIds)

        if (!recipients || recipients.length === 0) {
          console.warn(`[send-to-verifiers] No recipients found for certificate ${certificateId}`)
          return
        }

        const certificateNumber = certificate.no_certificate || `ID-${certificateId}`
        const message = buildDraftSubmissionMessage(certificateNumber, calibratorName)

        for (const recipient of recipients) {
          if (!recipient.phone) {
            console.warn(`[send-to-verifiers] No phone number for personnel ${recipient.name || recipient.id}, skipping WA notification`)
            continue
          }

          try {
            const result = await sendWhatsApp({ phone: recipient.phone, message })
            if (!result.success) {
              console.error(`[send-to-verifiers] Failed to send WA notification to ${recipient.phone} (${recipient.name || recipient.id}): ${result.error}`)
            }
          } catch (sendError) {
            console.error(`[send-to-verifiers] Error sending WA notification to ${recipient.phone} (${recipient.name || recipient.id}):`, sendError)
          }
        }
      } catch (waError) {
        console.error(`[send-to-verifiers] Error in WA notification block for certificate ${certificateId}:`, waError)
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Certificate sent to verifiers successfully',
      certificate: {
        id: certificateId,
        status: 'sent',
        sent_to_verifiers_at: sentAt,
        results_frozen_at: certificate.results_frozen_at ?? sentAt,
        sent_by: sent_by,
        reset_from_level: resetFromLevel
      }
    })
  } catch (error) {
    console.error('Error in send-to-verifiers API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
