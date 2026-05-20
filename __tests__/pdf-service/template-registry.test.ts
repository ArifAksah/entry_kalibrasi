/**
 * Unit tests for the TemplateRegistry class.
 * Validates registration, lookup, validation, and isolation behavior.
 */

import { createTemplateRegistry, defaultRegistry } from '@/lib/pdf-service/template-registry'
import type { TemplateConfig, CertificateType } from '@/lib/pdf-service/types'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createValidConfig(type: CertificateType = 'fc'): TemplateConfig {
  return {
    type,
    header: {
      agencyName: 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA',
      labName: 'LABORATORIUM KALIBRASI BMKG',
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
      officeAddress: 'Jl. Angkasa I No. 2, Jakarta',
      signatureNote: 'Dokumen ini ditandatangani secara elektronik',
    },
    styling: {
      fontFamily: 'Times New Roman',
      baseFontSize: '11pt',
      headerBorderStyle: 'double',
      pageMargin: '5mm',
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TemplateRegistry', () => {
  describe('register()', () => {
    it('should register a valid template config', () => {
      const registry = createTemplateRegistry()
      const config = createValidConfig('fc')

      expect(() => registry.register('fc', config)).not.toThrow()
      expect(registry.has('fc')).toBe(true)
    })

    it('should throw error listing ALL missing fields when config is incomplete', () => {
      const registry = createTemplateRegistry()
      const incompleteConfig = {
        type: 'fc' as CertificateType,
        header: {
          agencyName: 'Test',
          labName: 'Test',
          logoPath: '/test.png',
        },
        // missing: coverPage, resultsPage, footer, styling
      } as unknown as TemplateConfig

      expect(() => registry.register('fc', incompleteConfig)).toThrow(
        /missing required fields.*coverPage.*resultsPage.*footer.*styling/
      )
    })

    it('should throw error when a single field is missing', () => {
      const registry = createTemplateRegistry()
      const config = createValidConfig('fc')
      // Remove just the footer
      ;(config as any).footer = undefined

      expect(() => registry.register('fc', config)).toThrow(/missing required fields.*footer/)
    })

    it('should throw error when type is already registered', () => {
      const registry = createTemplateRegistry()
      const config = createValidConfig('fc')

      registry.register('fc', config)

      expect(() => registry.register('fc', config)).toThrow(
        /Template type "fc" is already registered/
      )
    })

    it('should store a deep copy (modifying original does not affect registry)', () => {
      const registry = createTemplateRegistry()
      const config = createValidConfig('fc')

      registry.register('fc', config)

      // Mutate the original config
      config.header.agencyName = 'MUTATED'

      // Registry should still have the original value
      const retrieved = registry.get('fc')
      expect(retrieved.header.agencyName).toBe(
        'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA'
      )
    })
  })

  describe('get()', () => {
    it('should return the config for a registered type', () => {
      const registry = createTemplateRegistry()
      const config = createValidConfig('lc')

      registry.register('lc', config)

      const result = registry.get('lc')
      expect(result.type).toBe('lc')
      expect(result.header.agencyName).toBe(
        'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA'
      )
    })

    it('should throw error with type name and available types when type not found', () => {
      const registry = createTemplateRegistry()
      registry.register('fc', createValidConfig('fc'))
      registry.register('lc', createValidConfig('lc'))

      expect(() => registry.get('standar')).toThrow(
        /Template type "standar" is not registered.*Available types:.*fc.*lc/
      )
    })

    it('should throw error with "(none)" when no types are registered', () => {
      const registry = createTemplateRegistry()

      expect(() => registry.get('fc')).toThrow(
        /Template type "fc" is not registered.*Available types: \(none\)/
      )
    })

    it('should return a deep copy (modifying returned value does not affect registry)', () => {
      const registry = createTemplateRegistry()
      registry.register('fc', createValidConfig('fc'))

      const result = registry.get('fc')
      result.header.agencyName = 'MUTATED'

      // Getting again should return the original
      const result2 = registry.get('fc')
      expect(result2.header.agencyName).toBe(
        'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA'
      )
    })
  })

  describe('has()', () => {
    it('should return true for registered types', () => {
      const registry = createTemplateRegistry()
      registry.register('fc', createValidConfig('fc'))

      expect(registry.has('fc')).toBe(true)
    })

    it('should return false for unregistered types', () => {
      const registry = createTemplateRegistry()

      expect(registry.has('fc')).toBe(false)
    })
  })

  describe('listTypes()', () => {
    it('should return empty array when no types registered', () => {
      const registry = createTemplateRegistry()

      expect(registry.listTypes()).toEqual([])
    })

    it('should return all registered types', () => {
      const registry = createTemplateRegistry()
      registry.register('fc', createValidConfig('fc'))
      registry.register('lc', createValidConfig('lc'))
      registry.register('standar', createValidConfig('standar'))

      const types = registry.listTypes()
      expect(types).toHaveLength(3)
      expect(types).toContain('fc')
      expect(types).toContain('lc')
      expect(types).toContain('standar')
    })
  })

  describe('defaultRegistry', () => {
    it('should be an empty registry initially', () => {
      // The defaultRegistry is empty until templates/index.ts registers them
      expect(defaultRegistry.listTypes()).toEqual([])
    })
  })

  describe('createTemplateRegistry()', () => {
    it('should create independent registry instances', () => {
      const registry1 = createTemplateRegistry()
      const registry2 = createTemplateRegistry()

      registry1.register('fc', createValidConfig('fc'))

      expect(registry1.has('fc')).toBe(true)
      expect(registry2.has('fc')).toBe(false)
    })
  })
})
