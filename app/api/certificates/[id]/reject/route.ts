import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const REJECTION_CATEGORY_MAP: Record<string, { label: string; reset_from_level: number }> = {
  administrative: {
    label: 'Administratif',
    reset_from_level: 3
  },
  uncertainty: {
    label: 'Ketidakpastian',
    reset_from_level: 2
  },
  qc_data: {
    label: 'QC / Data Teknis',
    reset_from_level: 1
  }
}

const createNotification = async (userId: string | null | undefined, message: string, link: string) => {
  if (!userId) return

  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        message,
        link
      })

    if (error) {
      console.error(`Failed to create notification for user ${userId}:`, error)
    }
  } catch (error) {
    console.error(`Failed to create notification for user ${userId}:`, error)
  }
}

// GET - Get rejection category options
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

    const { data: certificate, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, verifikator_1, verifikator_2, verifikator_3, status')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const isAssignedVerifier =
      certificate.verifikator_1 === user.id ||
      certificate.verifikator_2 === user.id ||
      certificate.verifikator_3 === user.id

    if (!isAssignedVerifier) {
      return NextResponse.json({
        error: 'You are not authorized to view rejection options for this certificate'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        no_certificate: certificate.no_certificate,
        status: certificate.status
      },
      options: [
        {
          value: 'administrative',
          label: 'Administratif',
          description: 'Perbaikan administratif. Setelah revisi, verifikasi diulang mulai Verifikator 3.',
          reset_from_level: 3,
          icon: '📝'
        },
        {
          value: 'uncertainty',
          label: 'Ketidakpastian',
          description: 'Masalah pada uncertainty/interpolasi. Setelah revisi, verifikasi diulang mulai Verifikator 2.',
          reset_from_level: 2,
          icon: '📏'
        },
        {
          value: 'qc_data',
          label: 'QC / Data Teknis',
          description: 'Masalah pada raw data, QC, atau hasil teknis. Setelah revisi, verifikasi diulang mulai Verifikator 1.',
          reset_from_level: 1,
          icon: '🧪'
        }
      ]
    })
  } catch (error) {
    console.error('Error getting rejection options:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Process rejection with category-based reset
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
      rejection_category = 'qc_data'
    } = body

    if (!verification_level || !rejection_reason) {
      return NextResponse.json({
        error: 'Verification level and rejection reason are required'
      }, { status: 400 })
    }

    if (![1, 2, 3].includes(verification_level)) {
      return NextResponse.json({
        error: 'Invalid verification level. Must be 1, 2, or 3'
      }, { status: 400 })
    }

    const categoryConfig = REJECTION_CATEGORY_MAP[rejection_category]
    if (!categoryConfig) {
      return NextResponse.json({ error: 'Invalid rejection category' }, { status: 400 })
    }

    const { data: certificate, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, verifikator_1, verifikator_2, verifikator_3, sent_by, status, version')
      .eq('id', certificateId)
      .single()

    if (certError || !certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const isVerifikator1 = certificate.verifikator_1 === user.id
    const isVerifikator2 = certificate.verifikator_2 === user.id
    const isVerifikator3 = certificate.verifikator_3 === user.id

    if (!isVerifikator1 && !isVerifikator2 && !isVerifikator3) {
      return NextResponse.json({
        error: 'You are not authorized to reject this certificate'
      }, { status: 403 })
    }

    if ((isVerifikator1 && verification_level !== 1) || (isVerifikator2 && verification_level !== 2) || (isVerifikator3 && verification_level !== 3)) {
      return NextResponse.json({
        error: 'You can only reject your assigned verification level'
      }, { status: 403 })
    }

    const certificateVersion = certificate.version || 1
    const rejectionTimestamp = new Date().toISOString()

    const { data: verification, error: verifError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('certificate_id', certificateId)
      .eq('verification_level', verification_level)
      .eq('certificate_version', certificateVersion)
      .maybeSingle()

    if (verifError) {
      return NextResponse.json({ error: 'Failed to load verification data' }, { status: 500 })
    }

    if (verification && verification.status !== 'pending') {
      return NextResponse.json({
        error: 'This verification has already been processed'
      }, { status: 400 })
    }

    const rejectionEntry = {
      verification_level,
      rejection_reason,
      rejection_category,
      rejection_category_label: categoryConfig.label,
      reset_from_level: categoryConfig.reset_from_level,
      rejection_timestamp: rejectionTimestamp,
      rejected_by: user.id
    }

    const { data: currentCert, error: currentError } = await supabaseAdmin
      .from('certificate')
      .select('rejection_history, rejection_count, status')
      .eq('id', certificateId)
      .single()

    if (currentError) {
      return NextResponse.json({ error: 'Failed to get certificate data' }, { status: 500 })
    }

    const rejectionHistory = Array.isArray(currentCert.rejection_history) ? currentCert.rejection_history : []
    const newRejectionHistory = [...rejectionHistory, rejectionEntry]

    if (verification) {
      const { error: updateVerifError } = await supabaseAdmin
        .from('certificate_verification')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason,
          rejection_reason_detailed: rejection_reason,
          rejection_destination: 'creator',
          rejection_timestamp: rejectionTimestamp,
          updated_at: rejectionTimestamp
        })
        .eq('id', verification.id)

      if (updateVerifError) {
        return NextResponse.json({
          error: 'Failed to update verification record'
        }, { status: 500 })
      }
    } else {
      const { error: insertVerifError } = await supabaseAdmin
        .from('certificate_verification')
        .insert({
          certificate_id: certificateId,
          verification_level,
          certificate_version: certificateVersion,
          verified_by: user.id,
          status: 'rejected',
          rejection_reason: rejection_reason,
          rejection_reason_detailed: rejection_reason,
          rejection_destination: 'creator',
          rejection_timestamp: rejectionTimestamp,
          created_at: rejectionTimestamp,
          updated_at: rejectionTimestamp
        })

      if (insertVerifError) {
        return NextResponse.json({
          error: 'Failed to create rejection verification record'
        }, { status: 500 })
      }
    }

    const newStatus = 'draft'

    const { error: updateCertError } = await supabaseAdmin
      .from('certificate')
      .update({
        status: newStatus,
        rejection_count: (currentCert.rejection_count || 0) + 1,
        last_rejection_by: user.id,
        last_rejection_at: rejectionTimestamp,
        rejection_history: newRejectionHistory
      })
      .eq('id', certificateId)

    if (updateCertError) {
      return NextResponse.json({
        error: 'Failed to update certificate status'
      }, { status: 500 })
    }

    try {
      const { createCertificateLog } = await import('../../../../../lib/certificate-log-helper')
      const actionMap: Record<number, string> = {
        1: 'rejected_v1',
        2: 'rejected_v2',
        3: 'rejected_v3'
      }
      const logAction = actionMap[verification_level] || 'rejected_v1'

      await createCertificateLog({
        certificate_id: certificateId,
        action: logAction as any,
        performed_by: user.id,
        rejection_reason: rejection_reason,
        verification_level: verification_level,
        previous_status: currentCert.status || null,
        new_status: newStatus,
        metadata: {
          rejection_category,
          rejection_category_label: categoryConfig.label,
          reset_from_level: categoryConfig.reset_from_level
        }
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
    }

    await createNotification(
      certificate.sent_by,
      `Sertifikat ${certificate.no_certificate} ditolak (${categoryConfig.label}). Buka catatan reject untuk melihat detail revisi.`,
      '/certificates'
    )

    // Send WhatsApp notification to the calibrator/konseptor (sent_by) with rejection reason
    void (async () => {
      try {
        const { sendWhatsApp } = await import('../../../../../lib/wa')
        const { buildRejectionMessage } = await import('../../../../../lib/wa-messages')

        // Get rejector name from personel table
        const { data: rejector } = await supabaseAdmin
          .from('personel')
          .select('name')
          .eq('id', user.id)
          .single()
        const rejectorName = rejector?.name || user.email || 'Verifikator'

        // Get calibrator/konseptor phone number
        if (certificate.sent_by) {
          const { data: calibrator } = await supabaseAdmin
            .from('personel')
            .select('name, phone')
            .eq('id', certificate.sent_by)
            .single()

          if (calibrator?.phone) {
            const certNumber = certificate.no_certificate || `ID-${certificateId}`
            const message = buildRejectionMessage(
              certNumber,
              rejectorName,
              verification_level,
              rejection_reason
            )

            const result = await sendWhatsApp({ phone: calibrator.phone, message })
            if (!result.success) {
              console.error(`[reject] Failed to send rejection WA to calibrator ${calibrator.name}: ${result.error}`)
            }
          } else {
            console.warn(`[reject] Calibrator ${certificate.sent_by} has no phone number, skipping WA notification`)
          }
        }
      } catch (waError) {
        console.error('[reject] Error sending rejection WA notification:', waError)
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Certificate rejected successfully',
      certificate: {
        id: certificateId,
        status: newStatus,
        rejection_category,
        rejection_category_label: categoryConfig.label,
        reset_from_level: categoryConfig.reset_from_level
      },
      rejection: rejectionEntry
    })
  } catch (error) {
    console.error('Error processing rejection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
