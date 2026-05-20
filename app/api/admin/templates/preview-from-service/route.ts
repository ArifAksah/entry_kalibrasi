import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getUserRole } from '@/lib/certificate-access'

/**
 * GET /api/admin/templates/preview-from-service?template_id={id}&section={section}
 *
 * Proxy route that fetches a template preview PNG from the Python PDF Template Service
 * (GET /preview-template) and returns it to the browser.
 *
 * This proxy is needed because the Python service runs on a different port
 * and may not have CORS configured for the browser origin.
 *
 * Query params:
 *   - template_id: string
 *   - section: "cover" | "results"
 *
 * Response: image/png binary
 *
 * @see Requirements 5.4
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('template_id')
    const section = searchParams.get('section')

    if (!templateId) {
      return NextResponse.json({ error: 'template_id tidak ditemukan' }, { status: 400 })
    }

    if (!section || (section !== 'cover' && section !== 'results')) {
      return NextResponse.json({ error: 'section harus "cover" atau "results"' }, { status: 400 })
    }

    // Get PDF service URL from environment
    const serviceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:8000'
    const previewUrl = `${serviceUrl}/preview-template?template_id=${encodeURIComponent(templateId)}&section=${encodeURIComponent(section)}`

    console.log(`[preview-from-service] Fetching preview: ${previewUrl}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(previewUrl, {
        method: 'GET',
        signal: controller.signal,
      })

      if (!response.ok) {
        // Log the error body for debugging
        let errorBody = ''
        try {
          errorBody = await response.text()
        } catch {}
        console.error(`[preview-from-service] Python service returned ${response.status}: ${errorBody}`)

        if (response.status === 404) {
          return NextResponse.json(
            { error: 'Preview template tidak ditemukan. Upload template terlebih dahulu.' },
            { status: 404 }
          )
        }
        if (response.status === 422) {
          return NextResponse.json(
            { error: `Validasi gagal: ${errorBody}` },
            { status: 422 }
          )
        }
        return NextResponse.json(
          { error: `Gagal mengambil preview template (${response.status})` },
          { status: response.status }
        )
      }

      const imageBuffer = await response.arrayBuffer()

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error: any) {
    console.error('[preview-from-service] Error:', error.message)

    if (
      error.name === 'AbortError' ||
      error.message?.includes('connection refused') ||
      error.message?.includes('timeout') ||
      error.message?.includes('tidak tersedia') ||
      error.message?.includes('fetch failed') ||
      error.cause?.code === 'ECONNREFUSED'
    ) {
      return NextResponse.json(
        { error: 'Service template tidak tersedia. Pastikan service Python berjalan.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Gagal mengambil preview' },
      { status: 500 }
    )
  }
}
