/**
 * PDF Generation Router
 *
 * Determines whether to use the new Python PDF Template Service
 * or the existing Playwright-based HTML rendering for each section
 * of a certificate PDF.
 *
 * Routing logic:
 * - If `cover_template_path` is a non-empty string → use "python-service" for cover
 * - If `cover_template_path` is null/empty AND `cover_html` is non-null → use "playwright" (fallback)
 * - If neither is available → "none"
 * - Same logic applies for results section with `results_template_path` and `results_html`
 *
 * @see Requirements 6.4, 6.5, 6.7, 8.7
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The method used to generate a PDF section.
 * - 'python-service': Use the new Python PDF Template Service (docxtpl + LibreOffice)
 * - 'playwright': Use the existing Playwright HTML rendering (fallback)
 * - 'none': No generation method available for this section
 */
export type PdfGenerationMethod = 'python-service' | 'playwright' | 'none'

/**
 * The routing decision for both cover and results sections.
 */
export interface PdfRoutingDecision {
  cover: PdfGenerationMethod
  results: PdfGenerationMethod
}

/**
 * Input fields from a template record used to determine routing.
 * These correspond to columns in the certificate_templates table.
 */
export interface TemplateRoutingInput {
  cover_template_path?: string | null
  results_template_path?: string | null
  cover_html?: string | null
  results_html?: string | null
}

// ─── Routing Logic ───────────────────────────────────────────────────────────

/**
 * Determines the PDF generation method for a single section.
 *
 * @param templatePath - The .docx template path (e.g. "tmpl-abc/cover.docx")
 * @param html - The HTML content for Playwright rendering (fallback)
 * @returns The generation method to use
 */
function determineSectionMethod(
  templatePath: string | null | undefined,
  html: string | null | undefined
): PdfGenerationMethod {
  // If template_path is a non-empty string → use python-service
  if (templatePath && templatePath.trim().length > 0) {
    return 'python-service'
  }

  // If template_path is null/empty AND html is non-null → use playwright (fallback)
  if (html != null) {
    return 'playwright'
  }

  // Neither is available
  return 'none'
}

/**
 * Determines the PDF generation method for both cover and results sections
 * of a certificate template.
 *
 * @param template - The template record with path and HTML fields
 * @returns A routing decision indicating which service to use for each section
 *
 * @example
 * ```ts
 * const decision = determinePdfGenerationMethod({
 *   cover_template_path: 'tmpl-abc/cover.docx',
 *   results_template_path: null,
 *   cover_html: null,
 *   results_html: '<html>...</html>',
 * })
 * // decision.cover === 'python-service'
 * // decision.results === 'playwright'
 * ```
 */
export function determinePdfGenerationMethod(
  template: TemplateRoutingInput
): PdfRoutingDecision {
  return {
    cover: determineSectionMethod(template.cover_template_path, template.cover_html),
    results: determineSectionMethod(template.results_template_path, template.results_html),
  }
}
