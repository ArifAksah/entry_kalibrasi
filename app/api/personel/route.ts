import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url)
      const includeInactive = searchParams.get('includeInactive') === 'true'

      let query = supabaseAdmin.from('personel').select('*')
      if (!includeInactive) {
        query = query.or('is_active.eq.true,is_active.is.null')
      }
      query = query.order('created_at', { ascending: false })

      let { data: personelData, error: personelError } = await query

      // Fallback: kalau kolom is_active belum ada di DB (migrasi
      // database/fix_personel_update_softdelete.sql belum dijalankan /
      // schema cache Supabase belum reload), jalankan ulang TANPA filter
      // supaya dropdown personel di halaman lain tidak ikut kosong.
      if (personelError && /is_active/i.test(personelError.message || '')) {
        console.warn('[personel] is_active filter failed (column missing?), retrying unfiltered:', personelError.message)
        const retry = await supabaseAdmin.from('personel').select('*').order('created_at', { ascending: false })
        personelData = retry.data
        personelError = retry.error
      }

      if (personelError) {
        if ((personelError as any).message?.toLowerCase?.().includes('fetch failed')) {
          console.warn('[personel] Supabase unreachable, returning empty list fallback.')
          return NextResponse.json([], { status: 200 })
        }
        return NextResponse.json({ error: personelError.message }, { status: 500 })
      }

      const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role, station_id')

      if (rolesError) {
        console.warn('[personel] Failed to fetch roles, returning personel without roles.')
        return NextResponse.json(personelData)
      }

      const mergedData = (personelData || []).map((p: any) => {
        const roleInfo = (rolesData || []).find((r: any) => r.user_id === p.id)
        return { ...p, role: roleInfo?.role || null, station_id: roleInfo?.station_id || null }
      })

      const olehRole = mergedData.reduce((acc: Record<string, number>, p: any) => {
        acc[p.role || '(no role)'] = (acc[p.role || '(no role)'] || 0) + 1
        return acc
      }, {})
      console.log('[personel GET] total:', mergedData.length, 'per role:', olehRole)

      return NextResponse.json(mergedData)
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.toLowerCase().includes('fetch failed')) {
        console.warn('[personel] Supabase unreachable in catch, returning empty list fallback.')
        return NextResponse.json([], { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch personel' }, { status: 500 })
    }
  }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, nip, nik, phone, email } = body
    if (!id || !name || !email) {
      return NextResponse.json({ error: 'id, name and email are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('personel')
      .insert({ id, name, nip, nik: nik || null, nik_index: null, phone, email })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('Create personel error:', e)
    return NextResponse.json({ error: 'Failed to create personel' }, { status: 500 })
  }
}
