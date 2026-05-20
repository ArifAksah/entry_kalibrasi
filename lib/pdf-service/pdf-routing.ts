/**
 * PDF Routing Logic
 *
 * Determines which PDF generation method to use for each section
 * of a certificate template based on the template record fields.
 *
 * Routing rules:
 * - If `cover_template_path` is a non-empty string → use 'python_service'
 * - Else if `cover_html` is non-null → use 'playwright'
 * - Else → null (no method available)
 * - Same logic for results section
 *
 * @see Requirements 6.4, 6.5, 6.7, 8.7
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PdfMethod = 'python_service' | 'playwright' | null

export interface PdfMethodDecision {
  cover: PdfMethod
  results: PdfMethod
}

export interface TemplateRecord {
  cover_template_path?: string | null
  results_template_path?: string | null
  cover_html?: string | null
  results_html?: string | null
}

// ─── Internal Logic ──────────────────────────────────────────────────────────

/**
 * Determines the PDF generation method for a single section.
 *
 * @param templatePath - The .docx template path (e.g. "tmpl-abc/cover.docx")
 * @param html - The HTML content for Playwright rendering (fallback)
 * @returns 'python_service', 'playwright', or null
 */
function determineSectionMethod(
  templatePath: string | null | undefined,
  html: string | null | undefined
): PdfMethod {
  // If template_path is a non-empty string → use python_service
  if (typeof templatePath === 'string' && templatePath.trim().length > 0) {
    return 'python_service'
  }

  // If html is non-null → use playwright (fallback)
  if (html != null) {
    return 'playwright'
  }

  // Neither is available
  return null
}

// ─── Exported Function ───────────────────────────────────────────────────────

/**
 * Determines the PDF generation method for both cover and results sections
 * of a certificate template.
 *
 * @param template - The template record with path and HTML fields
 * @returns Object with cover and results methods
 * @throws Error if neither method is available for a required section
 *
 * @example
 * ```ts
 * const decision = determinePdfMethod({
 *   cover_template_path: 'tmpl-abc/cover.docx',
 *   results_template_path: null,
 *   cover_html: null,
 *   results_html: '<html>...</html>',
 * })
 * // decision.cover === 'python_service'
 * // decision.results === 'playwright'
 * ```
 */
export function determinePdfMethod(template: TemplateRecord): PdfMethodDecision {
  return {
    cover: determineSectionMethod(template.cover_template_path, template.cover_html),
    results: determineSectionMethod(template.results_template_path, template.results_html),
  }
}
