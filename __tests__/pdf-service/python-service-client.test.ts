/**
 * Unit tests for the Python PDF Template Service Client module.
 *
 * Tests the client functions: renderPdf, uploadTemplate, getPreviewUrl, checkHealth.
 * Uses mocked fetch to simulate service responses.
 *
 * @see Requirements 8.1, 8.5, 8.6
 */

import {
  renderPdf,
  uploadTemplate,
  getPreviewUrl,
  checkHealth,
} from '../../lib/pdf-service/python-service-client'

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env.PDF_SERVICE_URL = 'http://test-service:8000'
})

afterEach(() => {
  delete process.env.PDF_SERVICE_URL
})

// ─── getPreviewUrl ───────────────────────────────────────────────────────────

describe('getPreviewUrl', () => {
  it('should return correct URL for cover section', () => {
    const url = getPreviewUrl('tmpl-abc-123', 'cover')
    expect(url).toBe('http://test-service:8000/preview-template?template_id=tmpl-abc-123&section=cover')
  })

  it('should return correct URL for results section', () => {
    const url = getPreviewUrl('tmpl-abc-123', 'results')
    expect(url).toBe('http://test-service:8000/preview-template?template_id=tmpl-abc-123&section=results')
  })

  it('should encode special characters in template_id', () => {
    const url = getPreviewUrl('tmpl with spaces', 'cover')
    expect(url).toContain('template_id=tmpl%20with%20spaces')
  })

  it('should use default URL when PDF_SERVICE_URL is not set', () => {
    delete process.env.PDF_SERVICE_URL
    const url = getPreviewUrl('tmpl-123', 'cover')
    expect(url).toBe('http://localhost:8000/preview-template?template_id=tmpl-123&section=cover')
  })
})

// ─── renderPdf ───────────────────────────────────────────────────────────────

describe('renderPdf', () => {
  it('should call POST /render-pdf with correct body and return Buffer', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 fake content')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(
        pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.byteLength)
      ),
    })

    const result = await renderPdf('tmpl-abc', { nama_alat: 'Test' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-service:8000/render-pdf',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: 'tmpl-abc', data: { nama_alat: 'Test' } }),
      })
    )
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBe(pdfContent.length)
  })

  it('should use default URL when PDF_SERVICE_URL is not set', async () => {
    delete process.env.PDF_SERVICE_URL
    const pdfContent = Buffer.from('%PDF')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(
        pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.byteLength)
      ),
    })

    await renderPdf('tmpl-abc', {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/render-pdf',
      expect.anything()
    )
  })

  it('should throw descriptive error on 404 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Template tidak ditemukan' }),
    })

    await expect(renderPdf('nonexistent', {})).rejects.toThrow(
      'PDF Template Service error (HTTP 404): Template tidak ditemukan'
    )
  })

  it('should throw descriptive error on 500 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Gagal mengkonversi dokumen ke PDF' }),
    })

    await expect(renderPdf('tmpl-abc', {})).rejects.toThrow(
      'PDF Template Service error (HTTP 500)'
    )
  })

  it('should handle text error response when JSON parsing fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Bad Gateway'),
    })

    await expect(renderPdf('tmpl-abc', {})).rejects.toThrow(
      'PDF Template Service error (HTTP 502): Bad Gateway'
    )
  })

  it('should throw timeout error on AbortError', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    await expect(renderPdf('tmpl-abc', {})).rejects.toThrow(
      'Service PDF tidak tersedia'
    )
  })

  it('should throw connection refused error on ECONNREFUSED', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ECONNREFUSED' }
    mockFetch.mockRejectedValueOnce(connError)

    await expect(renderPdf('tmpl-abc', {})).rejects.toThrow(
      'Service PDF tidak tersedia'
    )
  })

  it('should throw connection error on ENOTFOUND', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ENOTFOUND' }
    mockFetch.mockRejectedValueOnce(connError)

    await expect(renderPdf('tmpl-abc', {})).rejects.toThrow(
      'Service PDF tidak tersedia'
    )
  })
})

// ─── uploadTemplate ──────────────────────────────────────────────────────────

describe('uploadTemplate', () => {
  it('should call POST /upload-template and return parsed response', async () => {
    const mockResponse = {
      path: 'tmpl-abc/cover.docx',
      size_bytes: 45230,
      variables: ['nama_alat', 'merk'],
      loops: ['sensors'],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const fileBuffer = Buffer.from('fake docx content')
    const result = await uploadTemplate('tmpl-abc', 'cover', fileBuffer, 'template.docx')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-service:8000/upload-template',
      expect.objectContaining({
        method: 'POST',
      })
    )
    expect(result.path).toBe('tmpl-abc/cover.docx')
    expect(result.size_bytes).toBe(45230)
    expect(result.variables).toEqual(['nama_alat', 'merk'])
    expect(result.loops).toEqual(['sensors'])
  })

  it('should throw error on upload failure (400)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Format file tidak didukung' }),
    })

    const fileBuffer = Buffer.from('not a docx')
    await expect(
      uploadTemplate('tmpl-abc', 'cover', fileBuffer, 'bad.txt')
    ).rejects.toThrow('PDF Template Service upload error (HTTP 400): Format file tidak didukung')
  })

  it('should throw connection error when service is down', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ECONNREFUSED' }
    mockFetch.mockRejectedValueOnce(connError)

    const fileBuffer = Buffer.from('content')
    await expect(
      uploadTemplate('tmpl-abc', 'cover', fileBuffer, 'template.docx')
    ).rejects.toThrow('Service PDF tidak tersedia')
  })

  it('should throw timeout error on AbortError', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    const fileBuffer = Buffer.from('content')
    await expect(
      uploadTemplate('tmpl-abc', 'cover', fileBuffer, 'template.docx')
    ).rejects.toThrow('Service PDF tidak tersedia')
  })
})

// ─── checkHealth ─────────────────────────────────────────────────────────────

describe('checkHealth', () => {
  it('should return health status on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '1.0.0',
        libreoffice_available: true,
      }),
    })

    const result = await checkHealth()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-service:8000/health',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
    )
    expect(result.status).toBe('ok')
    expect(result.version).toBe('1.0.0')
    expect(result.libreoffice_available).toBe(true)
  })

  it('should throw error when service returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Internal Server Error'),
    })

    await expect(checkHealth()).rejects.toThrow(
      'PDF Template Service health check failed (HTTP 500)'
    )
  })

  it('should throw connection error when service is unreachable', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ENOTFOUND' }
    mockFetch.mockRejectedValueOnce(connError)

    await expect(checkHealth()).rejects.toThrow('Service PDF tidak tersedia')
  })
})
