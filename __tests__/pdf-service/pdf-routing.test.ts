/**
 * Unit tests for the PDF Routing Logic module.
 *
 * Tests the determinePdfMethod function that decides whether to use
 * the Python PDF Template Service or Playwright for each section.
 *
 * @see Requirements 6.4, 6.5, 6.7, 8.7
 */

import {
  determinePdfMethod,
  type PdfMethod,
  type PdfMethodDecision,
  type TemplateRecord,
} from '../../lib/pdf-service/pdf-routing'

describe('determinePdfMethod', () => {
  // ─── Cover section routing ─────────────────────────────────────────────────

  describe('cover section', () => {
    it('should return python_service when cover_template_path is non-empty', () => {
      const result = determinePdfMethod({
        cover_template_path: 'tmpl-abc/cover.docx',
        cover_html: null,
      })
      expect(result.cover).toBe('python_service')
    })

    it('should return python_service even when cover_html is also present', () => {
      const result = determinePdfMethod({
        cover_template_path: 'tmpl-abc/cover.docx',
        cover_html: '<html>...</html>',
      })
      expect(result.cover).toBe('python_service')
    })

    it('should return playwright when cover_template_path is null and cover_html is non-null', () => {
      const result = determinePdfMethod({
        cover_template_path: null,
        cover_html: '<html>...</html>',
      })
      expect(result.cover).toBe('playwright')
    })

    it('should return playwright when cover_template_path is empty string and cover_html is non-null', () => {
      const result = determinePdfMethod({
        cover_template_path: '',
        cover_html: '<html>...</html>',
      })
      expect(result.cover).toBe('playwright')
    })

    it('should return playwright when cover_template_path is whitespace-only and cover_html is non-null', () => {
      const result = determinePdfMethod({
        cover_template_path: '   ',
        cover_html: '<html>...</html>',
      })
      expect(result.cover).toBe('playwright')
    })

    it('should return null when both cover_template_path and cover_html are null', () => {
      const result = determinePdfMethod({
        cover_template_path: null,
        cover_html: null,
      })
      expect(result.cover).toBeNull()
    })

    it('should return null when cover_template_path is undefined and cover_html is undefined', () => {
      const result = determinePdfMethod({})
      expect(result.cover).toBeNull()
    })
  })

  // ─── Results section routing ───────────────────────────────────────────────

  describe('results section', () => {
    it('should return python_service when results_template_path is non-empty', () => {
      const result = determinePdfMethod({
        results_template_path: 'tmpl-abc/results.docx',
        results_html: null,
      })
      expect(result.results).toBe('python_service')
    })

    it('should return playwright when results_template_path is null and results_html is non-null', () => {
      const result = determinePdfMethod({
        results_template_path: null,
        results_html: '<html>results</html>',
      })
      expect(result.results).toBe('playwright')
    })

    it('should return null when both results_template_path and results_html are null', () => {
      const result = determinePdfMethod({
        results_template_path: null,
        results_html: null,
      })
      expect(result.results).toBeNull()
    })
  })

  // ─── Combined routing ─────────────────────────────────────────────────────

  describe('combined cover + results', () => {
    it('should route cover to python_service and results to playwright', () => {
      const result = determinePdfMethod({
        cover_template_path: 'tmpl-abc/cover.docx',
        results_template_path: null,
        cover_html: null,
        results_html: '<html>results</html>',
      })
      expect(result.cover).toBe('python_service')
      expect(result.results).toBe('playwright')
    })

    it('should route both to python_service when both paths are set', () => {
      const result = determinePdfMethod({
        cover_template_path: 'tmpl-abc/cover.docx',
        results_template_path: 'tmpl-abc/results.docx',
        cover_html: null,
        results_html: null,
      })
      expect(result.cover).toBe('python_service')
      expect(result.results).toBe('python_service')
    })

    it('should route both to playwright when only HTML is available', () => {
      const result = determinePdfMethod({
        cover_template_path: null,
        results_template_path: null,
        cover_html: '<html>cover</html>',
        results_html: '<html>results</html>',
      })
      expect(result.cover).toBe('playwright')
      expect(result.results).toBe('playwright')
    })

    it('should return null for both when nothing is available', () => {
      const result = determinePdfMethod({
        cover_template_path: null,
        results_template_path: null,
        cover_html: null,
        results_html: null,
      })
      expect(result.cover).toBeNull()
      expect(result.results).toBeNull()
    })
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle cover_html as empty string (non-null) → playwright', () => {
      const result = determinePdfMethod({
        cover_template_path: null,
        cover_html: '',
      })
      // Empty string is non-null, so playwright is used
      expect(result.cover).toBe('playwright')
    })

    it('should prioritize template_path over html', () => {
      const result = determinePdfMethod({
        cover_template_path: 'path.docx',
        cover_html: '<html>fallback</html>',
        results_template_path: 'results.docx',
        results_html: '<html>fallback</html>',
      })
      expect(result.cover).toBe('python_service')
      expect(result.results).toBe('python_service')
    })
  })
})
