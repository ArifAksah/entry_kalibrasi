import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { sendAssignmentNotificationEmail } from '../../../lib/email'
import {
  normalizeResultsOnWrite,
  ResultsValidationError,
} from '../../../lib/validators/certificate-results-normalize'
import { authenticateRequest, filterCertificatesForUser, getUserRole } from '../../../lib/certificate-access'

// Using shared supabaseAdmin with env fallbacks for consistency

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)

    const { data, error } = await supabaseAdmin
      .from('certificate')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.message?.toLowerCase?.().includes('fetch failed')) {
        console.warn('[certificates] Supabase unreachable, returning empty list fallback.')
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const visibleCertificates = await filterCertificatesForUser(user.id, role, data || [])

    // Get verification status for each certificate (gracefully handle missing table)
    const certificateIds = visibleCertificates.map(c => c.id) || []
    let verifications: Array<{ certificate_id: number; verification_level: number; status: string; certificate_version?: number }> = []

    if (certificateIds.length) {
      try {
        const { data: v, error: verifError } = await supabaseAdmin
          .from('certificate_verification')
          .select('certificate_id, verification_level, status, certificate_version')
          .in('certificate_id', certificateIds)

        if (!verifError && v) {
          verifications = v
        }
        // If the table doesn't exist yet or any error occurs, fall back to empty verifications
      } catch { }
    }

    // Combine certificates with verification status
    const certificatesWithStatus = visibleCertificates.map(cert => {
      const certVersion = (cert as any).version ?? 1
      const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion)
      const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion)
      const verif3 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion)
      const verif4 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 4 && (v.certificate_version ?? 1) === certVersion)
      return {
        ...cert,
        verifikator_1_status: verif1?.status || 'pending',
        verifikator_2_status: verif2?.status || 'pending',
        verifikator_3_status: verif3?.status || 'pending',
        authorized_by_status: verif4?.status || 'pending',
      }
    })

    return NextResponse.json(certificatesWithStatus)
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.toLowerCase().includes('fetch failed')) {
      console.warn('[certificates] Supabase unreachable in catch, returning empty list fallback.')
      return NextResponse.json([])
    }
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Enforce Role Check: Only 'calibrator' or 'admin' can create certificates
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userRole || !['calibrator', 'admin'].includes(userRole.role)) {
      return NextResponse.json({
        error: 'Unauthorized: Only Calibrators can create certificates'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      // no_certificate & no_order dari body SENGAJA DIABAIKAN.
      // Nomor definitif digenerate atomik di DB oleh
      // create_certificate_with_auto_number() untuk mencegah race condition
      // ketika beberapa user membuat sertifikat bersamaan.
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
      // Komponen format nomor sesuai IKK BMKG
      certificate_type,   // 'sert' | 's_ket' — default 'sert'
      calibration_place,  // 'FC' | 'LC'     — default 'FC'
      instrument_code     // AWS, TT, PP, ... — wajib
    } = body

    if (!no_identification || !issue_date) {
      return NextResponse.json({
        error: 'No. Identifikasi dan Tanggal Terbit wajib diisi',
      }, { status: 400 })
    }

    // Instrument code wajib untuk format nomor sesuai IKK.
    if (!instrument_code || typeof instrument_code !== 'string') {
      return NextResponse.json({
        error: 'Kode alat (instrument_code) wajib diisi',
      }, { status: 400 })
    }

    const normalizedPlace = (calibration_place || 'FC').toString().toUpperCase()
    if (!['FC', 'LC'].includes(normalizedPlace)) {
      return NextResponse.json({
        error: 'calibration_place harus FC atau LC',
      }, { status: 400 })
    }

    const normalizedCertType = (certificate_type || 'sert').toString().toLowerCase()
    if (!['sert', 's_ket'].includes(normalizedCertType)) {
      return NextResponse.json({
        error: "certificate_type harus 'sert' atau 's_ket'",
      }, { status: 400 })
    }

    // Validate verifikator fields are required
    if (!verifikator_1 || !verifikator_2 || !verifikator_3) {
      return NextResponse.json({
        error: 'Verifikator 1, Verifikator 2, and Verifikator 3 are required',
      }, { status: 400 })
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

    // Validate authorized_by (personel) if provided; else default to user.id
    let authorizedPersonId: string = user.id
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

    // Validate verifikator_1 if provided
    let v1: string | null = null
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

    // Validate verifikator_2 if provided
    let v2: string | null = null
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

    // Validate verifikator_3 if provided
    let v3: string | null = null
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

    // Debug logging for certificate creation
    console.log('=== Creating Certificate ===')
    console.log('Verifikator 1:', v1)
    console.log('Verifikator 2:', v2)
    console.log('Verifikator 3:', v3)
    console.log('Authorized By:', authorizedPersonId)
    console.log('============================')

    // -----------------------------------------------------------------------
    // INSERT atomik via RPC dengan retry.
    // Fungsi create_certificate_with_auto_number() di Postgres:
    //   1. Mengambil pg_advisory_xact_lock bersifat per-tahun.
    //   2. Menghitung no_order berikutnya (MAX+1) dalam transaksi yang sama.
    //   3. INSERT row dan RETURNING row lengkap.
    //   4. Melepas lock otomatis saat transaksi commit.
    // Retry diperlukan sebagai lapisan pengaman terhadap kemungkinan
    // 23505 unique_violation (mis. race yang tidak terjangkau oleh lock,
    // atau insert manual dari sumber lain).
    // -----------------------------------------------------------------------
    // Normalisasi results ke Certificate Results V1 sebelum disimpan.
    // - Tolerant mode (default): V0 legacy auto-convert ke V1, log warn.
    // - Strict mode (env RESULTS_VALIDATION_STRICT=true): V0 ditolak.
    // Throw ResultsValidationError → akan tertangkap di catch bawah.
    let normalizedResults: unknown = null
    try {
      const outcome = normalizeResultsOnWrite(results, {
        calibration_kind: normalizedPlace as 'FC' | 'LC',
        certificate_id: 'NEW',
      })
      if (outcome.kind === 'ok') normalizedResults = outcome.value
    } catch (err) {
      if (err instanceof ResultsValidationError) {
        return NextResponse.json(
          { error: err.message, details: err.details },
          { status: err.status }
        )
      }
      throw err
    }

    const rpcPayload = {
      no_identification,
      certificate_type: normalizedCertType,
      calibration_place: normalizedPlace,
      instrument_code,
      authorized_by: authorizedPersonId,
      verifikator_1: v1,
      verifikator_2: v2,
      verifikator_3: v3,
      assignor: authorizedPersonId,
      issue_date,
      station: station ? String(parseInt(station)) : '',
      instrument: instrument ? String(parseInt(instrument)) : '',
      station_address: (resolvedStationAddress ?? station_address) ?? '',
      results: normalizedResults,
      sent_by: user.id,
      created_by: user.id,
    }

    const MAX_RETRIES = 5
    let data: any = null
    let lastError: any = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data: rows, error: rpcErr } = await supabaseAdmin
        .rpc('create_certificate_with_auto_number', { p_data: rpcPayload })

      if (!rpcErr && rows) {
        // rpc returns SETOF certificate -> array with one element
        data = Array.isArray(rows) ? rows[0] : rows
        lastError = null
        break
      }

      lastError = rpcErr
      // 23505 = unique_violation pada Postgres. Retry dengan regenerate nomor.
      const isUniqueViolation = rpcErr?.code === '23505' || /duplicate key/i.test(rpcErr?.message ?? '')
      if (!isUniqueViolation) break

      console.warn(`[certificates] unique_violation on attempt ${attempt}, retrying…`, rpcErr?.message)
      // Small jitter before retry to reduce thundering herd on hot contention.
      await new Promise(r => setTimeout(r, 25 + Math.floor(Math.random() * 50)))
    }

    if (lastError || !data) {
      console.error('[certificates] Failed to create certificate:', lastError)
      return NextResponse.json({ error: lastError?.message || 'Failed to create certificate' }, { status: 500 })
    }

    // Nomor definitif datang dari DB.
    const finalNoCertificate: string = data.no_certificate
    const finalNoOrder: string = data.no_order

    // Create log entry for certificate creation
    try {
      const { createCertificateLog } = await import('../../../lib/certificate-log-helper')
      await createCertificateLog({
        certificate_id: data.id,
        action: 'created',
        performed_by: user.id,
        previous_status: null,
        new_status: 'draft',
        metadata: {
          no_certificate: finalNoCertificate,
          no_order: finalNoOrder
        }
      })
    } catch (logError) {
      console.error('Failed to create certificate log:', logError)
      // Don't fail the request if logging fails
    }

    // Kirim notifikasi email
    const sendNotification = async (userId: string, role: string, certificateNumber: string, certificateId: number) => {
      const { data: personelData, error: personelError } = await supabaseAdmin
        .from('personel')
        .select('email')
        .eq('id', userId)
        .single();

      if (!personelError && personelData && personelData.email) {
        await sendAssignmentNotificationEmail(personelData.email, role, certificateNumber, certificateId);
      }
    };

    if (authorized_by) {
      await sendNotification(authorized_by, 'Authorized By', finalNoCertificate, data.id);
    }
    if (verifikator_1) {
      await sendNotification(verifikator_1, 'Verifikator 1', finalNoCertificate, data.id);
    }
    if (verifikator_2) {
      await sendNotification(verifikator_2, 'Verifikator 2', finalNoCertificate, data.id);
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 })
  }
}
