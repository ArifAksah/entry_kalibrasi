import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { certificate_id } = await request.json()

    if (!certificate_id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    // Call the database function to reset verification
    const { data, error } = await supabase.rpc('reset_certificate_verification', {
      cert_id: certificate_id
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset verification' }, { status: 500 })
  }
}
