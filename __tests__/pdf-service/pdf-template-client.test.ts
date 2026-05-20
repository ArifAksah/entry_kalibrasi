/**
 * Unit tests for the PDF Template Client module.
 *
 * Tests routing logic, render requests, and upload functionality.
 * @see Requirements 6.4, 6.5, 6.7, 8.7
 */

import {
  shouldUsePdfTemplateService,
  renderPdfViaTemplateService,
  uploadTemplateToPdfService,
} from '../../lib/pdf-service/pdf-template-client'

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.PDF_SERVICE_URL
  delete process.env.NEXT_PUBLIC_PDF_SERVICE_URL
})

// ─── shouldUsePdfTemplateService ─────────────────────────────────────────────

describe('shouldUsePdfTemplateService', () => {
  it('should return true when cover_template_path is a non-empty string', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: 'tmpl-abc/cover.docx' })
    ).toBe(true)
  })

  it('should return true when cover_template_path has content (ignoring whitespace)', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: '  tmpl-abc/cover.docx  ' })
    ).toBe(true)
  })

  it('should return false when cover_template_path is null', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: null, cover_html: '<html></html>' })
    ).toBe(false)
  })

  it('should return false when cover_template_path is undefined', () => {
    expect(
      shouldUsePdfTemplateService({ cover_html: '<html></html>' })
    ).toBe(false)
  })

  it('should return false when cover_template_path is empty string', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: '', cover_html: '<html></html>' })
    ).toBe(false)
  })

  it('should return false when cover_template_path is whitespace only', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: '   ', cover_html: '<html></html>' })
    ).toBe(false)
  })

  it('should return true regardless of cover_html value when path is set', () => {
    expect(
      shouldUsePdfTemplateService({ cover_template_path: 'tmpl/cover.docx', cover_html: null })
    ).toBe(true)
    expect(
      shouldUsePdfTemplateService({ cover_template_path: 'tmpl/cover.docx', cover_html: '<html></html>' })
    ).toBe(true)
  })
})

// ─── renderPdfViaTemplateService ─────────────────────────────────────────────

describe('renderPdfViaTemplateService', () => {
  it('should call POST /render-pdf with correct body and return PDF buffer', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 fake content')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.byteLength)),
    })

    const result = await renderPdfViaTemplateService('tmpl-123', { nama_alat: 'Test' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/render-pdf',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: 'tmpl-123', data: { nama_alat: 'Test' } }),
      })
    )
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('should use PDF_SERVICE_URL env var when set', async () => {
    process.env.PDF_SERVICE_URL = 'http://pdf-service:9000'
    const pdfContent = Buffer.from('%PDF-1.4')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.byteLength)),
    })

    await renderPdfViaTemplateService('tmpl-123', {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://pdf-service:9000/render-pdf',
      expect.anything()
    )
  })

  it('should use NEXT_PUBLIC_PDF_SERVICE_URL as fallback', async () => {
    process.env.NEXT_PUBLIC_PDF_SERVICE_URL = 'http://public-pdf:7000'
    const pdfContent = Buffer.from('%PDF-1.4')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.byteLength)),
    })

    await renderPdfViaTemplateService('tmpl-123', {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://public-pdf:7000/render-pdf',
      expect.anything()
    )
  })

  it('should throw error with status code for 4xx responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Template tidak ditemukan' }),
    })

    await expect(
      renderPdfViaTemplateService('nonexistent', {})
    ).rejects.toThrow('PDF Template Service error (HTTP 404): Template tidak ditemukan')
  })

  it('should throw error with status code for 5xx responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Gagal mengkonversi dokumen ke PDF' }),
    })

    await expect(
      renderPdfViaTemplateService('tmpl-123', {})
    ).rejects.toThrow('PDF Template Service error (HTTP 500)')
  })

  it('should throw 503-style error on AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    await expect(
      renderPdfViaTemplateService('tmpl-123', {})
    ).rejects.toThrow('Service PDF tidak tersedia, coba lagi nanti (timeout')
  })

  it('should throw 503-style error on connection refused', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ECONNREFUSED' }
    mockFetch.mockRejectedValueOnce(connError)

    await expect(
      renderPdfViaTemplateService('tmpl-123', {})
    ).rejects.toThrow('Service PDF tidak tersedia, coba lagi nanti (connection refused)')
  })

  it('should handle text error response when JSON parsing fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Bad Gateway'),
    })

    await expect(
      renderPdfViaTemplateService('tmpl-123', {})
    ).rejects.toThrow('PDF Template Service error (HTTP 502): Bad Gateway')
  })
})

// ─── uploadTemplateToPdfService ──────────────────────────────────────────────

describe('uploadTemplateToPdfService', () => {
  it('should call POST /upload-template with multipart form data and return response', async () => {
    const mockResponse = {
      path: 'tmpl-123/cover.docx',
      size_bytes: 45230,
      variables: ['nama_alat', 'merk'],
      loops: ['sensors'],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const fileBuffer = Buffer.from('fake docx content')
    const result = await uploadTemplateToPdfService(
      'tmpl-123',
      'cover',
      fileBuffer,
      'template.docx'
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/upload-template',
      expect.objectContaining({
        method: 'POST',
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('should throw error for 4xx upload responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Format file tidak didukung' }),
    })

    const fileBuffer = Buffer.from('not a docx')
    await expect(
      uploadTemplateToPdfService('tmpl-123', 'cover', fileBuffer, 'file.txt')
    ).rejects.toThrow('PDF Template Service upload error (HTTP 400): Format file tidak didukung')
  })

  it('should throw connection error message on timeout', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    const fileBuffer = Buffer.from('fake docx')
    await expect(
      uploadTemplateToPdfService('tmpl-123', 'cover', fileBuffer, 'template.docx')
    ).rejects.toThrow('Service template tidak tersedia. Pastikan service Python berjalan.')
  })

  it('should throw connection error on ECONNREFUSED', async () => {
    const connError = new Error('fetch failed')
    ;(connError as any).cause = { code: 'ECONNREFUSED' }
    mockFetch.mockRejectedValueOnce(connError)

    const fileBuffer = Buffer.from('fake docx')
    await expect(
      uploadTemplateToPdfService('tmpl-123', 'results', fileBuffer, 'template.docx')
    ).rejects.toThrow('Service template tidak tersedia. Pastikan service Python berjalan.')
  })
})
