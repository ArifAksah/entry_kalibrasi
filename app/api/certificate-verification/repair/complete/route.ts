import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../../lib/supabase'
import { requireCertWorkflowAccess } from '../../../../../lib/api-auth'
import { clientSafeMessage } from '../../../../../lib/api-error'

export async function POST(request: NextRequest) {
  try {
    const { certificate_id, completion_notes } = await request.json()

    if (!certificate_id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    const gate = await requireCertWorkflowAccess(request, certificate_id, {
      matchColumns: ['authorized_by', 'assignor', 'sent_by', 'created_by'],
      message: 'Hanya admin atau petugas yang menangani sertifikat ini yang dapat menyelesaikan perbaikan',
    })
    if (gate instanceof NextResponse) return gate

    // Call the database function to complete repair
    const { data, error } = await supabase.rpc('complete_certificate_repair', {
      cert_id: certificate_id,
      completion_notes: completion_notes || null
    })

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to complete repair' }, { status: 500 })
  }
}
