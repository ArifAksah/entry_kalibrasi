/**
 * Template Renderer for the Flexible Certificate PDF Service.
 *
 * Orchestrates Playwright headless Chromium to render a certificate PDF.
 * This module is responsible ONLY for rendering — it does NOT handle:
 * - BSrE signing (that's the facade's job)
 * - Storage upload (that's the facade's job)
 * - Fetching certificate data from DB (receives config as parameter)
 */

import type { CertificateType, RenderOptions, RenderResult, TemplateConfig } from './types'
import { createPdfRenderToken } from '../pdf-render-token'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Overall render timeout (ms) */
const DEFAULT_TIMEOUT_MS = 120_000
/** Navigation timeout (ms) */
const NAVIGATION_TIMEOUT_MS = 60_000
/** Content readiness timeout (ms) */
const CONTENT_READINESS_TIMEOUT_MS = 45_000
/** QR canvas render timeout (ms) */
const QR_RENDER_TIMEOUT_MS = 15_000

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TemplateRenderer {
  render(
    certificateId: number,
    config: TemplateConfig,
    options?: RenderOptions & { certificateNumber?: string }
  ): Promise<RenderResult>
}

// ─── Base URL Resolution ─────────────────────────────────────────────────────

/**
 * Resolves the base URL for Playwright navigation.
 * Priority:
 *   1. INTERNAL_APP_URL — server-internal URL (e.g. http://127.0.0.1:3000)
 *   2. NEXT_PUBLIC_SITE_URL — public site URL set in .env
 *   3. VERCEL_URL — auto-set by Vercel deployments (prefixed with https://)
 *   4. localhost:3000 — last-resort fallback (dev only)
 */
function getBaseUrlCandidates(): string[] {
  return [
    process.env.INTERNAL_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3000',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ''))
    .filter((value, index, arr) => arr.indexOf(value) === index)
}

// ─── CSS Overrides ───────────────────────────────────────────────────────────

/**
 * CSS overrides injected into the print page for consistent PDF rendering.
 * Matches the existing certificate-pdf-helper.ts CSS injection.
 */
const PDF_CSS_OVERRIDES = `
  /* Font fallback - hanya untuk elemen text, bukan semua elemen */
  body, p, span, div, td, th, h1, h2, h3, h4, h5, h6, button, input, label {
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
  }
  .page-container,
  .page-container table,
  .page-container td,
  .page-container th,
  .page-container p,
  .page-container div {
    font-size: 11pt !important;
    line-height: 1.25 !important;
    font-weight: 700 !important;
    color: #000 !important;
  }
  /* Sembunyikan no-print */
  .no-print { display: none !important; }
  .bg-gray-100 { background-color: white !important; }

  /* Reset list style global (sama dengan A4Style di print page) */
  * { list-style: none !important; list-style-type: none !important; list-style-position: outside !important; list-style-image: none !important; }
  ul, ol, li { list-style: none !important; padding-left: 0 !important; margin-left: 0 !important; text-indent: 0 !important; }
  *::marker { display: none !important; content: none !important; color: transparent !important; }

  /* Page container - sync dengan @media print di print/page.tsx */
  .page-container {
    margin: 0 !important;
    padding: 5mm !important;
    width: 210mm !important;
    max-width: 210mm !important;
    border: none !important;
    box-shadow: none !important;
    box-sizing: border-box !important;
    page-break-after: auto !important;
    break-after: auto !important;
  }

  .cert-title-id {
    font-size: 20pt !important;
    line-height: 1.15 !important;
    font-weight: 700 !important;
    letter-spacing: 0 !important;
    color: #000 !important;
  }

  .cert-title-en {
    font-size: 9pt !important;
    line-height: 1.05 !important;
    font-weight: 700 !important;
    font-style: italic !important;
    letter-spacing: 0.02em !important;
    color: #222 !important;
  }

  .cert-text-id,
  .cert-info-text,
  .cert-info-text td {
    font-size: 11pt !important;
    line-height: 1.25 !important;
    font-weight: 700 !important;
    color: #000 !important;
  }

  .cert-text-en,
  .page-container .italic {
    font-size: 9pt !important;
    line-height: 1.05 !important;
    font-weight: 700 !important;
    font-style: italic !important;
    letter-spacing: 0.01em !important;
    color: #222 !important;
  }

  /* ── Page-1 footer (cover page footer masking) ── */
  .page-1-footer {
    position: static !important;
    z-index: 1000 !important;
    flex: 0 0 auto !important;
    background-color: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
    list-style-type: none !important;
    list-style: none !important;
    list-style-position: outside !important;
  }
  .page-1-footer, .page-1-footer * {
    list-style: none !important; list-style-type: none !important; list-style-position: outside !important; list-style-image: none !important;
    background: transparent !important; background-image: none !important; outline: none !important; text-indent: 0 !important; padding-left: 0 !important; margin-left: 0 !important;
  }
  .page-1-footer { background-color: white !important; }
  .page-1-footer *::marker { display: none !important; content: none !important; color: transparent !important; }

  /* ── QR code footer halaman 2+ ── */
  .footer-qr-small { display: none !important; visibility: hidden !important; }
  .page-container.results-page .footer-qr-small.results-page-qr {
    position: absolute !important; bottom: 5mm !important; left: 5mm !important;
    width: 100px !important; height: 100px !important; z-index: 999 !important;
    display: block !important; visibility: visible !important; opacity: 1 !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .page-container:not(.results-page) .footer-qr-small, .page-container:not(.results-page) .results-page-qr {
    display: none !important; visibility: hidden !important; opacity: 0 !important;
  }

  /* ── PERBAIKAN UTAMA: tfoot harus table-footer-group, BUKAN position:absolute ── */
  tfoot.print-repeat-footer {
    display: table-footer-group !important;
    position: static !important;
    bottom: auto !important;
    left: auto !important;
    width: auto !important;
    background-color: white !important;
  }
  tfoot.print-repeat-footer > tr {
    display: table-row !important;
    position: static !important;
    width: auto !important;
  }
  tfoot.print-repeat-footer > tr > td {
    display: table-cell !important;
    position: static !important;
    width: auto !important;
  }

  /* Pastikan table utama mengisi tinggi halaman */
  table.repeatable-page-table {
    height: 100% !important;
    width: 100% !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
  }
  thead.print-repeat-header { display: table-header-group !important; }
  tbody.print-content { display: table-row-group !important; }

  /* Page container heights — margins uniform 5mm di semua sisi */
  .page-container.results-page {
    position: relative !important;
    min-height: 297mm !important;
    height: 297mm !important;
    width: 210mm !important;
    max-width: 210mm !important;
    padding: 5mm !important;
    box-sizing: border-box !important;
  }
  .page-container.cover-page {
    height: 297mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    width: 210mm !important;
    max-width: 210mm !important;
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
    padding: 5mm !important;
    overflow: hidden !important;
  }
  .cover-content { position: static !important; z-index: 10 !important; display: flex !important; flex-direction: column !important; justify-content: flex-start !important; padding-top: 0 !important; flex: 1 1 auto !important; min-height: 0 !important; }
  .cover-header { min-height: 25mm !important; padding-bottom: 3mm !important; align-items: center !important; margin-top: 0 !important; }
  .cover-logo-slot { width: 26mm !important; flex: 0 0 26mm !important; display: flex !important; justify-content: center !important; align-items: center !important; }
  .cover-logo-slot img { width: 22mm !important; height: auto !important; max-height: 24mm !important; object-fit: contain !important; }
  .cover-header-spacer { width: 26mm !important; flex: 0 0 26mm !important; }
  .cover-agency-title h1, .cover-agency-title h2 { font-size: 11.5pt !important; line-height: 1.28 !important; margin: 0 !important; }
  .cover-title-block { margin: 6mm 0 6mm !important; }
  .cover-title-block .cert-info-text { margin-top: 1.5mm !important; }

  /* Thead padding top handle */
  .page-container.results-page thead.print-repeat-header > tr > td { padding: 0 !important; }
  .page-container.results-page tbody.print-content > tr > td { padding-top: 3mm !important; vertical-align: top !important; }
  .results-header-table td { vertical-align: top !important; }
  .results-footer-shell { width: 100% !important; padding-top: 3mm !important; }
  .results-footer-grid { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
  .results-footer-grid td { padding: 0 !important; vertical-align: middle !important; color: #000 !important; font-size: 8.5pt !important; line-height: 1.18 !important; font-weight: 700 !important; }
  .results-footer-qr-cell { width: 22mm !important; text-align: left !important; }
  .results-footer-note-cell { width: auto !important; text-align: center !important; font-weight: 700 !important; padding: 0 4mm !important; vertical-align: middle !important; }
  .results-footer-meta-cell { width: 34mm !important; text-align: right !important; font-weight: 700 !important; white-space: nowrap !important; vertical-align: middle !important; padding-top: 0 !important; }
  .results-footer-qr-wrap { display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 0.8mm !important; }
  .results-footer-qr-box { width: 12mm !important; height: 12mm !important; flex: 0 0 12mm !important; }
  .results-footer-form-code { font-size: 7.5pt !important; line-height: 1 !important; font-weight: 700 !important; white-space: nowrap !important; }
  .results-footer-note-copy { max-width: 112mm !important; margin: 0 auto !important; text-align: center !important; font-size: 8.2pt !important; line-height: 1.18 !important; font-weight: 700 !important; }
  .results-footer-meta-cell, .results-footer-meta-cell * { font-size: 8.3pt !important; line-height: 1.15 !important; font-weight: 700 !important; }

  /* ── Avoid page break after last container ── */
  .page-container:last-of-type { page-break-after: avoid !important; break-after: avoid !important; }
`

// ─── Renderer Implementation ─────────────────────────────────────────────────

class TemplateRendererImpl implements TemplateRenderer {
  /**
   * Renders a certificate to PDF using Playwright headless Chromium.
   *
   * Steps:
   * 1. Launch Playwright headless Chromium
   * 2. Emulate print media BEFORE navigation (critical for correct CSS)
   * 3. Navigate to /certificates/{id}/print?pdf=true&type={certificateType}&render_token=...&render_ts=...
   * 4. Wait for content readiness (page-container, footer elements, data-printDataReady)
   * 5. Inject CSS overrides and JS style fixes
   * 6. Generate PDF (A4, 0mm margins, printBackground)
   * 7. Return RenderResult with buffer and metadata
   */
  async render(
    certificateId: number,
    config: TemplateConfig,
    options?: RenderOptions & { certificateNumber?: string }
  ): Promise<RenderResult> {
    const {
      simulateSigned = false,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      certificateNumber,
    } = options || {}

    const certificateType: CertificateType = config.type

    // Set up overall timeout
    const overallDeadline = Date.now() + timeoutMs

    // Dynamic import playwright
    let playwright: any
    try {
      playwright = await import('playwright')
    } catch (importError) {
      throw new Error(
        `[TemplateRenderer] Playwright not available: ${importError instanceof Error ? importError.message : String(importError)}`
      )
    }

    // Launch browser
    const browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--run-all-compositor-stages-before-draw',
        '--hide-scrollbars',
        '--mute-audio',
      ],
    })

    try {
      // Check overall timeout
      if (Date.now() >= overallDeadline) {
        throw new Error('[TemplateRenderer] Overall timeout exceeded before navigation')
      }

      const context = await browser.newContext({
        viewport: {
          width: 794, // A4 width in pixels at 96 DPI
          height: 1123, // A4 height in pixels at 96 DPI
        },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        extraHTTPHeaders: {
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      })

      // Abort Google Fonts to prevent hanging on external font load
      await context.route('**fonts.googleapis.com**', async (route: any) => {
        await route.abort()
      })
      await context.route('**fonts.gstatic.com**', async (route: any) => {
        await route.abort()
      })

      const page = await context.newPage()

      // ─── CRITICAL: emulateMedia('print') BEFORE navigation ───────────────
      // Without this, page renders with @media screen styles which breaks
      // tfoot.print-repeat-footer positioning
      await page.emulateMedia({ media: 'print' })

      // ─── Navigate to print page ─────────────────────────────────────────
      const baseUrlCandidates = getBaseUrlCandidates()
      const expectedPath = `/certificates/${certificateId}/print`
      const renderAuth = createPdfRenderToken(certificateId)

      let printResponse: any = null
      let lastPrintError = ''

      for (const candidateBaseUrl of baseUrlCandidates) {
        // Check overall timeout before each attempt
        if (Date.now() >= overallDeadline) {
          throw new Error('[TemplateRenderer] Overall timeout exceeded during navigation attempts')
        }

        let candidatePrintUrl =
          `${candidateBaseUrl}/certificates/${certificateId}/print` +
          `?pdf=true` +
          `&type=${encodeURIComponent(certificateType)}` +
          `&render_token=${encodeURIComponent(renderAuth.token)}` +
          `&render_ts=${encodeURIComponent(String(renderAuth.timestamp))}`

        if (simulateSigned) {
          candidatePrintUrl += '&signed=true'
        }

        console.log(`[TemplateRenderer] Navigating (print media): ${candidatePrintUrl}`)

        try {
          const response = await page.goto(candidatePrintUrl, {
            waitUntil: 'domcontentloaded',
            timeout: NAVIGATION_TIMEOUT_MS,
          })

          const candidateFinalUrl = page.url()
          const bodyPreview = await page.evaluate(
            () => document.body?.innerText?.slice(0, 500) || ''
          )

          if (!candidateFinalUrl.includes(expectedPath)) {
            lastPrintError = `PRINT_RENDER_FAILED: Print page did not open correctly. Final URL: ${candidateFinalUrl}. Preview: ${bodyPreview.substring(0, 180)}`
            console.error(
              `[TemplateRenderer] Unexpected final URL via ${candidateBaseUrl}: ${candidateFinalUrl}`
            )
            continue
          }

          if (response && !response.ok()) {
            lastPrintError = `PRINT_RENDER_FAILED: Print page returned HTTP ${response.status()}. Preview: ${bodyPreview.substring(0, 180)}`
            console.error(
              `[TemplateRenderer] Print page returned HTTP ${response.status()} via ${candidateBaseUrl}`
            )
            continue
          }

          printResponse = response
          console.log(`[TemplateRenderer] Print page loaded successfully via ${candidateBaseUrl}`)
          break
        } catch (navigationError: any) {
          lastPrintError = `PRINT_RENDER_FAILED: Failed to open print page via ${candidateBaseUrl}. ${navigationError?.message || 'Unknown navigation error'}`
          console.error(
            `[TemplateRenderer] Navigation failed via ${candidateBaseUrl}:`,
            navigationError
          )
        }
      }

      if (!printResponse) {
        throw new Error(
          lastPrintError ||
            'PRINT_RENDER_FAILED: No internal URL successfully opened the print page.'
        )
      }

      // ─── Wait for content readiness ──────────────────────────────────────

      // Wait for network idle (best effort)
      await page
        .waitForLoadState('networkidle', { timeout: 15000 })
        .catch(() => {
          console.log('[TemplateRenderer] networkidle timeout, continuing...')
        })

      // Wait for React render to complete
      const contentReady = await page
        .waitForFunction(
          () => {
            // Check if still loading
            const hasLoading = Array.from(document.querySelectorAll('*')).some(
              (el) =>
                el.textContent?.trim() ===
                'Memuat data sertifikat untuk dicetak...'
            )
            if (hasLoading) return false

            const urlParams = new URLSearchParams(window.location.search)
            if (
              urlParams.get('pdf') === 'true' &&
              document.body?.dataset.printDataReady !== 'true'
            )
              return false

            // Must have at least one .page-container
            if (!document.querySelector('.page-container')) return false

            // Page is ready if it has .page-1-footer (cover) OR .print-repeat-footer (results)
            const hasCoverFooter = !!document.querySelector('.page-1-footer')
            const hasResultsFooter =
              !!document.querySelector('.print-repeat-footer')
            if (!hasCoverFooter && !hasResultsFooter) return false

            return true
          },
          { timeout: CONTENT_READINESS_TIMEOUT_MS }
        )
        .then(() => true)
        .catch(() => {
          console.log('[TemplateRenderer] Content readiness timeout')
          return false
        })

      if (!contentReady) {
        const debugInfo = await page.evaluate(() => ({
          title: document.title || '',
          bodyPreview: document.body?.innerText?.slice(0, 500) || '',
          hasPageContainer: !!document.querySelector('.page-container'),
          hasCoverFooter: !!document.querySelector('.page-1-footer'),
          hasResultsFooter: !!document.querySelector('.print-repeat-footer'),
        }))
        throw new Error(
          `PRINT_RENDER_FAILED: Content not ready for rendering. ` +
            `hasPageContainer=${debugInfo.hasPageContainer}, ` +
            `hasCoverFooter=${debugInfo.hasCoverFooter}, ` +
            `hasResultsFooter=${debugInfo.hasResultsFooter}. ` +
            `Preview: ${debugInfo.bodyPreview.substring(0, 180)}`
        )
      }

      // ─── Stop all intervals & timeouts ───────────────────────────────────
      // Print page has polling intervals that prevent networkidle
      await page.evaluate(() => {
        try {
          const maxId = window.setTimeout(() => {}, 1)
          for (let i = 0; i <= maxId + 200; i++) {
            window.clearTimeout(i)
            window.clearInterval(i)
          }
        } catch {
          /* ignore */
        }
      })
      console.log('[TemplateRenderer] Intervals/timeouts cleared')

      // ─── Wait for QR canvas to render ────────────────────────────────────
      await page
        .waitForFunction(
          () => {
            const containers = document.querySelectorAll('.qr-code-container')
            if (containers.length === 0) return true
            return Array.from(containers).every((c) => {
              const cv = c.querySelector('canvas') as HTMLCanvasElement | null
              return cv && cv.width > 0 && cv.height > 0
            })
          },
          { timeout: QR_RENDER_TIMEOUT_MS }
        )
        .catch(() => {
          console.log('[TemplateRenderer] QR canvas timeout, continuing...')
        })

      // Extra wait for canvas to fully paint
      await page.waitForTimeout(2000)

      // ─── Inject CSS overrides ────────────────────────────────────────────
      console.log('[TemplateRenderer] Injecting print CSS overrides...')
      await page.addStyleTag({ content: PDF_CSS_OVERRIDES })

      // ─── Force-fix tfoot styles via JavaScript ───────────────────────────
      await page.evaluate(() => {
        document
          .querySelectorAll('tfoot.print-repeat-footer')
          .forEach((tfoot: Element) => {
            const el = tfoot as HTMLElement
            el.style.setProperty('display', 'table-footer-group', 'important')
            el.style.setProperty('position', 'static', 'important')
            el.style.setProperty('bottom', 'auto', 'important')
            el.style.setProperty('left', 'auto', 'important')
            el.style.setProperty('width', 'auto', 'important')
          })
        document
          .querySelectorAll('tfoot.print-repeat-footer > tr > td')
          .forEach((td: Element) => {
            const el = td as HTMLElement
            el.style.setProperty('display', 'table-cell', 'important')
            el.style.setProperty('position', 'static', 'important')
          })
        document
          .querySelectorAll('table.repeatable-page-table')
          .forEach((table: Element) => {
            const el = table as HTMLElement
            el.style.setProperty('height', '100%', 'important')
          })
      })
      console.log('[TemplateRenderer] JS style overrides applied')

      await page.waitForTimeout(500)

      // ─── Generate PDF ────────────────────────────────────────────────────
      // Check overall timeout before PDF generation
      if (Date.now() >= overallDeadline) {
        throw new Error('[TemplateRenderer] Overall timeout exceeded before PDF generation')
      }

      console.log('[TemplateRenderer] Generating PDF...')
      const pdf: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      })
      console.log(`[TemplateRenderer] PDF generated: ${pdf.length} bytes`)

      // ─── Build metadata ──────────────────────────────────────────────────
      const certNumber = certificateNumber || String(certificateId)
      const safeFileName = certNumber.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `certificate_${safeFileName}_${certificateId}.pdf`

      const result: RenderResult = {
        pdfBuffer: pdf,
        metadata: {
          fileSize: pdf.length,
          fileName,
          certificateType,
        },
      }

      return result
    } finally {
      // Always close browser
      await browser.close().catch((err: any) => {
        console.error('[TemplateRenderer] Error closing browser:', err)
      })
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a new TemplateRenderer instance.
 */
export function createTemplateRenderer(): TemplateRenderer {
  return new TemplateRendererImpl()
}
