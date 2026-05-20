/**
 * PDF Generation via Python PDF Template Service
 *
 * Integration point that ties together:
 * - Routing logic (shouldUsePdfTemplateService)
 * - Data mapping (mapCertificateToTemplateData)
 * - PDF rendering (renderPdfViaTemplateService)
 * - Storage upload (uploadPdfToStorage)
 * - Fallback to existing Playwright-based generation
 *
 * @see Requirements 8.1, 8.4, 8.5, 8.6
 */

import { createClient } from '@supabase/supabase-js'

import {
  shouldUsePdfTemplateService,
  renderPdfViaTemplateService,
} from './pdf-template-client'
import { mapCertificateToTemplateData } from './certificate-data-mapper'
import { uploadPdfToStorage } from '../certificate-pdf-storage'
import { generateAndSaveCertificatePDF } from './index'

// ─── Supabase Admin Client ───────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Result Type ─────────────────────────────────────────────────────────────

export interface TemplateServiceResult {
  success: boolean
  pdfPath?: string
  error?: string
}

// ─── Helper: Build PDF filename ──────────────────────────────────────────────

/**
 * Builds the PDF filename following the existing pattern:
 * `certificate_{safe_number}_{certificateId}.pdf`
 *
 * The safe_number is derived from the certificate's number field,
 * with special characters replaced by underscores.
 */
function buildPdfFileName(certificateId: number, certificate: any): string {
  const certNumber = certificate?.certificate_number || certificate?.no_certificate || ''
  const safeNumber = certNumber
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return `certificate_${safeNumber}_${certificateId}.pdf`
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Generates a PDF via the Python PDF Template Service.
 *
 * 1. Maps certificate data to template variables
 * 2. Calls renderPdfViaTemplateService to get PDF buffer
 * 3. Uploads PDF to Supabase Storage
 * 4. Updates the pdf_path column on the certificate table
 *
 * @param certificateId - The certificate database ID
 * @param certificate - The certificate record (with nested relations)
 * @param template - The template record (must have cover_template_path)
 * @returns Result with success status and pdfPath or error message
 */
export async function generatePdfViaTemplateService(
  certificateId: number,
  certificate: any,
  template: any
): Promise<TemplateServiceResult> {
  try {
    // Step 1: Map certificate data to template variables
    const templateData = mapCertificateToTemplateData(certificate)

    // Step 2: Render PDF via the Python service
    const pdfBuffer = await renderPdfViaTemplateService(template.id, templateData)

    // Step 3: Upload to Supabase Storage
    const fileName = buildPdfFileName(certificateId, certificate)
    const pdfPath = await uploadPdfToStorage(supabaseAdmin as any, pdfBuffer, fileName)

    // Step 4: Update certificate record with the new pdf_path
    const { error: updateError } = await supabaseAdmin
      .from('certificate')
      .update({
        pdf_path: pdfPath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', certificateId)

    if (updateError) {
      console.error(
        `[PDF Template Service] Failed to update certificate ${certificateId} pdf_path:`,
        updateError.message
      )
      return { success: false, error: `Gagal update database: ${updateError.message}` }
    }

    console.log(
      `[PDF Template Service] ✅ PDF generated via template service for certificate ${certificateId}: ${pdfPath}`
    )
    return { success: true, pdfPath }
  } catch (error: any) {
    // Handle timeout/connection refused errors
    if (
      error.message?.includes('Service PDF tidak tersedia') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('fetch failed')
    ) {
      console.error(
        `[PDF Template Service] Service unavailable for certificate ${certificateId}:`,
        error.message
      )
      return { success: false, error: 'Service PDF tidak tersedia, coba lagi nanti' }
    }

    // Handle 4xx/5xx errors from the service
    if (error.message?.includes('PDF Template Service error')) {
      console.error(
        `[PDF Template Service] Render error for certificate ${certificateId}:`,
        error.message
      )
      return { success: false, error: `Gagal render PDF: ${error.message}` }
    }

    // Unexpected errors
    console.error(
      `[PDF Template Service] Unexpected error for certificate ${certificateId}:`,
      error.message || error
    )
    return { success: false, error: error.message || 'Unknown error' }
  }
}

// ─── Wrapper with Fallback ───────────────────────────────────────────────────

/**
 * Generates a certificate PDF with automatic routing:
 * - If template has cover_template_path → uses Python PDF Template Service
 * - Otherwise → falls back to existing Playwright-based generation
 *
 * @param certificateId - The certificate database ID
 * @param certificate - The certificate record (with nested relations)
 * @param template - The template record
 * @param userId - Optional user ID for BSrE signing (fallback path)
 * @param passphrase - Optional passphrase for BSrE signing (fallback path)
 * @param simulateSigned - If true, simulate signed appearance (fallback path)
 * @returns Result with success status and pdfPath or error message
 */
export async function generateCertificatePdfWithFallback(
  certificateId: number,
  certificate: any,
  template: any,
  userId?: string,
  passphrase?: string,
  simulateSigned?: boolean
): Promise<TemplateServiceResult> {
  // Route to Python PDF Template Service if template has docx path
  if (shouldUsePdfTemplateService(template)) {
    return generatePdfViaTemplateService(certificateId, certificate, template)
  }

  // Fallback to existing Playwright-based generation
  const result = await generateAndSaveCertificatePDF(
    certificateId,
    userId,
    passphrase,
    simulateSigned ?? false
  )

  return {
    success: result.success,
    pdfPath: result.pdfPath,
    error: result.error,
  }
}
