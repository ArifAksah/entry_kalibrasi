/**
 * PDF Template Service Client
 *
 * Utility functions for communicating with the Python PDF Template Service.
 * Handles routing decisions, rendering requests, and template uploads.
 *
 * @see Requirements 6.4, 6.5, 6.7, 8.7
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Get the base URL for the PDF Template Service.
 * Reads from environment variables with fallback to localhost:8000.
 */
function getPdfServiceUrl(): string {
  return (
    process.env.PDF_SERVICE_URL ||
    process.env.NEXT_PUBLIC_PDF_SERVICE_URL ||
    'http://localhost:8000'
  )
}

/** Timeout for requests to the PDF Template Service (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000

// ─── Routing Logic ───────────────────────────────────────────────────────────

/**
 * Determines whether a template should use the Python PDF Template Service
 * for PDF generation (as opposed to the legacy Playwright HTML rendering).
 *
 * Returns true if `cover_template_path` is a non-empty string, indicating
 * that a .docx template has been uploaded to the Python service.
 *
 * @param template - Template record with optional path and HTML fields
 * @returns true if the Python PDF Template Service should be used
 *
 * @example
 * ```ts
 * shouldUsePdfTemplateService({ cover_template_path: 'tmpl-abc/cover.docx' }) // true
 * shouldUsePdfTemplateService({ cover_template_path: null, cover_html: '<html>...' }) // false
 * shouldUsePdfTemplateService({ cover_template_path: '', cover_html: null }) // false
 * ```
 */
export function shouldUsePdfTemplateService(template: {
  cover_template_path?: string | null
  cover_html?: string | null
}): boolean {
  return typeof template.cover_template_path === 'string' &&
    template.cover_template_path.trim().length > 0
}

// ─── Render PDF ──────────────────────────────────────────────────────────────

/**
 * Renders a PDF via the Python PDF Template Service.
 *
 * Sends a POST request to /render-pdf with the template ID and data,
 * and returns the resulting PDF as a Buffer.
 *
 * @param templateId - The template identifier (e.g. "tmpl-abc-123")
 * @param data - Key-value data to fill into the template variables
 * @returns Buffer containing the rendered PDF
 * @throws Error with descriptive message for 4xx/5xx responses
 * @throws Error with 503-style message on timeout or connection refused
 *
 * @example
 * ```ts
 * const pdfBuffer = await renderPdfViaTemplateService('tmpl-abc-123', {
 *   nama_alat: 'Barometer Digital',
 *   merk: 'Vaisala',
 *   nomor_sertifikat: 'LK.01.01/2024/001',
 * })
 * ```
 */
export async function renderPdfViaTemplateService(
  templateId: string,
  data: Record<string, any>
): Promise<Buffer> {
  const baseUrl = getPdfServiceUrl()
  const url = `${baseUrl}/render-pdf`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, data }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorDetail = ''
      try {
        const errorBody = await response.json()
        errorDetail = errorBody.detail || JSON.stringify(errorBody)
      } catch {
        errorDetail = await response.text().catch(() => 'Unknown error')
      }

      throw new Error(
        `PDF Template Service error (HTTP ${response.status}): ${errorDetail}`
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    // Handle abort (timeout) and connection errors
    if (error.name === 'AbortError') {
      throw new Error(
        'Service PDF tidak tersedia, coba lagi nanti (timeout setelah 30 detik)'
      )
    }

    // Connection refused or network errors
    if (
      error.cause?.code === 'ECONNREFUSED' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('fetch failed') ||
      error.cause?.code === 'ENOTFOUND' ||
      error.code === 'ENOTFOUND'
    ) {
      throw new Error(
        'Service PDF tidak tersedia, coba lagi nanti (connection refused)'
      )
    }

    // Re-throw if it's already our formatted error
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Upload Template ─────────────────────────────────────────────────────────

/**
 * Response from the upload-template endpoint.
 */
export interface UploadTemplateResponse {
  path: string
  size_bytes: number
  variables: string[]
  loops: string[]
}

/**
 * Uploads a .docx template file to the Python PDF Template Service.
 *
 * @param templateId - The template identifier
 * @param section - Which section this template is for ('cover' or 'results')
 * @param file - The .docx file as a File or Buffer
 * @param fileName - The original filename (used in multipart form data)
 * @returns Parsed response with path, size, detected variables and loops
 * @throws Error for 4xx/5xx responses or connection issues
 *
 * @example
 * ```ts
 * const result = await uploadTemplateToPdfService(
 *   'tmpl-abc-123',
 *   'cover',
 *   fileBuffer,
 *   'template-cover.docx'
 * )
 * console.log(result.variables) // ['nama_alat', 'merk', 'tipe', ...]
 * ```
 */
export async function uploadTemplateToPdfService(
  templateId: string,
  section: 'cover' | 'results',
  file: File | Buffer,
  fileName: string
): Promise<UploadTemplateResponse> {
  const baseUrl = getPdfServiceUrl()
  const url = `${baseUrl}/upload-template`

  const formData = new FormData()
  formData.append('template_id', templateId)
  formData.append('section', section)

  if (Buffer.isBuffer(file)) {
    // Convert Buffer to Blob for FormData
    const blob = new Blob([new Uint8Array(file)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    formData.append('file', blob, fileName)
  } else {
    formData.append('file', file, fileName)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorDetail = ''
      try {
        const errorBody = await response.json()
        errorDetail = errorBody.detail || JSON.stringify(errorBody)
      } catch {
        errorDetail = await response.text().catch(() => 'Unknown error')
      }

      throw new Error(
        `PDF Template Service upload error (HTTP ${response.status}): ${errorDetail}`
      )
    }

    const result: UploadTemplateResponse = await response.json()
    return result
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Service template tidak tersedia. Pastikan service Python berjalan. (timeout)'
      )
    }

    if (
      error.cause?.code === 'ECONNREFUSED' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('fetch failed') ||
      error.cause?.code === 'ENOTFOUND' ||
      error.code === 'ENOTFOUND'
    ) {
      throw new Error(
        'Service template tidak tersedia. Pastikan service Python berjalan.'
      )
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
