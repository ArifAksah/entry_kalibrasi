import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { importDocx } from '@/lib/rich-text-editor/docx-importer'

/**
 * POST /api/admin/templates/import-docx
 * Convert a .docx file to TipTap JSON document.
 * Accepts multipart form data with a 'file' field (.docx).
 * Returns { document: TipTapDocument, warnings: string[] }
 */
export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran file melebihi 10MB' },
        { status: 400 }
      )
    }

    // Validate file extension
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan file .docx (Microsoft Word)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { document, warnings } = await importDocx(buffer)

    return NextResponse.json({ document, warnings })
  } catch (e) {
    console.error('[import-docx] Error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor file DOCX' }, { status: 500 })
  }
}
