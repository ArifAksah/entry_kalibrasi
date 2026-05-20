import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { supabaseAdmin } from '@/lib/supabase'
import { getRichTextTemplateById } from '@/lib/rich-text-editor/storage-service'

/**
 * POST /api/admin/templates/[id]/duplicate
 * Duplicate an existing template with a new name. Requires admin role.
 * Body: { name: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { id } = await params

    // Parse and validate body
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nama template wajib diisi' }, { status: 400 })
    }

    // Get existing template
    const existing = await getRichTextTemplateById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }

    // Create duplicate with new name
    const { data: duplicated, error: insertError } = await supabaseAdmin
      .from('certificate_templates')
      .insert({
        name: name.trim(),
        certificate_type: existing.certificate_type,
        content: existing.content,
        page_settings: existing.page_settings,
        cover_blocks: existing.cover_blocks || [],
        results_blocks: existing.results_blocks || [],
        version: 1,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[admin/templates/[id]/duplicate] Insert error:', insertError)
      return NextResponse.json({ error: 'Gagal menduplikasi template' }, { status: 500 })
    }

    return NextResponse.json(duplicated, { status: 201 })
  } catch (e: any) {
    console.error('[admin/templates/[id]/duplicate] POST error:', e)

    if (e?.message?.includes('tidak ditemukan')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Gagal menduplikasi template' }, { status: 500 })
  }
}
