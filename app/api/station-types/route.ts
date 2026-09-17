import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('station_type')
      .select('id, name')
      .order('id', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: clientSafeMessage(error) },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch station types' },
      { status: 500 },
    )
  }
}
