import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../lib/supabase'
import { clientSafeMessage } from '../../../../lib/api-error'
import { requireRoles } from '../../../../lib/api-auth'

async function resolveCodeRep(id: string) {
  return supabase
    .from('instrument_names')
    .select('id, code_alat')
    .eq('id', id)
    .single()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { data, error } = await resolveCodeRep(id)
    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }
    return NextResponse.json({
      id: data.id,
      code_alat: data.code_alat,
      name: data.code_alat,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch instrument code' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const { id } = await params
    const body = await request.json()
    const nextCode = String(body.code_alat || '').trim()

    if (!nextCode) {
      return NextResponse.json(
        { error: 'Kode alat is required' },
        { status: 400 },
      )
    }

    const { data: current, error: resolveError } = await resolveCodeRep(id)
    if (resolveError) {
      return NextResponse.json({ error: clientSafeMessage(resolveError) }, { status: 500 })
    }

    // Ganti kode untuk SEMUA nama yang memakai kode lama agar konsisten.
    const { error } = await supabase
      .from('instrument_names')
      .update({ code_alat: nextCode })
      .eq('code_alat', current.code_alat)

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
    }

    return NextResponse.json({
      id: Number(id),
      code_alat: nextCode,
      name: body.name || nextCode,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to update instrument code' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator'])
  if (gate instanceof NextResponse) return gate

  try {
    const { id } = await params
    const { data: current, error: resolveError } = await resolveCodeRep(id)
    if (resolveError) {
      return NextResponse.json({ error: clientSafeMessage(resolveError) }, { status: 500 })
    }

    const { count } = await supabase
      .from('instrument_names')
      .select('id', { count: 'exact', head: true })
      .eq('code_alat', current.code_alat)

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error: `Tidak dapat menghapus kode instrumen karena masih digunakan oleh ${count} nama instrumen. Hapus atau ubah nama instrumen terkait terlebih dahulu.`,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      message: 'Instrument code deleted successfully',
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete instrument code' },
      { status: 500 },
    )
  }
}
