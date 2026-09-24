import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../lib/supabase'
import { clientSafeMessage } from '../../../../lib/api-error'
import { requireRoles } from '../../../../lib/api-auth'

// GET - Get single sensor name
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('sensor_names')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update sensor name
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('sensor_names')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete sensor name
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const { id } = await params
    const { error } = await supabase
      .from('sensor_names')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 400 })
    }

    return NextResponse.json({ message: 'Sensor name deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
