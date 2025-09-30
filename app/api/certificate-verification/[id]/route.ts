import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET - Get specific certificate verification
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch certificate verification' }, { status: 500 })
  }
}

// PUT - Update certificate verification
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { status, notes } = body

    if (!status) {
      return NextResponse.json({
        error: 'Status is required',
      }, { status: 400 })
    }

    // Get current verification
    const { data: currentVerification, error: getError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('id', params.id)
      .single()

    if (getError || !currentVerification) {
      return NextResponse.json({
        error: 'Verification not found',
      }, { status: 404 })
    }

    // Check if user is authorized to update this verification
    if (currentVerification.verified_by !== user.id) {
      return NextResponse.json({
        error: 'You are not authorized to update this verification',
      }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('certificate_verification')
      .update({ 
        status,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update certificate verification' }, { status: 500 })
  }
}

// DELETE - Delete certificate verification
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Get current verification
    const { data: currentVerification, error: getError } = await supabaseAdmin
      .from('certificate_verification')
      .select('*')
      .eq('id', params.id)
      .single()

    if (getError || !currentVerification) {
      return NextResponse.json({
        error: 'Verification not found',
      }, { status: 404 })
    }

    // Check if user is authorized to delete this verification
    if (currentVerification.verified_by !== user.id) {
      return NextResponse.json({
        error: 'You are not authorized to delete this verification',
      }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('certificate_verification')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Verification deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete certificate verification' }, { status: 500 })
  }
}
