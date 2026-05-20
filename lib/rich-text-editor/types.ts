/**
 * TypeScript interfaces and types for the Rich Text Template Editor.
 */

// --- TipTap Document Structure ---

/**
 * TipTap JSON document format.
 * Root node is always type "doc" with content array.
 */
export interface TipTapDocument {
  type: 'doc'
  content: TipTapNode[]
}

export interface TipTapNode {
  type: string
  attrs?: Record<string, any>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

export interface TipTapMark {
  type: string
  attrs?: Record<string, any>
}

// --- Page Settings ---

export interface PageSettings {
  paperSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  margins: {
    top: number    // in mm
    bottom: number // in mm
    left: number   // in mm
    right: number  // in mm
  }
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, bottom: 20, left: 20, right: 20 },
}

// --- Variable Definitions ---

export interface VariableDefinition {
  name: string
  category: 'instrument' | 'calibration' | 'station' | 'personnel' | 'results' | 'system'
  description: string
  dataKey: string // Key path in certificate data object
}

// --- Certificate Data ---

export interface CertificateData {
  instrument: {
    nama_alat: string
    merk: string
    tipe: string
    no_seri: string
    kapasitas: string
    resolusi: string
  }
  calibration: {
    nomor_sertifikat: string
    tanggal_kalibrasi: string
    tanggal_terbit: string
    metode_kalibrasi: string
    suhu: string
    kelembaban: string
    tempat_kalibrasi: string
  }
  station: {
    nama_stasiun: string
    alamat_stasiun: string
  }
  personnel: {
    nama_penandatangan: string
    nip_penandatangan: string
    jabatan_penandatangan: string
    nama_teknisi: string
    nip_teknisi: string
  }
  results: Array<{
    no_urut: number
    titik_ukur: string
    pembacaan: string
    koreksi: string
    ketidakpastian: string
  }>
  system?: {
    qr_code: string          // Base64 QR code image as <img> tag
    verification_url: string // URL for certificate verification
  }
}

// --- Loop Node Attributes ---

export interface LoopNodeAttributes {
  collection: string     // e.g., "hasil_kalibrasi"
  type: 'start' | 'end' // Opening or closing marker
}

// --- Template Record ---

export interface RichTextTemplateRecord {
  id: string
  name: string
  certificate_type: string
  content: TipTapDocument | null
  page_settings: PageSettings | null
  cover_blocks: any[] // Legacy: kept for backward compat
  results_blocks: any[] // Legacy: kept for backward compat
  cover_html: string | null      // HTML from cover page Word file
  results_html: string | null    // HTML from results page Word file
  end_html: string | null        // HTML from end page Word file
  repeating_header: string | null  // HTML for repeating header on every PDF page
  repeating_footer: string | null  // HTML for repeating footer on every PDF page
  cover_template_path: string | null   // Path to .docx template on Python service (cover)
  results_template_path: string | null // Path to .docx template on Python service (results)
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Word Template Record (alias for clarity) ---

export interface WordTemplateRecord {
  id: string
  name: string
  certificate_type: string
  cover_html: string | null      // HTML from cover page Word file
  results_html: string | null    // HTML from results page Word file
  end_html: string | null        // HTML from end page Word file
  repeating_header: string | null  // HTML for repeating header on every PDF page
  repeating_footer: string | null  // HTML for repeating footer on every PDF page
  content: TipTapDocument | null // Keep for backward compat with rich text editor
  page_settings: PageSettings | null
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Word PDF Render Data ---

/**
 * Complete render data for Word-based PDF generation.
 * Includes body HTML plus optional Playwright header/footer templates.
 */
export interface WordPdfRenderData {
  bodyHtml: string                 // Main content HTML (full page with CSS)
  headerTemplate: string | null    // Playwright headerTemplate HTML
  footerTemplate: string | null    // Playwright footerTemplate HTML
  displayHeaderFooter: boolean     // Whether to show header/footer
}
