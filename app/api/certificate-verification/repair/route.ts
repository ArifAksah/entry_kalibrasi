import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { certificate_id, repair_notes } = await request.json()

    if (!certificate_id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    // Call the database function to request repair
    const { data, error } = await supabase.rpc('request_certificate_repair', {
      cert_id: certificate_id,
      repair_notes: repair_notes || null
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to request repair' }, { status: 500 })
  }
}
