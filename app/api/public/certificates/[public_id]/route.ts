import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const roleLabel: Record<number, string> = {
  1: 'Verifikator 1',
  2: 'Verifikator 2',
  3: 'Verifikator 3',
  4: 'Penandatangan'
}

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  sent: 'Dalam Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  completed: 'Selesai'
}

function publicPerson(personelMap: Record<string, any>, id?: string | null) {
  if (!id) return null
  const person = personelMap[id]
  if (!person) return { id, name: 'Tidak diketahui', nip: null }
  return {
    id,
    name: person.name || 'Tidak diketahui',
    nip: person.nip || null
  }
}

function getSignatureProvider(signatureData: any) {
  if (!signatureData || typeof signatureData !== 'object') return 'BSrE'
  return signatureData.provider || signatureData.issuer || signatureData.ca || 'BSrE'
}

function getPublicSignatureMetadata(signatureData: any) {
  if (!signatureData || typeof signatureData !== 'object') return null
  return {
    provider: getSignatureProvider(signatureData),
    timestamp: signatureData.timestamp || signatureData.signed_at || null,
    document_id: signatureData.document_id || signatureData.id_dokumen || signatureData.id || null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_id: string }> }
) {
  try {
    const { public_id } = await params

    if (!public_id) {
      return NextResponse.json({ error: 'Public ID is required' }, { status: 400 })
    }

    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificate')
      .select(`
        id,
        created_at,
        no_certificate,
        no_order,
        no_identification,
        issue_date,
        status,
        authorized_by,
        verifikator_1,
        verifikator_2,
        verifikator_3,
        sent_by,
        created_by,
        station,
        instrument,
        pdf_generated_at,
        public_id,
        version
      `)
      .eq('public_id', public_id)
      .maybeSingle()

    if (certError) {
      console.error('[Public API] Certificate query error:', certError)
      return NextResponse.json({ error: 'Failed to fetch certificate' }, { status: 500 })
    }

    if (!cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    let stationName = '-'
    if (cert.station) {
      const { data: station } = await supabaseAdmin
        .from('station')
        .select('name')
        .eq('id', cert.station)
        .maybeSingle()
      if (station?.name) stationName = station.name
    }

    let instrumentName = '-'
    if (cert.instrument) {
      const { data: instrument } = await supabaseAdmin
        .from('instrument')
        .select('names, serial_number, type, manufacturer')
        .eq('id', cert.instrument)
        .maybeSingle()
      if (instrument?.names) instrumentName = instrument.names
    }

    const effectiveVersion = cert.version ?? 1
    const { data: verifications, error: verificationError } = await supabaseAdmin
      .from('certificate_verification')
      .select('verification_level, status, verified_by, approval_notes, signed_at, signature_data, created_at, updated_at, certificate_version')
      .eq('certificate_id', cert.id)
      .eq('certificate_version', effectiveVersion)
      .order('verification_level', { ascending: true })

    if (verificationError) {
      console.warn('[Public API] Verification query failed:', verificationError.message)
    }

    const allUserIds = [
      cert.created_by,
      cert.sent_by,
      cert.verifikator_1,
      cert.verifikator_2,
      cert.verifikator_3,
      cert.authorized_by,
      ...(verifications || []).map((verification: any) => verification.verified_by)
    ].filter(Boolean)

    const personelMap: Record<string, any> = {}
    if (allUserIds.length > 0) {
      const { data: people } = await supabaseAdmin
        .from('personel')
        .select('id, name, nip')
        .in('id', Array.from(new Set(allUserIds)))

      people?.forEach((person: any) => {
        personelMap[person.id] = person
      })
    }

    const verificationSteps = (verifications || []).map((verification: any) => ({
      level: verification.verification_level,
      role: roleLabel[verification.verification_level] || `Verifikasi ${verification.verification_level}`,
      status: verification.status,
      approved_at: verification.status === 'approved'
        ? verification.signed_at || verification.updated_at || verification.created_at
        : null,
      approval_notes: verification.approval_notes || null,
      person: publicPerson(personelMap, verification.verified_by)
    }))

    const signedVerification = (verifications || [])
      .filter((verification: any) => verification.status === 'approved' && verification.verification_level === 4)
      .sort((a: any, b: any) => new Date(b.signed_at || b.updated_at || 0).getTime() - new Date(a.signed_at || a.updated_at || 0).getTime())[0]

    const isSigned = Boolean(signedVerification || cert.status === 'completed')
    const signedAt = signedVerification?.signed_at || signedVerification?.updated_at || cert.pdf_generated_at || null
    const signerId = signedVerification?.verified_by || cert.authorized_by
    const signer = publicPerson(personelMap, signerId)

    return NextResponse.json({
      valid: true,
      source: {
        system: 'SIMKAL',
        name: 'Sistem Informasi Manajemen Kalibrasi',
        owner: 'BMKG',
        statement: 'Sertifikat ini tercatat dan diterbitkan melalui SIMKAL (Sistem Informasi Manajemen Kalibrasi).'
      },
      certificate: {
        id: cert.id,
        public_id: cert.public_id,
        no_certificate: cert.no_certificate,
        no_order: cert.no_order,
        no_identification: cert.no_identification,
        issue_date: cert.issue_date,
        status: cert.status,
        status_label: statusLabel[cert.status] || cert.status || '-',
        created_at: cert.created_at,
        pdf_generated_at: cert.pdf_generated_at,
        version: effectiveVersion,
        station_name: stationName,
        instrument_name: instrumentName
      },
      people: {
        creator: publicPerson(personelMap, cert.created_by || cert.sent_by),
        sent_by: publicPerson(personelMap, cert.sent_by),
        verifikator_1: publicPerson(personelMap, cert.verifikator_1),
        verifikator_2: publicPerson(personelMap, cert.verifikator_2),
        verifikator_3: publicPerson(personelMap, cert.verifikator_3),
        signer
      },
      workflow: {
        steps: verificationSteps
      },
      signature: {
        signed: isSigned,
        provider: signedVerification ? getSignatureProvider(signedVerification.signature_data) : null,
        signed_at: signedAt,
        signer,
        notes: signedVerification?.approval_notes || null,
        metadata: getPublicSignatureMetadata(signedVerification?.signature_data)
      }
    })
  } catch (error: any) {
    console.error('[Public API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
