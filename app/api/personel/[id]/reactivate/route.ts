import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'
import { forbidden, getCaller, isAdminCaller, unauthorized } from '../../../../../lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller(request)
    if (!caller) return unauthorized()
    if (!isAdminCaller(caller)) {
      return forbidden('Hanya admin yang dapat mengaktifkan kembali personel')
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID personel tidak ditemukan' }, { status: 400 })
    }

    // 1. Aktifkan kembali personel
    const { data, error: personelError } = await supabaseAdmin
      .from('personel')
      .update({ is_active: true, deleted_at: null })
      .eq('id', id)
      .select('*')
      .single()

    if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })

    // 2. Unban akun auth supaya bisa login kembali
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' })
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reactivate personel' }, { status: 500 })
  }
}
