import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { sendAssignmentNotificationEmail } from '../../../lib/email'
import {
  normalizeResultsOnWrite,
  ResultsValidationError,
} from '../../../lib/validators/certificate-results-normalize'
import { authenticateRequest, filterCertificatesForUser, getUserRole, getUserOrderTeamOrderIds, canEditCertificate, isCertificateParty } from '../../../lib/certificate-access'
import { clientSafeMessage } from '../../../lib/api-error'

// Using shared supabaseAdmin with env fallbacks for consistency

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    // Parallelize role fetch and certificates fetch
    const [role, { data, error }] = await Promise.all([
      getUserRole(user.id),
      supabaseAdmin
        .from('certificate')
        .select('*')
        .order('created_at', { ascending: false })
    ])

    if (error) {
      if (error.message?.toLowerCase?.().includes('fetch failed')) {
        console.warn('[certificates] Supabase unreachable, returning empty list fallback.')
        return NextResponse.json([])
      }
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    const visibleCertificates = await filterCertificatesForUser(user.id, role, data || [])

    // Order yang dikerjakan user (pembuat order / petugas di-assign) — dipakai
    // untuk menandai sertifikat mana yang boleh dia ubah (draft), agar UI
    // menyembunyikan aksi edit/hapus pada sertifikat orang lain.
    const teamOrderIds = await getUserOrderTeamOrderIds(user.id)

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

    // Combine certificates with verification status using a Map for O(1) lookups
    const verifMap = new Map<string, string>()
    for (const v of verifications) {
      const key = `${v.certificate_id}-${v.verification_level}-${v.certificate_version ?? 1}`
      verifMap.set(key, v.status)
    }

    const certificatesWithStatus = visibleCertificates.map(cert => {
      const certVersion = (cert as any).version ?? 1
      return {
        ...cert,
        can_edit: canEditCertificate(user.id, role, cert, teamOrderIds),
        // Boleh dipakai sebagai sumber Surat Keterangan: pihak terkait atau tim
        // order (tanpa syarat status draft, tidak seperti can_edit).
        can_reference:
          role === 'admin' ||
          isCertificateParty(user.id, cert) ||
          ((cert as any).calibration_order_id != null &&
            teamOrderIds.has(Number((cert as any).calibration_order_id))),
        verifikator_1_status: verifMap.get(`${cert.id}-1-${certVersion}`) || 'pending',
        verifikator_2_status: verifMap.get(`${cert.id}-2-${certVersion}`) || 'pending',
        verifikator_3_status: verifMap.get(`${cert.id}-3-${certVersion}`) || 'pending',
        authorized_by_status: verifMap.get(`${cert.id}-4-${certVersion}`) || 'pending',
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
      instrument_code,    // AWS, TT, PP, ... — wajib
      // Template fields
      balai_id,           // 1-5 or null (BMKG pusat)
      is_standard,        // boolean — sertifikat standar kalibrasi
      calibration_order_item_id, // number — bila sertifikat dibuat dari booking order
    } = body

    const orderItemId = calibration_order_item_id != null ? Number(calibration_order_item_id) : null
    if (!Number.isFinite(orderItemId) || orderItemId! <= 0) {
      return NextResponse.json(
        { error: 'Sertifikat baru wajib dibuat dari Order Kalibrasi' },
        { status: 400 },
      )
    }

    const { data: orderItem, error: orderItemError } = await supabaseAdmin
      .from('calibration_order_items')
      .select('id, order_id, status, no_identification, instrument_id, instrument_code')
      .eq('id', orderItemId)
      .maybeSingle()
    if (orderItemError || !orderItem) {
      return NextResponse.json({ error: 'Order item tidak ditemukan' }, { status: 404 })
    }

    const { data: calibrationOrder, error: orderError } = await supabaseAdmin
      .from('calibration_orders')
      .select('id, status, station_id, station_address_snapshot, calibration_place, no_order, created_by')
      .eq('id', orderItem.order_id)
      .maybeSingle()
    if (orderError || !calibrationOrder) {
      return NextResponse.json({ error: 'Order Kalibrasi tidak ditemukan' }, { status: 404 })
    }
    if (!['booked', 'in_progress'].includes(calibrationOrder.status)) {
      return NextResponse.json(
        { error: `Order berstatus ${calibrationOrder.status} tidak dapat membuat sertifikat` },
        { status: 409 },
      )
    }
    if (orderItem.status === 'void') {
      return NextResponse.json({ error: 'Identifikasi sudah void' }, { status: 409 })
    }

    if (userRole.role !== 'admin' && calibrationOrder.created_by !== user.id) {
      const { data: membership } = await supabaseAdmin
        .from('calibration_order_personnel')
        .select('id')
        .eq('order_id', calibrationOrder.id)
        .eq('personel_id', user.id)
        .maybeSingle()
      if (!membership) {
        return NextResponse.json(
          { error: 'Anda bukan petugas yang ditugaskan pada Order Kalibrasi ini' },
          { status: 403 },
        )
      }
    }

    if (!orderItem.instrument_id || !orderItem.instrument_code) {
      return NextResponse.json(
        { error: 'Order item belum memiliki instrumen dan kode instrumen yang valid' },
        { status: 409 },
      )
    }

    const officialStation = Number(calibrationOrder.station_id)
    const officialInstrument = Number(orderItem.instrument_id)
    const officialInstrumentCode = String(orderItem.instrument_code)
    const normalizedPlace = String(calibrationOrder.calibration_place).toUpperCase()

    const normalizedCertType = (certificate_type || 'sert').toString().toLowerCase()
    if (!['sert', 's_ket'].includes(normalizedCertType)) {
      return NextResponse.json({
        error: "certificate_type harus 'sert' atau 's_ket'",
      }, { status: 400 })
    }

    // Every approval stage must have an explicitly assigned account. Never
    // fall back to the creator for a signing role.
    if (!verifikator_1 || !verifikator_2 || !verifikator_3 || !authorized_by) {
      return NextResponse.json({
        error: 'Verifikator 1, Verifikator 2, Verifikator 3, and authorized_by are required',
      }, { status: 400 })
    }

    const assignments = [verifikator_1, verifikator_2, verifikator_3, authorized_by]
    if (new Set(assignments).size !== assignments.length) {
      return NextResponse.json({ error: 'Assigned verifiers and authorized_by must be distinct' }, { status: 400 })
    }

    if (assignments.includes(user.id)) {
      return NextResponse.json({ error: 'Certificate creator cannot verify or authorize their own certificate' }, { status: 400 })
    }

    // Metadata resmi selalu berasal dari booking, bukan payload browser.
    const resolvedStationAddress = calibrationOrder.station_address_snapshot ?? null

    const personelResult = await supabaseAdmin
      .from('personel')
      .select('id, is_active')
      .in('id', assignments)

    let assignedPeople: Array<{ id: string; is_active?: boolean | null }> | null = personelResult.data
    let assignedPeopleError = personelResult.error

    // Some deployments predate the soft-delete column. In that schema only,
    // retain existence validation; all newer schemas must reject inactive users.
    if (assignedPeopleError && /is_active/i.test(assignedPeopleError.message || '')) {
      const fallbackResult = await supabaseAdmin
        .from('personel')
        .select('id')
        .in('id', assignments)
      assignedPeople = fallbackResult.data
      assignedPeopleError = fallbackResult.error
    }

    if (assignedPeopleError || !assignedPeople || assignedPeople.length !== assignments.length) {
      return NextResponse.json({ error: 'One or more assigned personnel do not exist' }, { status: 400 })
    }

    if (assignedPeople.some(person => person.is_active === false)) {
      return NextResponse.json({ error: 'Assigned personnel must be active' }, { status: 400 })
    }

    const { data: assignmentRoles, error: assignmentRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', assignments)

    if (assignmentRoleError) {
      return NextResponse.json({ error: 'Failed to validate assigned personnel roles' }, { status: 500 })
    }

    const roleByUser = new Map((assignmentRoles || []).map((row: any) => [row.user_id, row.role]))
    if ([verifikator_1, verifikator_2, verifikator_3].some(id => roleByUser.get(id) !== 'verifikator')) {
      return NextResponse.json({ error: 'Assigned verifiers must have the verifikator role' }, { status: 400 })
    }

    if (!['assignor', 'admin'].includes(String(roleByUser.get(authorized_by) || ''))) {
      return NextResponse.json({ error: 'authorized_by must have the assignor or admin role' }, { status: 400 })
    }

    const authorizedPersonId = authorized_by
    const v1 = verifikator_1
    const v2 = verifikator_2
    const v3 = verifikator_3

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
        calibration_kind: normalizedPlace as 'FC' | 'IFC' | 'LC',
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

    const orderPayload = {
      calibration_order_item_id: String(orderItemId),
      certificate_type: normalizedCertType,
      instrument_code: officialInstrumentCode,
      authorized_by: authorizedPersonId,
      verifikator_1: v1,
      verifikator_2: v2,
      verifikator_3: v3,
      assignor: authorizedPersonId,
      issue_date,
      station: String(officialStation),
      instrument: String(officialInstrument),
      station_address: resolvedStationAddress ?? '',
      results: normalizedResults,
      sent_by: user.id,
      created_by: user.id,
      balai_id: balai_id ?? null,
      is_standard: is_standard ?? false,
    }
    const { data: rows, error: rpcErr } = await supabaseAdmin.rpc(
      'create_certificate_from_order',
      { p_data: orderPayload },
    )
    if (rpcErr) {
      const status = rpcErr.code === '23505' ? 409 : 400
      return NextResponse.json({ error: rpcErr.message }, { status })
    }
    const data: any = Array.isArray(rows) ? rows[0] : rows
    if (!data) {
      return NextResponse.json(
        { error: 'Failed to create certificate from order' },
        { status: 500 },
      )
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
