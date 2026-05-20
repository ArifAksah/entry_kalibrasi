import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { supabaseAdmin } from '@/lib/supabase'
import { saveRichTextVersion, getRichTextTemplateById } from '@/lib/rich-text-editor/storage-service'

export async function GET(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const template = await getRichTextTemplateById(id)

    if (!template) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (e) {
    console.error('[admin/templates/[id]] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check template exists
    const existing = await getRichTextTemplateById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }

    // Parse body
    const body = await request.json()
    const { content, page_settings, cover_blocks, results_blocks, cover_html, results_html, end_html, repeating_header, repeating_footer, cover_template_path, results_template_path } = body

    // Determine mode: Word template, rich text, or legacy blocks
    if (cover_html !== undefined) {
      // Word template mode: save cover_html and optionally results_html
      // end_html is not used (set to null)
      // Get current max version
      const { data: maxVersionData } = await supabaseAdmin
        .from('certificate_templates')
        .select('version')
        .eq('certificate_type', existing.certificate_type)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      const newVersion = (maxVersionData?.version ?? 0) + 1

      // Deactivate existing active versions
      await supabaseAdmin
        .from('certificate_templates')
        .update({ is_active: false })
        .eq('certificate_type', existing.certificate_type)
        .eq('is_active', true)

      // Insert new version with Word template HTML
      const { data: newRecord, error: insertError } = await supabaseAdmin
        .from('certificate_templates')
        .insert({
          name: existing.name,
          certificate_type: existing.certificate_type,
          cover_html: cover_html || null,
          results_html: results_html || null,
          end_html: null,
          repeating_header: repeating_header || null,
          repeating_footer: repeating_footer || null,
          cover_template_path: cover_template_path || null,
          results_template_path: results_template_path || null,
          page_settings: page_settings || existing.page_settings || null,
          version: newVersion,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) {
        // Re-activate previous version on failure
        await supabaseAdmin
          .from('certificate_templates')
          .update({ is_active: true })
          .eq('id', id)

        console.error('[admin/templates/[id]] PUT Word template insert error:', insertError)
        return NextResponse.json({ error: 'Gagal menyimpan template Word' }, { status: 500 })
      }

      return NextResponse.json(newRecord, { status: 200 })
    } else if (content) {
      // Rich text mode: no longer supported (TipTap removed)
      // Keep backward compatibility by saving content directly
      const saved = await saveRichTextVersion(id, content, page_settings)
      return NextResponse.json(saved)
    } else {
      // Legacy block mode (backward compatible) - save directly via Supabase
      // Get current max version
      const { data: maxVersionData } = await supabaseAdmin
        .from('certificate_templates')
        .select('version')
        .eq('certificate_type', existing.certificate_type)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      const newVersion = (maxVersionData?.version ?? 0) + 1

      // Deactivate existing active versions
      await supabaseAdmin
        .from('certificate_templates')
        .update({ is_active: false })
        .eq('certificate_type', existing.certificate_type)
        .eq('is_active', true)

      // Insert new version
      const { data: newRecord, error: insertError } = await supabaseAdmin
        .from('certificate_templates')
        .insert({
          name: existing.name,
          certificate_type: existing.certificate_type,
          cover_blocks: cover_blocks || [],
          results_blocks: results_blocks || [],
          version: newVersion,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) {
        // Re-activate previous version on failure
        await supabaseAdmin
          .from('certificate_templates')
          .update({ is_active: true })
          .eq('id', id)

        console.error('[admin/templates/[id]] PUT insert error:', insertError)
        return NextResponse.json({ error: 'Gagal menyimpan versi baru' }, { status: 500 })
      }

      return NextResponse.json(newRecord, { status: 200 })
    }
  } catch (e) {
    console.error('[admin/templates/[id]] PUT error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
