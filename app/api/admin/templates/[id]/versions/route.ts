import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { getRichTextTemplateById } from '@/lib/rich-text-editor/storage-service'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Get the template to find its certificate_type
    const template = await getRichTextTemplateById(id)
    if (!template) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }

    // Query all versions for this certificate_type, ordered by version DESC
    const { data, error } = await supabaseAdmin
      .from('certificate_templates')
      .select('id, version, is_active, created_at, updated_at')
      .eq('certificate_type', template.certificate_type)
      .order('version', { ascending: false })

    if (error) {
      console.error('[admin/templates/[id]/versions] Query error:', error)
      return NextResponse.json({ error: 'Gagal mengambil daftar versi' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (e) {
    console.error('[admin/templates/[id]/versions] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
