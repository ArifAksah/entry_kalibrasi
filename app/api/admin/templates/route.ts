import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/templates
 * List all templates (active versions). Requires admin role.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { data: templates, error } = await supabaseAdmin
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[admin/templates] GET DB error:', error)
      return NextResponse.json({ error: 'Gagal mengambil daftar template' }, { status: 500 })
    }

    return NextResponse.json(templates || [])
  } catch (e) {
    console.error('[admin/templates] GET error:', e)
    return NextResponse.json({ error: 'Gagal mengambil daftar template' }, { status: 500 })
  }
}

/**
 * POST /api/admin/templates
 * Create a new template. Requires admin role.
 * Supports both rich text mode (content field) and legacy block mode (cover_blocks/results_blocks).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await request.json()
    const { name, certificate_type, content, page_settings, cover_blocks, results_blocks } = body

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nama template wajib diisi' }, { status: 400 })
    }

    if (!certificate_type || typeof certificate_type !== 'string') {
      return NextResponse.json({ error: 'Tipe sertifikat wajib diisi' }, { status: 400 })
    }

    // Determine mode: rich text or legacy blocks
    if (content) {
      // Rich text content mode (no longer validates TipTap structure)
      // Deactivate existing active templates for this certificate_type
      await supabaseAdmin
        .from('certificate_templates')
        .update({ is_active: false })
        .eq('certificate_type', certificate_type)
        .eq('is_active', true)

      // Get next version number
      const { data: maxVersionData } = await supabaseAdmin
        .from('certificate_templates')
        .select('version')
        .eq('certificate_type', certificate_type)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextVersion = (maxVersionData?.version ?? 0) + 1

      const { data: created, error } = await supabaseAdmin
        .from('certificate_templates')
        .insert({
          name,
          certificate_type,
          content,
          page_settings: page_settings || null,
          version: nextVersion,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('[admin/templates] POST insert error:', error)
        return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 })
      }

      return NextResponse.json(created, { status: 201 })
    } else {
      // Legacy block mode (backward compatible)
      // Deactivate existing active templates for this certificate_type
      await supabaseAdmin
        .from('certificate_templates')
        .update({ is_active: false })
        .eq('certificate_type', certificate_type)
        .eq('is_active', true)

      // Get next version number
      const { data: maxVersionData2 } = await supabaseAdmin
        .from('certificate_templates')
        .select('version')
        .eq('certificate_type', certificate_type)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextVersion2 = (maxVersionData2?.version ?? 0) + 1

      const { data: created, error } = await supabaseAdmin
        .from('certificate_templates')
        .insert({
          name,
          certificate_type,
          cover_blocks: cover_blocks || [],
          results_blocks: results_blocks || [],
          version: nextVersion2,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('[admin/templates] POST insert error:', error)
        return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 })
      }

      return NextResponse.json(created, { status: 201 })
    }
  } catch (e) {
    console.error('[admin/templates] POST error:', e)
    return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 })
  }
}
