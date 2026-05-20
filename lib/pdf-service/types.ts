/**
 * Core types and interfaces for the Flexible Certificate PDF Service.
 *
 * This module defines all TypeScript interfaces used across the PDF service:
 * template configuration, rendering options, and service results.
 */

// ─── Certificate Type ────────────────────────────────────────────────────────

/**
 * Union type representing all 13 valid certificate types.
 * - 'fc' / 'lc': Field Calibration / Lab Calibration (BMKG pusat)
 * - 'fc_balai_N' / 'lc_balai_N': Balai variants (N = 1–5)
 * - 'standar': Standard calibration certificate
 */
export type CertificateType =
  | 'fc'
  | 'lc'
  | 'fc_balai_1'
  | 'fc_balai_2'
  | 'fc_balai_3'
  | 'fc_balai_4'
  | 'fc_balai_5'
  | 'lc_balai_1'
  | 'lc_balai_2'
  | 'lc_balai_3'
  | 'lc_balai_4'
  | 'lc_balai_5'
  | 'standar'

/**
 * Input data used to determine the CertificateType.
 * Fields come from the certificate database record.
 */
export interface CertificateTypeInput {
  calibration_place?: 'FC' | 'LC' | null
  calibration_kind?: 'FC' | 'LC' | null
  balai_id?: number | null
  is_standard?: boolean | null
  certificate_type?: 'sert' | 's_ket' | null
}

// ─── Template Configuration ──────────────────────────────────────────────────

/**
 * Complete declarative configuration for a certificate template.
 * Each certificate type has exactly one TemplateConfig that defines
 * all visual and structural elements.
 */
export interface TemplateConfig {
  type: CertificateType
  header: HeaderConfig
  coverPage: CoverPageConfig
  resultsPage: ResultsPageConfig
  footer: FooterConfig
  styling: StylingConfig
}

/**
 * Header (kop surat) configuration.
 * Defines agency name, lab name, logo, and optional Balai/accreditation info.
 */
export interface HeaderConfig {
  agencyName: string
  labName: string
  logoPath: string
  accreditationNumber?: string
  accreditationBody?: string
  accreditationScope?: string
  balaiName?: string
  balaiAddress?: string
  balaiLogoPath?: string
}

/**
 * Cover page layout configuration.
 * Defines titles, sections, and which optional elements to display.
 */
export interface CoverPageConfig {
  titleId: string
  titleEn: string
  showAccreditation: boolean
  showTraceability: boolean
  showValidityDates: boolean
  sections: CoverSection[]
}

/**
 * A section within the cover page (e.g., instrument details, owner identification).
 */
export interface CoverSection {
  id: string
  headingId: string
  headingEn: string
  fields: CoverField[]
}

/**
 * A single field within a cover section, rendered as a label-value row.
 */
export interface CoverField {
  labelId: string
  labelEn: string
  dataKey: string
  widthLabel?: string
  widthValue?: string
}

/**
 * Results page layout configuration.
 * Controls repeating headers/footers, uncertainty display, and pagination.
 */
export interface ResultsPageConfig {
  headerRepeat: boolean
  footerRepeat: boolean
  showUncertainty: boolean
  oneSensorPerPage: boolean
}

/**
 * Footer configuration for the certificate.
 */
export interface FooterConfig {
  formCode: string
  showQRCode: boolean
  qrPosition: 'bottom-left' | 'bottom-right'
  officeAddress: string
  signatureNote: string
}

/**
 * Styling configuration applied to the entire certificate.
 */
export interface StylingConfig {
  fontFamily: string
  baseFontSize: string
  headerBorderStyle: 'double' | 'single' | 'none'
  pageMargin: string
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Result returned after successfully rendering a certificate to PDF.
 */
export interface RenderResult {
  pdfBuffer: Buffer
  metadata: {
    fileSize: number
    fileName: string
    certificateType: CertificateType
  }
}

/**
 * Options for the template renderer.
 */
export interface RenderOptions {
  simulateSigned?: boolean
  timeoutMs?: number
  publicBaseUrl?: string
}

// ─── Service Results ─────────────────────────────────────────────────────────

/**
 * Result returned by the PDF Service facade on success or failure.
 * Maintains backward compatibility with the existing generateAndSaveCertificatePDF return type.
 */
export interface PdfServiceResult {
  success: boolean
  pdfPath?: string
  error?: string
  signed?: boolean
}

/**
 * Structured error returned when PDF generation fails.
 * Includes stage information for debugging and the certificate type being processed.
 */
export interface PdfServiceError {
  success: false
  error: string
  code?: string
  stage?:
    | 'type_determination'
    | 'template_lookup'
    | 'rendering'
    | 'pdf_generation'
    | 'signing'
    | 'storage'
  certificateType?: string
  details?: Record<string, any>
}
