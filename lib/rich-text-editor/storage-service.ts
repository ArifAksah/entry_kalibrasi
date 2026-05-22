/**
 * Storage Service for Certificate Templates.
 *
 * Provides CRUD operations for certificate templates.
 * Uses Supabase admin client for server-side database queries
 * against the `certificate_templates` table.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PageSettings, RichTextTemplateRecord } from './types'

// ─── Read Operations ─────────────────────────────────────────────────────────

/**
 * Get a single template record by its UUID.
 * Returns null if not found.
 */
export async function getRichTextTemplateById(
  id: string
): Promise<RichTextTemplateRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching rich text template by ID:', error)
    throw new Error(`Gagal mengambil template: ${error.message}`)
  }

  return data as RichTextTemplateRecord
}

/**
 * Get the active rich text template for a given certificate_type.
 * Returns the template with is_active = true, and either content IS NOT NULL
 * or cover_html IS NOT NULL (Word template), with the highest version number.
 * Returns null if no active rich text/word template exists for that type.
 */
export async function getActiveRichTextTemplate(
  certificateType: string
): Promise<RichTextTemplateRecord | null> {
  // Try to find a template with cover_html (Word) or content (legacy)
  const { data, error } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('certificate_type', certificateType)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching active rich text template:', error)
    throw new Error(
      `Gagal mengambil template aktif untuk tipe ${certificateType}: ${error.message}`
    )
  }

  if (!data || data.length === 0) return null

  // Find first template that has either content or cover_html
  const template = data.find((t: any) => t.content != null || t.cover_html != null)
  return (template as RichTextTemplateRecord) || null
}

/**
 * Get a specific version of a template by certificate_type and version number.
 * Returns null if the specific version is not found.
 */
export async function getRichTextTemplateByVersion(
  certificateType: string,
  version: number
): Promise<RichTextTemplateRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('certificate_type', certificateType)
    .eq('version', version)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching template by version:', error)
    throw new Error(
      `Gagal mengambil template ${certificateType} versi ${version}: ${error.message}`
    )
  }

  return data as RichTextTemplateRecord
}

/**
 * List all active templates, ordered by name.
 * Returns templates where is_active = true.
 */
export async function listRichTextTemplates(): Promise<RichTextTemplateRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error listing rich text templates:', error)
    throw new Error(`Gagal mengambil daftar template: ${error.message}`)
  }

  return (data as RichTextTemplateRecord[]) || []
}

// ─── Write Operations ────────────────────────────────────────────────────────

/**
 * Save a new version of a template (legacy - kept for backward compat).
 * Prefer using the Python service for new template uploads.
 */
export async function saveRichTextVersion(
  templateId: string,
  content: any,
  pageSettings: PageSettings
): Promise<RichTextTemplateRecord> {
  // 1. Get existing template to find certificate_type and name
  const existing = await getRichTextTemplateById(templateId)
  if (!existing) {
    throw new Error('Template tidak ditemukan')
  }

  // 2. Get current max version for this certificate_type
  const { data: maxVersionData, error: maxVersionError } = await supabaseAdmin
    .from('certificate_templates')
    .select('version')
    .eq('certificate_type', existing.certificate_type)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (maxVersionError && maxVersionError.code !== 'PGRST116') {
    console.error('Error fetching max version:', maxVersionError)
    throw new Error(`Gagal mengambil versi terbaru: ${maxVersionError.message}`)
  }

  const currentMaxVersion = maxVersionData?.version ?? 0
  const newVersion = currentMaxVersion + 1

  // 3. Deactivate all existing active versions for this certificate_type
  const { error: deactivateError } = await supabaseAdmin
    .from('certificate_templates')
    .update({ is_active: false })
    .eq('certificate_type', existing.certificate_type)
    .eq('is_active', true)

  if (deactivateError) {
    console.error('Error deactivating previous versions:', deactivateError)
    throw new Error(
      `Gagal menonaktifkan versi sebelumnya: ${deactivateError.message}`
    )
  }

  // 4. Insert new record with incremented version
  const { data: newRecord, error: insertError } = await supabaseAdmin
    .from('certificate_templates')
    .insert({
      name: existing.name,
      certificate_type: existing.certificate_type,
      content,
      page_settings: pageSettings,
      version: newVersion,
      is_active: true,
    })
    .select()
    .single()

  if (insertError) {
    // Attempt to re-activate the previous version on failure
    await supabaseAdmin
      .from('certificate_templates')
      .update({ is_active: true })
      .eq('id', templateId)

    console.error('Error inserting new version:', insertError)
    throw new Error(`Gagal menyimpan versi baru: ${insertError.message}`)
  }

  return newRecord as RichTextTemplateRecord
}
