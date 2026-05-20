import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'
import { uploadTemplate } from '@/lib/pdf-service/python-service-client'

/**
 * POST /api/admin/templates/upload-to-service
 *
 * Proxy route that receives a .docx file from the browser and forwards it
 * to the Python PDF Template Service (POST /upload-template).
 *
 * This proxy is needed because the Python service runs on a different port
 * and the browser cannot call it directly without CORS configuration.
 *
 * Request: multipart/form-data with fields:
 *   - file: .docx file
 *   - template_id: string
 *   - section: "cover" | "results"
 *
 * Response: JSON from the Python service with path, size_bytes, variables, loops
 *
 * @see Requirements 5.1, 5.2, 5.6
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const templateId = formData.get('template_id') as string | null
    const section = formData.get('section') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!templateId) {
      return NextResponse.json({ error: 'template_id tidak ditemukan' }, { status: 400 })
    }

    if (!section || (section !== 'cover' && section !== 'results')) {
      return NextResponse.json({ error: 'section harus "cover" atau "results"' }, { status: 400 })
    }

    // Client-side validation (also done on frontend, but double-check)
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Format file tidak didukung. Gunakan file .docx' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file melebihi 10MB' }, { status: 400 })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Forward to Python PDF Template Service
    console.log(`[upload-to-service] Uploading template_id=${templateId}, section=${section}, file=${file.name}, size=${file.size}`)
    const result = await uploadTemplate(
      templateId,
      section as 'cover' | 'results',
      fileBuffer,
      file.name
    )
    console.log(`[upload-to-service] ✅ Upload success: path=${result.path}, variables=${result.variables.length}, loops=${result.loops.length}`)

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('[upload-to-service] Error:', error.message)

    // Check if it's a connection error from the Python service
    if (
      error.message?.includes('connection refused') ||
      error.message?.includes('timeout') ||
      error.message?.includes('tidak tersedia')
    ) {
      return NextResponse.json(
        { error: 'Service template tidak tersedia. Pastikan service Python berjalan.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Gagal mengupload template' },
      { status: 500 }
    )
  }
}
