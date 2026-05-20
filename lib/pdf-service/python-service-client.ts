/**
 * Python PDF Template Service Client
 *
 * Provides functions to communicate with the Python PDF Template Service
 * (FastAPI microservice) from the Next.js application.
 *
 * Features:
 * - renderPdf: Render a template with data and get PDF buffer
 * - uploadTemplate: Upload a .docx template file
 * - getPreviewUrl: Get URL for template preview image
 * - checkHealth: Check service health status
 *
 * Configuration:
 * - PDF_SERVICE_URL environment variable (default: http://localhost:8000)
 * - 30 second timeout for all requests
 * - Uses native fetch (available in Next.js server-side)
 *
 * @see Requirements 8.1, 8.2, 8.3, 8.5, 8.6
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Get the base URL for the PDF Template Service.
 * Reads from PDF_SERVICE_URL environment variable with fallback to localhost:8000.
 */
function getServiceUrl(): string {
  return process.env.PDF_SERVICE_URL || 'http://localhost:8000'
}

/** Timeout for all requests to the PDF Template Service (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadTemplateResponse {
  path: string
  size_bytes: number
  variables: string[]
  loops: string[]
}

export interface HealthCheckResponse {
  status: string
  version: string
  libreoffice_available: boolean
}

// ─── Error Handling Helper ───────────────────────────────────────────────────

/**
 * Wraps fetch errors with informative messages for timeout and connection issues.
 */
function handleFetchError(error: any, operation: string): never {
  if (error.name === 'AbortError') {
    throw new Error(
      `Service PDF tidak tersedia, coba lagi nanti (timeout ${REQUEST_TIMEOUT_MS / 1000}s pada operasi ${operation})`
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
      `Service PDF tidak tersedia, coba lagi nanti (connection refused pada operasi ${operation})`
    )
  }

  // Re-throw if it's already a formatted error from response handling
  throw error
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Renders a PDF via the Python PDF Template Service.
 *
 * Sends a POST request to /render-pdf with the template ID and data,
 * and returns the resulting PDF as a Buffer.
 *
 * @param templateId - The template identifier (e.g. "tmpl-abc-123")
 * @param data - Key-value data to fill into the template variables
 * @returns Buffer containing the rendered PDF
 * @throws Error with descriptive message for 4xx/5xx responses, timeout, or connection refused
 *
 * @example
 * ```ts
 * const pdfBuffer = await renderPdf('tmpl-abc-123', {
 *   nama_alat: 'Barometer Digital',
 *   merk: 'Vaisala',
 *   nomor_sertifikat: 'LK.01.01/2024/001',
 *   sensors: [{ sensor_nama: 'Sensor Tekanan', hasil_kalibrasi: [...] }],
 * })
 * ```
 */
export async function renderPdf(
  templateId: string,
  data: Record<string, any>
): Promise<Buffer> {
  const baseUrl = getServiceUrl()
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
    if (error.message?.includes('PDF Template Service error')) {
      throw error
    }
    handleFetchError(error, 'renderPdf')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Uploads a .docx template file to the Python PDF Template Service.
 *
 * @param templateId - The template identifier
 * @param section - Which section this template is for ('cover' or 'results')
 * @param file - The .docx file as a Buffer
 * @param fileName - The original filename (used in multipart form data)
 * @returns Parsed response with path, size, detected variables and loops
 * @throws Error for 4xx/5xx responses, timeout, or connection refused
 *
 * @example
 * ```ts
 * const result = await uploadTemplate(
 *   'tmpl-abc-123',
 *   'cover',
 *   fileBuffer,
 *   'template-cover.docx'
 * )
 * console.log(result.variables) // ['nama_alat', 'merk', 'tipe', ...]
 * console.log(result.loops)     // ['sensors', 'hasil_kalibrasi']
 * ```
 */
export async function uploadTemplate(
  templateId: string,
  section: 'cover' | 'results',
  file: Buffer,
  fileName: string
): Promise<UploadTemplateResponse> {
  const baseUrl = getServiceUrl()
  const url = `${baseUrl}/upload-template`

  const formData = new FormData()
  formData.append('template_id', templateId)
  formData.append('section', section)

  // Convert Buffer to Blob for FormData
  const blob = new Blob([new Uint8Array(file)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  formData.append('file', blob, fileName)

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
    if (error.message?.includes('PDF Template Service')) {
      throw error
    }
    handleFetchError(error, 'uploadTemplate')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Returns the URL for a template preview image (PNG).
 *
 * This URL can be used directly in an <img> tag or fetched server-side.
 * The Python service generates a PNG preview of the first page of the template.
 *
 * @param templateId - The template identifier
 * @param section - Which section to preview ('cover' or 'results')
 * @returns Full URL string for the preview endpoint
 *
 * @example
 * ```ts
 * const previewUrl = getPreviewUrl('tmpl-abc-123', 'cover')
 * // "http://localhost:8000/preview-template?template_id=tmpl-abc-123&section=cover"
 * ```
 */
export function getPreviewUrl(
  templateId: string,
  section: 'cover' | 'results'
): string {
  const baseUrl = getServiceUrl()
  return `${baseUrl}/preview-template?template_id=${encodeURIComponent(templateId)}&section=${encodeURIComponent(section)}`
}

/**
 * Checks the health status of the Python PDF Template Service.
 *
 * @returns Health check response with status, version, and LibreOffice availability
 * @throws Error on timeout or connection refused
 *
 * @example
 * ```ts
 * const health = await checkHealth()
 * // { status: 'ok', version: '1.0.0', libreoffice_available: true }
 * ```
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  const baseUrl = getServiceUrl()
  const url = `${baseUrl}/health`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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
        `PDF Template Service health check failed (HTTP ${response.status}): ${errorDetail}`
      )
    }

    const result: HealthCheckResponse = await response.json()
    return result
  } catch (error: any) {
    if (error.message?.includes('PDF Template Service')) {
      throw error
    }
    handleFetchError(error, 'checkHealth')
  } finally {
    clearTimeout(timeoutId)
  }
}
