import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET - Get certificates pending verification for current user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Get certificates where user is assigned as verifikator_1, verifikator_2, or authorized_by
    const { data: certificates, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('*')
      .or(`verifikator_1.eq.${user.id},verifikator_2.eq.${user.id},authorized_by.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (certError) return NextResponse.json({ error: certError.message }, { status: 500 })

    // Get existing verifications for these certificates
    const certificateIds = certificates?.map(c => c.id) || []
    let verifications: Array<{ id: number; certificate_id: number; verification_level: number; status: string; created_at: string; certificate_version?: number }> = []
    if (certificateIds.length) {
      try {
        const { data: v, error: verifError } = await supabaseAdmin
          .from('certificate_verification')
          .select('id, certificate_id, verification_level, status, created_at, certificate_version')
          .in('certificate_id', certificateIds)
        if (!verifError && v) verifications = v
      } catch {}
    }

    // Combine certificates with verification status
    const certificatesWithStatus = (certificates || []).map(cert => {
      const certVersion = (cert as any).version ?? 1
      const verif1 = verifications?.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion)
      const verif2 = verifications?.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion)
      const verif3 = verifications?.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion)
      
      const isVerifikator1 = cert.verifikator_1 === user.id
      const isVerifikator2 = cert.verifikator_2 === user.id
      const isAuthorizedBy = cert.authorized_by === user.id
      
      let userVerificationStatus = null
      let userVerificationLevel = null
      
      if (isVerifikator1) {
        userVerificationStatus = verif1?.status || 'pending'
        userVerificationLevel = 1
      } else if (isVerifikator2) {
        userVerificationStatus = verif2?.status || 'pending'
        userVerificationLevel = 2
      } else if (isAuthorizedBy) {
        userVerificationStatus = verif3?.status || 'pending'
        userVerificationLevel = 3
      }

      // Gate: Sequential verification - each level must wait for previous approval
      const canUserAct = (() => {
        if (isVerifikator1) return true
        if (isVerifikator2) return (verif1?.status === 'approved')
        if (isAuthorizedBy) return (verif2?.status === 'approved')
        return false
      })()

      return {
        ...cert,
        station: null,
        instrument: null,
        verification_status: {
          verifikator_1: verif1?.status || 'pending',
          verifikator_2: verif2?.status || 'pending',
          authorized_by: verif3?.status || 'pending',
          user_verification_status: userVerificationStatus,
          user_verification_level: userVerificationLevel,
          user_verification_id: isVerifikator1 ? (verif1?.id ?? null) : isVerifikator2 ? (verif2?.id ?? null) : isAuthorizedBy ? (verif3?.id ?? null) : null,
          verif1_created_at: verif1?.created_at,
          verif2_created_at: verif2?.created_at,
          verif3_created_at: verif3?.created_at,
          verif1_status_for_v2: verif1?.status || 'pending',
          verif2_status_for_auth: verif2?.status || 'pending',
          user_can_act: canUserAct
        },
      }
    }) || []

    return NextResponse.json(certificatesWithStatus)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch pending certificates' }, { status: 500 })
  }
}
