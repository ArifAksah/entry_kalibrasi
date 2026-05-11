import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { sendAssignmentNotificationEmail } from '../../../../lib/email'
import {
  normalizeResultsOnWrite,
  ResultsValidationError,
} from '../../../../lib/validators/certificate-results-normalize'
import { authorizeCertificateAccess, canUserAccessCertificate, getUserRole } from '../../../../lib/certificate-access'
import { verifyPdfRenderToken } from '../../../../lib/pdf-render-token'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const renderToken = request.headers.get('x-pdf-render-token')
    const renderTimestamp = request.headers.get('x-pdf-render-ts')

    if (verifyPdfRenderToken(id, renderToken, renderTimestamp)) {
      const { data: certificate, error } = await supabaseAdmin
        .from('certificate')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('[certificates/:id] Internal PDF render query failed:', error)
        return NextResponse.json({ error: 'Failed to fetch certificate' }, { status: 500 })
      }

      if (!certificate) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
      }

      return NextResponse.json(certificate)
    }

    const access = await authorizeCertificateAccess(request, id)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    return NextResponse.json(access.certificate)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch certificate' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const {
      no_certificate,
      no_order,
      no_identification,
      issue_date,
      station,
      instrument,
      authorized_by,
      verifikator_1,
      verifikator_2,
      verifikator_3,
      results,
      station_address,
      calibration_computed_at,
    } = body

    if (!no_certificate || !no_order || !no_identification) {
      return NextResponse.json({
        error: 'Certificate number, order number, and identification number are required',
      }, { status: 400 })
    }

    // Get current certificate data before updating
    const { data: currentCertificate, error: currentError } = await supabaseAdmin
      .from('certificate')
      .select('authorized_by, verifikator_1, verifikator_2, verifikator_3, version, status, rejection_history, no_certificate, no_order, no_identification, issue_date, station, instrument, station_address, results, calibration_place, calibration_kind, results_frozen_at')
      .eq('id', id)
      .single();

    if (currentError) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const userRole = await getUserRole(user.id)
    const canAccess = await canUserAccessCertificate(user.id, userRole, currentCertificate)
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate station foreign key if provided and fetch address
    let resolvedStationAddress: string | null = null
    if (station) {
      const { data: stationData, error: stationError } = await supabaseAdmin
        .from('station')
        .select('id, address')
        .eq('id', station)
        .single()

      if (stationError || !stationData) {
        return NextResponse.json({
          error: 'Station does not exist. Please select a valid station.',
        }, { status: 400 })
      }
      resolvedStationAddress = stationData.address ?? null
    }

    // Validate instrument foreign key if provided
    if (instrument) {
      const { data: instrumentData, error: instrumentError } = await supabaseAdmin
        .from('instrument')
        .select('id')
        .eq('id', instrument)
        .single()

      if (instrumentError || !instrumentData) {
        return NextResponse.json({
          error: 'Instrument does not exist. Please select a valid instrument.',
        }, { status: 400 })
      }
    }

    // Validate authorized_by (personel) if provided; otherwise keep existing assignment.
    // Partial updates must not silently replace the signer with the current user.
    let authorizedPersonId: string | null = currentCertificate.authorized_by ?? null
    if (authorized_by) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', authorized_by)
        .single()
      if (pErr || !p) {
        return NextResponse.json({ error: 'Invalid authorized_by (personel) id' }, { status: 400 })
      }
      authorizedPersonId = authorized_by
    }

    // Validate verifikator_1 if provided; otherwise keep existing assignment.
    let v1: string | null = currentCertificate.verifikator_1 ?? null
    if (verifikator_1) {
      const { data: p1, error: p1Err } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verifikator_1)
        .single()
      if (p1Err || !p1) {
        return NextResponse.json({ error: 'Invalid verifikator_1 (personel) id' }, { status: 400 })
      }
      v1 = verifikator_1
    }

    // Validate verifikator_2 if provided; otherwise keep existing assignment.
    let v2: string | null = currentCertificate.verifikator_2 ?? null
    if (verifikator_2) {
      const { data: p2, error: p2Err } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verifikator_2)
        .single()
      if (p2Err || !p2) {
        return NextResponse.json({ error: 'Invalid verifikator_2 (personel) id' }, { status: 400 })
      }
      v2 = verifikator_2
    }

    // Validate verifikator_3 if provided; otherwise keep existing assignment.
    let v3: string | null = currentCertificate.verifikator_3 ?? null
    if (verifikator_3) {
      const { data: p3, error: p3Err } = await supabaseAdmin
        .from('personel')
        .select('id')
        .eq('id', verifikator_3)
        .single()
      if (p3Err || !p3) {
        return NextResponse.json({ error: 'Invalid verifikator_3 (personel) id' }, { status: 400 })
      }
      v3 = verifikator_3
    }

    // --- Normalisasi results (V0 → V1) ---------------------------------
    // Hanya normalisasi & ikut-update kalau client mengirim key 'results'.
    // Kalau tidak dikirim sama sekali, jangan sentuh kolomnya (selaras dengan
    // pola calibration_computed_at di bawah).
    const clientSentResults = 'results' in body
    let resultsForUpdate: unknown = currentCertificate?.results ?? null
    if (clientSentResults) {
      try {
        const outcome = normalizeResultsOnWrite(results, {
          calibration_kind:
            ((currentCertificate as any)?.calibration_kind ||
             ((currentCertificate as any)?.calibration_place === 'LC' ? 'LC' : 'FC')
            ) as 'FC' | 'LC',
          certificate_id: id,
        })
        // `not_provided` berarti body mengirim results=null/undefined → simpan null
        resultsForUpdate = outcome.kind === 'ok' ? outcome.value : null
      } catch (err) {
        if (err instanceof ResultsValidationError) {
          return NextResponse.json(
            { error: err.message, details: err.details },
            { status: err.status }
          )
        }
        throw err
      }
    }

    const resultsChanged =
      clientSentResults &&
      JSON.stringify(currentCertificate?.results ?? null) !==
        JSON.stringify(resultsForUpdate ?? null)

    if (resultsChanged && currentCertificate?.results_frozen_at) {
      return NextResponse.json({
        error: 'Certificate results are frozen and can no longer be changed',
        results_frozen_at: currentCertificate.results_frozen_at,
      }, { status: 409 })
    }

    // Auto-increment version when content changes meaningfully
    const nextVersion = (() => {
      const prev = currentCertificate?.version ?? 1
      const changed = !currentCertificate ||
        currentCertificate.no_certificate !== no_certificate ||
        currentCertificate.no_order !== no_order ||
        currentCertificate.no_identification !== no_identification ||
        currentCertificate.issue_date !== issue_date ||
        (currentCertificate.station ?? null) !== (station ? parseInt(station) : null) ||
        (currentCertificate.instrument ?? null) !== (instrument ? parseInt(instrument) : null) ||
        (currentCertificate.station_address ?? null) !== ((resolvedStationAddress ?? station_address) ?? null) ||
        resultsChanged
      return changed ? (prev + 1) : prev
    })()

    const { data, error } = await supabaseAdmin
      .from('certificate')
      .update({
        no_certificate,
        no_order,
        no_identification,
        authorized_by: authorizedPersonId,
        verifikator_1: v1,
        verifikator_2: v2,
        verifikator_3: v3,
        assignor: authorizedPersonId,
        issue_date,
        station: station ? parseInt(station) : null,
        instrument: instrument ? parseInt(instrument) : null,
        station_address: (resolvedStationAddress ?? station_address) ?? null,
        version: nextVersion,
        // Hanya overwrite results kalau client eksplisit mengirim key 'results'.
        // Update non-results (assign verifikator dsb.) tidak akan menyentuh kolom.
        ...(clientSentResults ? { results: resultsForUpdate } : {}),
        // Hanya overwrite calibration_computed_at jika client EKSPLISIT mengirim key ini
        // (mis. setelah user klik "Hitung & Input Tabel ke Sertifikat" di QC Modal).
        // Update dari sumber lain (assign verifikator, edit form, dll.) tidak
        // akan menghapus timestamp yang sudah tersimpan.
        ...('calibration_computed_at' in body
          ? { calibration_computed_at: calibration_computed_at ?? null }
          : {}),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const hasRejectionHistory = Array.isArray((currentCertificate as any)?.rejection_history) && (currentCertificate as any).rejection_history.length > 0
    const shouldDeferVerificationReset = (currentCertificate as any)?.status === 'draft' && hasRejectionHistory

    // If certificate was revised (version increased), reset verification status
    if (nextVersion > (currentCertificate?.version ?? 1) && !shouldDeferVerificationReset) {
      try {
        // Delete existing verification records and create new ones with updated version
        const { error: deleteError } = await supabaseAdmin
          .from('certificate_verification')
          .delete()
          .eq('certificate_id', parseInt(id))

        if (deleteError) {
          console.error('Error deleting old verification records:', deleteError)
        } else {
          console.log('Old verification records deleted for certificate:', id)

          // Create new verification records with updated version
          if (currentCertificate?.verifikator_1 && currentCertificate?.verifikator_2) {
            const newVerificationRecords: any[] = [
              {
                certificate_id: parseInt(id),
                verification_level: 1,
                status: 'pending',
                verified_by: currentCertificate.verifikator_1,
                certificate_version: nextVersion,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              {
                certificate_id: parseInt(id),
                verification_level: 2,
                status: 'pending',
                verified_by: currentCertificate.verifikator_2,
                certificate_version: nextVersion,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]

            if (currentCertificate?.verifikator_3) {
              newVerificationRecords.push({
                certificate_id: parseInt(id),
                verification_level: 3,
                status: 'pending',
                verified_by: currentCertificate.verifikator_3,
                certificate_version: nextVersion,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }

            const { error: insertError } = await supabaseAdmin
              .from('certificate_verification')
              .insert(newVerificationRecords)

            if (insertError) {
              console.error('Error creating new verification records:', insertError)
            } else {
              console.log('New verification records created for certificate:', id, 'version:', nextVersion)
            }
          }
        }
      } catch (resetErr) {
        console.error('Error resetting verification status:', resetErr)
        // Don't fail the request, just log the error
      }
    }

    // Kirim notifikasi email jika ada perubahan
    const sendNotification = async (userId: string, role: string, certificateNumber: string, certificateId: number) => {
      const { data: personelData, error: personelError } = await supabaseAdmin
        .from('personel')
        .select('email')
        .eq('id', userId)
        .single();

      if (!personelError && personelData && personelData.email) {
        try {
          await sendAssignmentNotificationEmail(personelData.email, role, certificateNumber, certificateId);
        } catch (emailError) {
          console.error(`Failed to send notification to ${role} (${personelData.email}):`, emailError);
        }
      }
    };

    if (currentCertificate) {
      if (authorized_by && authorized_by !== currentCertificate.authorized_by) {
        await sendNotification(authorized_by, 'Authorized By', no_certificate, data.id);
      }
      if (v1 && v1 !== currentCertificate.verifikator_1) {
        await sendNotification(v1, 'Verifikator 1', no_certificate, data.id);
      }
      if (v2 && v2 !== currentCertificate.verifikator_2) {
        await sendNotification(v2, 'Verifikator 2', no_certificate, data.id);
      }
    }

    // Create log entry for certificate update
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      const { data: currentCert } = await supabaseAdmin
        .from('certificate')
        .select('status')
        .eq('id', id)
        .single()

      await createCertificateLog({
        certificate_id: parseInt(id),
        action: 'updated',
        performed_by: user.id,
        previous_status: currentCert?.status || null,
        new_status: currentCert?.status || null,
        metadata: {
          updated_fields: {
            no_certificate: no_certificate !== currentCertificate.no_certificate,
            no_order: no_order !== currentCertificate.no_order,
            no_identification: no_identification !== currentCertificate.no_identification,
            issue_date: issue_date !== currentCertificate.issue_date,
            station: station !== currentCertificate.station,
            instrument: instrument !== currentCertificate.instrument,
            authorized_by: authorizedPersonId !== currentCertificate.authorized_by,
            verifikator_1: v1 !== currentCertificate.verifikator_1,
            verifikator_2: v2 !== currentCertificate.verifikator_2
          }
        }
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update certificate' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Get certificate data before deleting for log
    const { data: certData } = await supabaseAdmin
      .from('certificate')
      .select('*')
      .eq('id', id)
      .single()

    if (!certData) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })

    const userRole = await getUserRole(user.id)
    const canAccess = await canUserAccessCertificate(user.id, userRole, certData)
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (userRole === 'user_station') {
      return NextResponse.json({ error: 'User station cannot delete certificates' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('certificate')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create log entry for certificate deletion
    try {
      const { createCertificateLog } = await import('../../../../lib/certificate-log-helper')
      await createCertificateLog({
        certificate_id: parseInt(id),
        action: 'deleted',
        performed_by: user.id,
        previous_status: certData?.status || null,
        new_status: null,
        metadata: {
          no_certificate: certData?.no_certificate || null
        }
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ message: 'Certificate deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete certificate' }, { status: 500 })
  }
}
