/**
 * Unit tests for generate-pdf-via-template-service module.
 *
 * Tests the integration logic that ties routing, data mapping,
 * PDF rendering, and storage upload together.
 *
 * @see Requirements 8.1, 8.4, 8.5, 8.6
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock Supabase client — use var for hoisting compatibility with jest.mock
var mockUpload = jest.fn()
var mockUpdate = jest.fn()
var mockEq = jest.fn()
var mockGetBucket = jest.fn()
var mockCreateBucket = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (data: any) => {
        mockUpdate(table, data)
        return { eq: (col: string, val: any) => { mockEq(col, val); return { error: null } } }
      },
    }),
    storage: {
      getBucket: mockGetBucket,
      createBucket: mockCreateBucket,
      from: () => ({
        upload: mockUpload,
      }),
    },
  }),
}))

// Mock renderPdfViaTemplateService
const mockRenderPdf = jest.fn()
jest.mock('../../lib/pdf-service/pdf-template-client', () => ({
  shouldUsePdfTemplateService: jest.requireActual('../../lib/pdf-service/pdf-template-client').shouldUsePdfTemplateService,
  renderPdfViaTemplateService: (...args: any[]) => mockRenderPdf(...args),
}))

// Mock uploadPdfToStorage
const mockUploadPdfToStorage = jest.fn()
jest.mock('../../lib/certificate-pdf-storage', () => ({
  uploadPdfToStorage: (...args: any[]) => mockUploadPdfToStorage(...args),
  CERTIFICATE_PDF_BUCKET: 'certificate-pdfs',
  CERTIFICATE_PDF_FOLDER: 'signed',
  buildStoragePdfPath: (fileName: string) => `storage:certificate-pdfs/signed/${fileName}`,
}))

// Mock generateAndSaveCertificatePDF
const mockGenerateAndSave = jest.fn()
jest.mock('../../lib/pdf-service/index', () => ({
  generateAndSaveCertificatePDF: (...args: any[]) => mockGenerateAndSave(...args),
}))

import {
  generatePdfViaTemplateService,
  generateCertificatePdfWithFallback,
} from '../../lib/pdf-service/generate-pdf-via-template-service'

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockGetBucket.mockResolvedValue({ data: { id: 'certificate-pdfs' }, error: null })
  mockUpload.mockResolvedValue({ error: null })
})

// ─── generatePdfViaTemplateService ───────────────────────────────────────────

describe('generatePdfViaTemplateService', () => {
  const certificateId = 123
  const certificate = {
    certificate_number: 'LK.01.01/2024/001',
    instrument: { name: 'Barometer', brand: 'Vaisala' },
    station: { name: 'Stasiun Bogor' },
    sensors: [],
  }
  const template = { id: 'tmpl-abc-123', cover_template_path: 'tmpl-abc-123/cover.docx' }

  it('should generate PDF, upload to storage, and update database on success', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 test content')
    mockRenderPdf.mockResolvedValue(pdfBuffer)
    mockUploadPdfToStorage.mockResolvedValue('storage:certificate-pdfs/signed/certificate_LK_01_01_2024_001_123.pdf')

    const result = await generatePdfViaTemplateService(certificateId, certificate, template)

    expect(result.success).toBe(true)
    expect(result.pdfPath).toBe('storage:certificate-pdfs/signed/certificate_LK_01_01_2024_001_123.pdf')
    expect(result.error).toBeUndefined()

    // Verify renderPdfViaTemplateService was called with correct args
    expect(mockRenderPdf).toHaveBeenCalledWith('tmpl-abc-123', expect.objectContaining({
      nama_alat: 'Barometer',
      merk: 'Vaisala',
      nama_stasiun: 'Stasiun Bogor',
      nomor_sertifikat: 'LK.01.01/2024/001',
    }))

    // Verify upload was called
    expect(mockUploadPdfToStorage).toHaveBeenCalledWith(
      expect.anything(),
      pdfBuffer,
      'certificate_LK_01_01_2024_001_123.pdf'
    )
  })

  it('should return error when PDF Template Service returns 4xx/5xx', async () => {
    mockRenderPdf.mockRejectedValue(
      new Error('PDF Template Service error (HTTP 500): Gagal mengkonversi dokumen ke PDF')
    )

    const result = await generatePdfViaTemplateService(certificateId, certificate, template)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Gagal render PDF')
    expect(result.error).toContain('HTTP 500')
  })

  it('should return service unavailable error on timeout', async () => {
    mockRenderPdf.mockRejectedValue(
      new Error('Service PDF tidak tersedia, coba lagi nanti (timeout setelah 30 detik)')
    )

    const result = await generatePdfViaTemplateService(certificateId, certificate, template)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Service PDF tidak tersedia, coba lagi nanti')
  })

  it('should return service unavailable error on connection refused', async () => {
    mockRenderPdf.mockRejectedValue(
      new Error('Service PDF tidak tersedia, coba lagi nanti (connection refused)')
    )

    const result = await generatePdfViaTemplateService(certificateId, certificate, template)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Service PDF tidak tersedia, coba lagi nanti')
  })

  it('should handle certificate with no certificate_number gracefully', async () => {
    const certNoNumber = { ...certificate, certificate_number: null, no_certificate: null }
    const pdfBuffer = Buffer.from('%PDF-1.4 test')
    mockRenderPdf.mockResolvedValue(pdfBuffer)
    mockUploadPdfToStorage.mockResolvedValue('storage:certificate-pdfs/signed/certificate__123.pdf')

    const result = await generatePdfViaTemplateService(certificateId, certNoNumber, template)

    expect(result.success).toBe(true)
    expect(mockUploadPdfToStorage).toHaveBeenCalledWith(
      expect.anything(),
      pdfBuffer,
      'certificate__123.pdf'
    )
  })
})

// ─── generateCertificatePdfWithFallback ──────────────────────────────────────

describe('generateCertificatePdfWithFallback', () => {
  const certificateId = 456
  const certificate = {
    certificate_number: 'LK.02/2024/005',
    instrument: { name: 'Thermometer' },
    station: { name: 'Stasiun Jakarta' },
    sensors: [],
  }

  it('should use PDF Template Service when template has cover_template_path', async () => {
    const template = { id: 'tmpl-xyz', cover_template_path: 'tmpl-xyz/cover.docx' }
    const pdfBuffer = Buffer.from('%PDF-1.4 content')
    mockRenderPdf.mockResolvedValue(pdfBuffer)
    mockUploadPdfToStorage.mockResolvedValue('storage:certificate-pdfs/signed/certificate_LK_02_2024_005_456.pdf')

    const result = await generateCertificatePdfWithFallback(
      certificateId, certificate, template
    )

    expect(result.success).toBe(true)
    expect(mockRenderPdf).toHaveBeenCalled()
    expect(mockGenerateAndSave).not.toHaveBeenCalled()
  })

  it('should fallback to Playwright when template has no cover_template_path', async () => {
    const template = { id: 'tmpl-old', cover_template_path: null, cover_html: '<html>...</html>' }
    mockGenerateAndSave.mockResolvedValue({ success: true, pdfPath: 'storage:certificate-pdfs/signed/old.pdf' })

    const result = await generateCertificatePdfWithFallback(
      certificateId, certificate, template, 'user-123', 'pass123', false
    )

    expect(result.success).toBe(true)
    expect(result.pdfPath).toBe('storage:certificate-pdfs/signed/old.pdf')
    expect(mockGenerateAndSave).toHaveBeenCalledWith(certificateId, 'user-123', 'pass123', false)
    expect(mockRenderPdf).not.toHaveBeenCalled()
  })

  it('should fallback to Playwright when cover_template_path is empty string', async () => {
    const template = { id: 'tmpl-empty', cover_template_path: '', cover_html: '<html>...</html>' }
    mockGenerateAndSave.mockResolvedValue({ success: true, pdfPath: 'storage:path.pdf' })

    const result = await generateCertificatePdfWithFallback(
      certificateId, certificate, template
    )

    expect(result.success).toBe(true)
    expect(mockGenerateAndSave).toHaveBeenCalled()
    expect(mockRenderPdf).not.toHaveBeenCalled()
  })

  it('should propagate error from fallback Playwright generation', async () => {
    const template = { id: 'tmpl-old', cover_template_path: null }
    mockGenerateAndSave.mockResolvedValue({ success: false, error: 'Rendering failed' })

    const result = await generateCertificatePdfWithFallback(
      certificateId, certificate, template
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Rendering failed')
  })
})
