import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../lib/supabase'
import { requireCertWorkflowAccess } from '../../../../lib/api-auth'
import { clientSafeMessage } from '../../../../lib/api-error'

export async function POST(request: NextRequest) {
  try {
    const { certificate_id } = await request.json()

    if (!certificate_id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    const gate = await requireCertWorkflowAccess(request, certificate_id, {
      message: 'Hanya admin atau petugas yang terlibat pada sertifikat ini yang dapat mereset verifikasi',
    })
    if (gate instanceof NextResponse) return gate

    // Call the database function to reset verification
    const { data, error } = await supabase.rpc('reset_certificate_verification', {
      cert_id: certificate_id
    })

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset verification' }, { status: 500 })
  }
}
