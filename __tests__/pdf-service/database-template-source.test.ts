/**
 * Unit tests for the DatabaseTemplateSource module.
 *
 * Tests the multi-level fallback resolution:
 * Cache → Database (Rich Text) → Hardcoded Registry
 */

import { createDatabaseTemplateSource, clearConfigCache } from '../../lib/pdf-service/database-template-source'
import type { CertificateType, TemplateConfig } from '../../lib/pdf-service/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {},
}))

jest.mock('../../lib/rich-text-editor/storage-service', () => ({
  getActiveRichTextTemplate: jest.fn(),
  getRichTextTemplateByVersion: jest.fn(),
  getRichTextTemplateById: jest.fn(),
}))

jest.mock('../../lib/pdf-service/template-registry', () => {
  const mockGet = jest.fn()
  return {
    defaultRegistry: {
      get: mockGet,
      has: jest.fn(),
      register: jest.fn(),
      listTypes: jest.fn(),
    },
  }
})

import { getActiveRichTextTemplate, getRichTextTemplateByVersion } from '../../lib/rich-text-editor/storage-service'
import { defaultRegistry } from '../../lib/pdf-service/template-registry'

const mockGetActiveRichTextTemplate = getActiveRichTextTemplate as jest.MockedFunction<typeof getActiveRichTextTemplate>
const mockGetRichTextTemplateByVersion = getRichTextTemplateByVersion as jest.MockedFunction<typeof getRichTextTemplateByVersion>
const mockRegistryGet = defaultRegistry.get as jest.MockedFunction<typeof defaultRegistry.get>

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockTemplateConfig(type: CertificateType = 'fc'): TemplateConfig {
  return {
    type,
    header: {
      agencyName: 'BMKG',
      labName: 'Lab Kalibrasi',
      logoPath: '/logos/bmkg.png',
    },
    coverPage: {
      titleId: 'SERTIFIKAT KALIBRASI',
      titleEn: 'CALIBRATION CERTIFICATE',
      showAccreditation: false,
      showTraceability: false,
      showValidityDates: false,
      sections: [],
    },
    resultsPage: {
      headerRepeat: true,
      footerRepeat: true,
      showUncertainty: false,
      oneSensorPerPage: true,
    },
    footer: {
      formCode: 'F/IKK 7.8.2',
      showQRCode: true,
      qrPosition: 'bottom-left',
      officeAddress: 'Jakarta',
      signatureNote: 'Ditandatangani elektronik',
    },
    styling: {
      fontFamily: 'Arial',
      baseFontSize: '11pt',
      headerBorderStyle: 'double',
      pageMargin: '5mm',
    },
  }
}

function createMockRichTextTemplate(type: string = 'fc', version: number = 1) {
  return {
    id: 'uuid-123',
    name: `Template ${type}`,
    certificate_type: type,
    content: { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
    page_settings: { paperSize: 'A4' as const, orientation: 'portrait' as const, margins: { top: 20, bottom: 20, left: 20, right: 20 } },
    cover_blocks: [],
    results_blocks: [],
    version,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DatabaseTemplateSource', () => {
  let source: ReturnType<typeof createDatabaseTemplateSource>

  beforeEach(() => {
    jest.clearAllMocks()
    clearConfigCache()
    source = createDatabaseTemplateSource()
  })

  describe('getTemplateConfig', () => {
    it('should return rich text config when database has template with content', async () => {
      const record = createMockRichTextTemplate('fc', 2)
      mockGetActiveRichTextTemplate.mockResolvedValue(record)

      const result = await source.getTemplateConfig('fc')

      expect(result.version).toBe(2)
      expect(result.source).toBe('database')
      expect((result.config as any).isRichText).toBe(true)
      expect((result.config as any).richTextContent).toEqual(record.content)
    })

    it('should fall back to registry when no rich text template exists', async () => {
      const config = createMockTemplateConfig('standar')
      mockGetActiveRichTextTemplate.mockResolvedValue(null)
      mockRegistryGet.mockReturnValue(config)

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await source.getTemplateConfig('standar')

      expect(result.config).toEqual(config)
      expect(result.version).toBeNull()
      expect(result.source).toBe('registry')
      expect(mockRegistryGet).toHaveBeenCalledWith('standar')

      warnSpy.mockRestore()
    })

    it('should fall back to registry when database throws an error', async () => {
      const config = createMockTemplateConfig('fc')
      mockGetActiveRichTextTemplate.mockRejectedValue(new Error('Connection refused'))
      mockRegistryGet.mockReturnValue(config)

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await source.getTemplateConfig('fc')

      expect(result.config).toEqual(config)
      expect(result.version).toBeNull()
      expect(result.source).toBe('registry')

      warnSpy.mockRestore()
    })

    it('should cache the result after database lookup', async () => {
      const record = createMockRichTextTemplate('fc', 2)
      mockGetActiveRichTextTemplate.mockResolvedValue(record)

      await source.getTemplateConfig('fc')

      // Second call should hit cache
      const result2 = await source.getTemplateConfig('fc')
      expect(result2.source).toBe('cache')
      expect(mockGetActiveRichTextTemplate).toHaveBeenCalledTimes(1)
    })

    it('should fetch specific version when templateVersion is provided', async () => {
      const record = createMockRichTextTemplate('lc', 5)
      mockGetRichTextTemplateByVersion.mockResolvedValue(record)

      const result = await source.getTemplateConfig('lc', 5)

      expect(result.version).toBe(5)
      expect(result.source).toBe('database')
      expect(mockGetRichTextTemplateByVersion).toHaveBeenCalledWith('lc', 5)
    })

    it('should fall back to active when specific version not found', async () => {
      const activeRecord = createMockRichTextTemplate('fc', 3)
      mockGetRichTextTemplateByVersion.mockResolvedValue(null)
      mockGetActiveRichTextTemplate.mockResolvedValue(activeRecord)

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await source.getTemplateConfig('fc', 99)

      expect(result.version).toBe(3)
      expect(result.source).toBe('database')

      warnSpy.mockRestore()
    })
  })

  describe('getRichTextPdfHtml', () => {
    it('should return null when template only has TipTap content (TipTap removed)', async () => {
      const record = createMockRichTextTemplate('fc', 1)
      mockGetActiveRichTextTemplate.mockResolvedValue(record)

      const sampleData = {
        instrument: { nama_alat: 'Test', merk: '', tipe: '', no_seri: '', kapasitas: '', resolusi: '' },
        calibration: { nomor_sertifikat: '', tanggal_kalibrasi: '', tanggal_terbit: '', metode_kalibrasi: '', suhu: '', kelembaban: '', tempat_kalibrasi: '' },
        station: { nama_stasiun: '', alamat_stasiun: '' },
        personnel: { nama_penandatangan: '', nip_penandatangan: '', jabatan_penandatangan: '', nama_teknisi: '', nip_teknisi: '' },
        results: [],
      }

      const html = await source.getRichTextPdfHtml('fc', sampleData)

      // TipTap content is no longer rendered — returns null
      expect(html).toBeNull()
    })

    it('should return null when no rich text template exists', async () => {
      mockGetActiveRichTextTemplate.mockResolvedValue(null)

      const sampleData = {
        instrument: { nama_alat: 'Test', merk: '', tipe: '', no_seri: '', kapasitas: '', resolusi: '' },
        calibration: { nomor_sertifikat: '', tanggal_kalibrasi: '', tanggal_terbit: '', metode_kalibrasi: '', suhu: '', kelembaban: '', tempat_kalibrasi: '' },
        station: { nama_stasiun: '', alamat_stasiun: '' },
        personnel: { nama_penandatangan: '', nip_penandatangan: '', jabatan_penandatangan: '', nama_teknisi: '', nip_teknisi: '' },
        results: [],
      }

      const html = await source.getRichTextPdfHtml('fc', sampleData)

      expect(html).toBeNull()
    })

    it('should return null when generation fails', async () => {
      mockGetActiveRichTextTemplate.mockRejectedValue(new Error('DB error'))

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const sampleData = {
        instrument: { nama_alat: 'Test', merk: '', tipe: '', no_seri: '', kapasitas: '', resolusi: '' },
        calibration: { nomor_sertifikat: '', tanggal_kalibrasi: '', tanggal_terbit: '', metode_kalibrasi: '', suhu: '', kelembaban: '', tempat_kalibrasi: '' },
        station: { nama_stasiun: '', alamat_stasiun: '' },
        personnel: { nama_penandatangan: '', nip_penandatangan: '', jabatan_penandatangan: '', nama_teknisi: '', nip_teknisi: '' },
        results: [],
      }

      const html = await source.getRichTextPdfHtml('fc', sampleData)

      expect(html).toBeNull()

      warnSpy.mockRestore()
    })
  })
})
