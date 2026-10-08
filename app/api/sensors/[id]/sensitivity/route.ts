import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../../../../lib/supabase'
import { clientSafeMessage } from '../../../../../lib/api-error'
import { requireRoles } from '../../../../../lib/api-auth'

/**
 * PUT — perbarui HANYA kolom `sensitivity` (µV/Wm-2).
 *
 * Dipakai oleh tombol "Terapkan ke master" setelah kalibrasi pyranometer
 * (sensitivitas baru = sensitivitas lama × CF final).
 *
 * Sengaja dibuat endpoint terpisah: `PUT /api/sensors/[id]` menulis banyak
 * kolom sekaligus sehingga berisiko menimpa field lain bila body tidak lengkap.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireRoles(request, ['admin', 'calibrator'])
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const raw = (body as any)?.sensitivity
    const value = raw === '' || raw == null ? null : Number(raw)

    if (value != null && (!Number.isFinite(value) || value <= 0)) {
      return NextResponse.json(
        { error: 'Sensitivitas harus berupa angka lebih dari 0.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('sensor')
      .update({ sensitivity: value })
      .eq('id', id)
      .select('id, name, serial_number, sensitivity')
      .single()

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
