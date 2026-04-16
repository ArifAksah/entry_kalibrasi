import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Generate PDF for certificate and save to local filesystem
 * This function will be called automatically when level 3 verification is approved
 * It uses Playwright to render the certificate print page and saves the PDF to e-certificate-signed folder
 * @param certificateId - The certificate ID to generate PDF for
 * @param userId - The user ID (authorized_by) to get NIK from personel table
 * @param passphrase - The passphrase for BSrE signing (from user input)
 */
export async function generateAndSaveCertificatePDF(certificateId: number, userId?: string, passphrase?: string, simulateSigned: boolean = false): Promise<{ success: boolean; pdfPath?: string; error?: string; signed?: boolean }> {
  try {
    // Get certificate info and authorized_by if userId not provided
    const { data: existingCert } = await supabaseAdmin
      .from('certificate')
      .select('pdf_path, no_certificate, authorized_by, public_id')
      .eq('id', certificateId)
      .single()

    // Get userId from certificate if not provided
    const authorizedByUserId = userId || existingCert?.authorized_by

    // PRE-CHECK: Fetch NIK early to fail fast if missing
    // This avoids expensive PDF generation if the user cannot sign anyway
    let nik: string | null = null
    if (authorizedByUserId) {
      try {
        const { data: personelData, error: personelError } = await supabaseAdmin
          .from('personel')
          .select('nik')
          .eq('id', authorizedByUserId)
          .single()

        if (!personelError && personelData?.nik) {
          nik = personelData.nik
          console.log(`[PDF Helper] Found NIK for user ${authorizedByUserId}`)
        } else {
          console.warn(`[PDF Helper] NIK not found for user ${authorizedByUserId}`)
        }
      } catch (nikError: any) {
        console.error(`[PDF Helper] Error fetching NIK:`, nikError)
      }
    }

    // Fail immediately if NIK is missing (unless we are just simulating or BSrE is disabled)
    const bsreUsername = process.env.BSRE_USERNAME
    const bsrePassword = process.env.BSRE_PASSWORD
    if (bsreUsername && bsrePassword && !nik) {
      console.error('[PDF Helper] NIK not available, cannot sign PDF. Aborting generation.')
      return { success: false, error: 'NIK_NOT_FOUND_IN_DB' }
    }

    // IMPORTANT: Only skip PDF regeneration if no passphrase is provided.
    // If passphrase IS provided, we must ALWAYS go through BSrE signing to validate it.
    // Skipping when passphrase exists would allow any passphrase (including wrong ones) to succeed.
    if (!passphrase && existingCert?.pdf_path) {
      // Check if file exists in local filesystem
      const localPath = path.join(process.cwd(), 'e-certificate-signed', path.basename(existingCert.pdf_path))
      if (fs.existsSync(localPath)) {
        console.log(`[PDF Helper] PDF already exists for certificate ${certificateId}: ${existingCert.pdf_path}`)
        return { success: true, pdfPath: existingCert.pdf_path }
      }
    }

    console.log(`[PDF Helper] Generating PDF for certificate ${certificateId}...`)

    // Dynamic import playwright
    let playwright: any
    try {
      playwright = await import('playwright')
    } catch (importError) {
      console.error('[PDF Helper] Playwright not available:', importError)
      return { success: false, error: 'Playwright not available for PDF generation' }
    }

    // Get base URL for Playwright to render the certificate page.
    // Priority:
    //   1. INTERNAL_APP_URL  - server-internal URL (e.g. http://127.0.0.1:3000), best for production
    //   2. NEXT_PUBLIC_SITE_URL - public site URL set in .env
    //   3. VERCEL_URL - auto-set by Vercel deployments
    //   4. localhost:3000  - last-resort fallback (dev only)
    let baseUrl = (
      process.env.INTERNAL_APP_URL
      || process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'
    ).replace(/\/$/, '')

    // Public URL for QR codes embedded in PDF (must be accessible from outside server)
    // Uses NEXT_PUBLIC_SITE_URL (public), falls back to baseUrl if not set
    const publicBaseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || baseUrl
    ).replace(/\/$/, '')

    console.log(`[PDF Helper] Internal baseUrl (Playwright): ${baseUrl}`)
    console.log(`[PDF Helper] Public baseUrl (QR codes): ${publicBaseUrl}`)

    let printUrl = `${baseUrl}/certificates/${certificateId}/print?pdf=true`
    if (simulateSigned) {
      printUrl += '&signed=true'
    }


    // Launch browser with Playwright
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
        '--mute-audio'
      ]
    })

    try {
      const context = await browser.newContext({
        viewport: {
          width: 794, // A4 width in pixels at 96 DPI
          height: 1123, // A4 height in pixels at 96 DPI
        },
        // Set locale agar format tanggal konsisten
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        // Izinkan load font dari Google Fonts (bypass CORS)
        extraHTTPHeaders: {
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      })

      // Abort Google Fonts agar tidak hang menunggu external font load
      await context.route('**fonts.googleapis.com**', async (route: any) => { await route.abort() })
      await context.route('**fonts.gstatic.com**', async (route: any) => { await route.abort() })

      const page = await context.newPage()

      // ─── FIX UTAMA: emulateMedia('print') SEBELUM page.goto() ────────────────
      // Tanpa ini, page render dengan @media screen:
      //   tfoot.print-repeat-footer { position: absolute; bottom: 24px } ← BERANTAKAN
      // Dengan ini, page render dengan @media print dari awal:
      //   tfoot.print-repeat-footer { display: table-footer-group } ← BENAR
      await page.emulateMedia({ media: 'print' })
      // ─────────────────────────────────────────────────────────────────────────

      console.log(`[PDF Helper] Navigating (print media): ${printUrl}`)
      await page.goto(printUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // Tunggu data API selesai dimuat (maks 15 detik)
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.log('[PDF Helper] networkidle timeout, continuing...')
      })

      // Tunggu React render selesai
      await page.waitForFunction(() => {
        // Cek apakah masih ada loading state
        const hasLoading = Array.from(document.querySelectorAll('*')).some(el =>
          el.textContent?.trim() === 'Memuat data sertifikat untuk dicetak...'
        )
        if (hasLoading) return false
        // Harus ada minimal satu .page-container
        if (!document.querySelector('.page-container')) return false
        // Halaman dianggap siap jika ada .page-1-footer (cover) ATAU .print-repeat-footer (results)
        const hasCoverFooter = !!document.querySelector('.page-1-footer')
        const hasResultsFooter = !!document.querySelector('.print-repeat-footer')
        if (!hasCoverFooter && !hasResultsFooter) return false
        return true
      }, { timeout: 30000 }).catch(() => {
        console.log('[PDF Helper] Content readiness timeout, continuing...')
      })

      // ─── STOP SEMUA INTERVAL & TIMEOUT ────────────────────────────────────────
      // Print page memiliki setInterval(checkVerificationStatus, 5000) yang
      // terus polling /api/verify-certificate. Ini menyebabkan:
      // 1. networkidle tidak pernah tercapai
      // 2. State bisa berubah saat PDF sedang di-generate
      await page.evaluate(() => {
        try {
          const maxId = window.setTimeout(() => {}, 1)
          for (let i = 0; i <= maxId + 200; i++) {
            window.clearTimeout(i)
            window.clearInterval(i)
          }
        } catch { /* ignore */ }
      })
      console.log('[PDF Helper] Intervals/timeouts cleared')

      // Tunggu QR canvas ter-render
      await page.waitForFunction(() => {
        const containers = document.querySelectorAll('.qr-code-container')
        if (containers.length === 0) return true
        return Array.from(containers).every(c => {
          const cv = c.querySelector('canvas') as HTMLCanvasElement | null
          return cv && cv.width > 0 && cv.height > 0
        })
      }, { timeout: 15000 }).catch(() => {
        console.log('[PDF Helper] QR canvas timeout, continuing...')
      })

      // Extra wait agar canvas fully painted
      await page.waitForTimeout(2000)

      console.log('[PDF Helper] Injecting print CSS overrides...')

      await page.addStyleTag({
        content: `
          /* Font fallback - hanya untuk elemen text, bukan semua elemen */
          body, p, span, div, td, th, h1, h2, h3, h4, h5, h6, button, input, label {
            font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
          }
          /* Sembunyikan no-print */
          .no-print { display: none !important; }
          .bg-gray-100 { background-color: white !important; }
          .page-container {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 5mm !important;
            padding-bottom: 25mm !important;
          }

          .cert-title-id {
            font-size: 20px !important;
            line-height: 1.15 !important;
            font-weight: 700 !important;
            letter-spacing: 0 !important;
            color: #000 !important;
          }

          .cert-title-en {
            font-size: 7px !important;
            line-height: 1.2 !important;
            font-weight: 700 !important;
            font-style: italic !important;
            color: #000 !important;
          }

          .cert-text-id,
          .cert-info-text,
          .cert-info-text td {
            font-size: 11px !important;
            line-height: 1.25 !important;
            font-weight: 700 !important;
            color: #000 !important;
          }

          .cert-text-en {
            font-size: 7px !important;
            line-height: 1.15 !important;
            font-weight: 700 !important;
            font-style: italic !important;
            color: #000 !important;
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
          /* tr di dalam tfoot tetap display:table-row */
          tfoot.print-repeat-footer > tr {
            display: table-row !important;
            position: static !important;
            width: auto !important;
          }
          /* td di dalam tfoot harus display:table-cell (BUKAN table-row!) */
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

          /* Page container */
          .page-container.results-page {
            position: relative !important;
            min-height: 297mm !important;
            height: 297mm !important;
            padding: 0 5mm 25mm 5mm !important;
            box-sizing: border-box !important;
          }
          .page-container.cover-page {
            height: 297mm !important;
            max-height: 297mm !important;
            position: relative !important;
            box-sizing: border-box !important;
          }

          /* List cleanup - hanya untuk ul/ol/li, tidak untuk semua elemen */
          ul, ol, li { list-style: none !important; padding-left: 0 !important; }
          *::marker { display: none !important; content: "" !important; font-size: 0 !important; }
        `
      })

      // ── Force-fix tfoot styles via JavaScript (lebih reliable dari CSS injection) ──
      await page.evaluate(() => {
        // Paksa semua tfoot.print-repeat-footer agar menggunakan table-footer-group
        document.querySelectorAll('tfoot.print-repeat-footer').forEach((tfoot: Element) => {
          const el = tfoot as HTMLElement
          el.style.setProperty('display', 'table-footer-group', 'important')
          el.style.setProperty('position', 'static', 'important')
          el.style.setProperty('bottom', 'auto', 'important')
          el.style.setProperty('left', 'auto', 'important')
          el.style.setProperty('width', 'auto', 'important')
        })
        // Paksa semua td di dalam tfoot agar table-cell
        document.querySelectorAll('tfoot.print-repeat-footer > tr > td').forEach((td: Element) => {
          const el = td as HTMLElement
          el.style.setProperty('display', 'table-cell', 'important')
          el.style.setProperty('position', 'static', 'important')
        })
        // Pastikan tabel utama mengisi tinggi penuh
        document.querySelectorAll('table.repeatable-page-table').forEach((table: Element) => {
          const el = table as HTMLElement
          el.style.setProperty('height', '100%', 'important')
        })
      })
      console.log('[PDF Helper] JS style overrides applied')

      await page.waitForTimeout(500)

      console.log('[PDF Helper] Generating PDF...')
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true,
        displayHeaderFooter: false
      })
      console.log(`[PDF Helper] PDF generated: ${pdf.length} bytes`)

      // Get certificate number for filename
      const certificateNumber = existingCert?.no_certificate || String(certificateId)
      const safeFileName = certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `certificate_${safeFileName}_${certificateId}.pdf`

      // Define local storage directory
      // Use absolute path to ensure it works in all environments
      const projectRoot = process.cwd()
      const storageDir = path.join(projectRoot, 'e-certificate-signed')

      console.log(`[PDF Helper] Project root: ${projectRoot}`)
      console.log(`[PDF Helper] Storage directory: ${storageDir}`)

      // Ensure directory exists
      try {
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true })
          console.log(`[PDF Helper] Created directory: ${storageDir}`)
        } else {
          console.log(`[PDF Helper] Directory already exists: ${storageDir}`)
        }
      } catch (dirError: any) {
        console.error(`[PDF Helper] Error creating directory:`, dirError)
        return { success: false, error: `Failed to create directory: ${dirError.message}` }
      }

      // Full path to save PDF
      const filePath = path.join(storageDir, fileName)
      console.log(`[PDF Helper] Full file path: ${filePath}`)

      // Sign PDF using BSrE API FIRST before saving
      // Only save PDF if signing is successful
      console.log(`[PDF Helper] Sending PDF to BSrE for signing...`)
      let signedPdf: Buffer | null = null

      // Save PDF to temporary location for signing
      const tempFilePath = filePath.replace('.pdf', '_temp.pdf')
      try {
        fs.writeFileSync(tempFilePath, pdf)
        console.log(`[PDF Helper] Temporary PDF saved: ${tempFilePath}`)
      } catch (writeError: any) {
        console.error(`[PDF Helper] Error writing temporary file:`, writeError)
        return { success: false, error: `Failed to write temporary file: ${writeError.message}` }
      }

      try {
        const bsreBaseURL = process.env.BSRE_BASE_URL || 'http://172.19.2.171'
        const bsreUsername = process.env.BSRE_USERNAME
        const bsrePassword = process.env.BSRE_PASSWORD

        if (!bsreUsername || !bsrePassword) {
          console.warn('[PDF Helper] BSrE credentials not configured, skipping signature')
          console.warn('[PDF Helper] Required: BSRE_USERNAME and BSRE_PASSWORD in environment variables')
          // Continue without signing if credentials not available
        } else {
          // Get NIK from personel table (already fetched at top)
          // nik variable is already available from the pre-check

          if (!nik) {
            console.error('[PDF Helper] NIK not available, cannot sign PDF')
            return { success: false, error: 'NIK_NOT_FOUND_IN_DB' }
          } else if (!passphrase) {
            console.error('[PDF Helper] Passphrase not provided, cannot sign PDF')
            return { success: false, error: 'Passphrase tidak tersedia untuk penandatanganan PDF' }
          } else {
            // Create Basic Auth header
            const credentials = Buffer.from(`${bsreUsername}:${bsrePassword}`).toString('base64')
            const authHeader = `Basic ${credentials}`

            // Read PDF file
            const pdfFile = fs.readFileSync(tempFilePath)
            console.log(`[PDF Helper] PDF file size: ${pdfFile.length} bytes`)

            // Create multipart/form-data manually for Node.js
            const signEndpoint = `${bsreBaseURL}/api/sign/pdf`
            console.log(`[PDF Helper] Calling BSrE sign endpoint: ${signEndpoint}`)

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 120000) // Timeout 120 detik (lebih lama untuk signing)

            // Generate boundary (must not contain spaces or special chars)
            const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`

            // Build multipart/form-data body with all required parameters
            const formDataParts: Buffer[] = []
            const CRLF = '\r\n'

            // Helper function to add text field
            const addTextField = (name: string, value: string) => {
              formDataParts.push(Buffer.from(`--${boundary}${CRLF}`))
              formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`))
              formDataParts.push(Buffer.from(value))
              formDataParts.push(Buffer.from(CRLF))
            }

            // Add file field (must be first or in correct order)
            formDataParts.push(Buffer.from(`--${boundary}${CRLF}`))
            formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`))
            formDataParts.push(Buffer.from(`Content-Type: application/pdf${CRLF}${CRLF}`))
            formDataParts.push(pdfFile)
            formDataParts.push(Buffer.from(CRLF))

            // Add NIK field
            addTextField('nik', nik)

            // Add passphrase field
            addTextField('passphrase', passphrase)

            // Add tampilan field - invisible mode karena QR code sudah ada di dokumen yang di-generate sistem
            // Signature digital tetap tertanam, tapi QR code tidak ditambahkan karena sudah ada di dokumen
            addTextField('tampilan', 'invisible')

            // Add page field - halaman untuk penempatan signature (page 1)
            addTextField('page', '1')

            // Add image field - false karena tidak perlu menambahkan image/QR code (sudah ada di dokumen)
            addTextField('image', 'false')

            // Parameter QR code berikut tidak diperlukan karena QR code sudah ada di dokumen
            // Tetap dikirim dengan nilai default untuk kompatibilitas dengan BSrE API
            // linkQR, xAxis, yAxis, width, height hanya digunakan jika tampilan='visible' dan image='true'

            // Use public_id for QR link if available, otherwise fallback to certificate ID
            // Note: This linkQR parameter is for BSrE to embed QR, but we are using 'invisible' mode
            // so this might not be used by BSrE, but good to keep consistent.
            // The ACTUAL QR code on the PDF is generated by the print page.
            // We need to make sure the print page uses the public_id for its QR code.
            const qrLink = existingCert?.public_id
              ? `${publicBaseUrl}/verify/${existingCert.public_id}`
              : `${publicBaseUrl}/certificates/${certificateId}/verify`

            const linkQR = process.env.BSRE_QR_LINK || qrLink
            addTextField('linkQR', linkQR)
            addTextField('xAxis', '0')
            addTextField('yAxis', '0')
            addTextField('width', '0')
            addTextField('height', '0')

            // Close boundary (must end with --)
            formDataParts.push(Buffer.from(`--${boundary}--${CRLF}`))

            const formDataBody = Buffer.concat(formDataParts)
            console.log(`[PDF Helper] FormData body size: ${formDataBody.length} bytes`)
            console.log(`[PDF Helper] Boundary: ${boundary}`)
            console.log(`[PDF Helper] Sending with parameters: nik=${nik}, passphrase=***, tampilan=invisible, page=1, image=false, linkQR=${linkQR || '(empty - QR already in document)'}, xAxis=0, yAxis=0, width=0, height=0`)
            console.log(`[PDF Helper] Note: QR code already exists in document, using invisible mode to avoid duplicate QR code`)

            const signResponse = await fetch(signEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': formDataBody.length.toString(),
                'Accept': 'application/pdf, application/json'
              },
              body: formDataBody,
              signal: controller.signal
            })

            clearTimeout(timeoutId)

            console.log(`[PDF Helper] BSrE sign response status: ${signResponse.status}`)
            console.log(`[PDF Helper] BSrE sign response headers:`, Object.fromEntries(signResponse.headers.entries()))

            if (!signResponse.ok) {
              const errorText = await signResponse.text().catch(() => '')
              console.error(`[PDF Helper] BSrE sign failed: ${signResponse.status} - ${errorText}`)

              // Try to parse JSON error for more context
              let errorDetail = errorText
              let bsreStatusCode: number | null = null
              try {
                const errJson = JSON.parse(errorText)
                console.error(`[PDF Helper] BSrE error JSON:`, errJson)
                // Capture BSrE internal status_code (e.g. 2021 = no active cert)
                bsreStatusCode = typeof errJson.status_code === 'number' ? errJson.status_code : null
                // Extract meaningful error message
                errorDetail = errJson.message || errJson.error || errJson.pesan || errorText
              } catch { /* not JSON */ }

              // If passphrase is wrong (401 or 400 or 403), fail immediately
              // BUT: cek dulu apakah error dari BSrE terkait NIK, bukan passphrase
              if (signResponse.status === 401 || signResponse.status === 400 || signResponse.status === 403) {

                // ── Cek BSrE status_code terlebih dahulu ────────────────────────
                // 2021 = "Pengguna terdaftar dan belum memiliki sertifikat aktif"
                //        (NIK dikenali tapi sertifikat BSrE-nya belum aktif)
                // 2022/2023 = variasi status sertifikat belum aktif
                // 4001/4002/4003 = masalah identitas / akun
                const BSRE_ACCOUNT_ERROR_CODES = [2021, 2022, 2023, 4001, 4002, 4003]
                if (bsreStatusCode !== null && BSRE_ACCOUNT_ERROR_CODES.includes(bsreStatusCode)) {
                  console.error(`[PDF Helper] ❌ BSrE status_code ${bsreStatusCode} = masalah akun/sertifikat BSrE (bukan passphrase): ${errorDetail}`)
                  if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                  return {
                    success: false,
                    error: `NIK_INVALID_IN_BSRE: [${bsreStatusCode}] ${errorDetail}`
                  }
                }

                // ── Cek keyword NIK / user tidak ditemukan ──────────────────────
                // BSrE mengembalikan 401/400 juga saat NIK tidak terdaftar
                const errorDetailLower = errorDetail.toLowerCase()
                const isNIKError =
                  errorDetailLower.includes('nik') ||
                  errorDetailLower.includes('sertifikat aktif') ||
                  errorDetailLower.includes('belum memiliki sertifikat') ||
                  errorDetailLower.includes('user not found') ||
                  errorDetailLower.includes('pengguna tidak ditemukan') ||
                  errorDetailLower.includes('user tidak ditemukan') ||
                  errorDetailLower.includes('tidak terdaftar') ||
                  errorDetailLower.includes('not registered') ||
                  errorDetailLower.includes('unauthorized user') ||
                  errorDetailLower.includes('identity') ||
                  errorDetailLower.includes('identitas')

                if (isNIKError) {
                  console.error(`[PDF Helper] ❌ BSrE error terkait NIK/akun (HTTP ${signResponse.status}): ${errorDetail}`)
                  if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                  return {
                    success: false,
                    error: `NIK_INVALID_IN_BSRE: ${errorDetail}`
                  }
                }

                console.error(`[PDF Helper] Passphrase salah atau tidak berwenang (HTTP ${signResponse.status}): ${errorDetail}`)
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                return {
                  success: false,
                  error: `Passphrase TTE salah. Silakan masukkan passphrase yang benar dan coba lagi. (HTTP ${signResponse.status})`
                }
              }

              // For 500 or other server errors
              console.error(`[PDF Helper] BSrE server error (${signResponse.status}). Details: ${errorDetail}`)
              if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
              return {
                success: false,
                error: `Gagal menandatangani PDF (BSrE HTTP ${signResponse.status}). ${errorDetail || 'Silakan coba lagi nanti.'}`
              }
            } else {
              // BSrE returned 200 - now parse and validate the response body
              const contentType = signResponse.headers.get('content-type') || ''
              console.log(`[PDF Helper] BSrE response content-type: ${contentType}, status: ${signResponse.status}`)

              // Read response body ONCE
              const responseArrayBuffer = await signResponse.arrayBuffer()
              const responseBuffer = Buffer.from(responseArrayBuffer)

              // Helper: validate PDF magic bytes
              const isPdfBuffer = (buf: Buffer): boolean => {
                // PDF files start with %PDF-
                return buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-'
              }

              if (contentType.includes('application/pdf')) {
                // Response claims to be PDF - still validate magic bytes
                if (!isPdfBuffer(responseBuffer)) {
                  // BSrE returned 200 with content-type PDF but body is NOT a PDF
                  // This can happen when passphrase is wrong and BSrE returns JSON error with wrong content-type
                  const bodyPreview = responseBuffer.slice(0, 500).toString('utf-8')
                  console.error(`[PDF Helper] ❌ BSrE returned 200 with PDF content-type but body is NOT a PDF!`)
                  console.error(`[PDF Helper] Body preview: ${bodyPreview}`)

                  // Try to parse as JSON for error details
                  try {
                    const errJson = JSON.parse(responseBuffer.toString('utf-8'))
                    console.error(`[PDF Helper] BSrE error body JSON:`, errJson)
                    const errMsg = errJson.message || errJson.error || errJson.pesan || errJson.status || JSON.stringify(errJson)
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `Passphrase TTE salah atau tidak valid: ${errMsg}`
                    }
                  } catch {
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah. Body: ${bodyPreview.substring(0, 100)}`
                    }
                  }
                }

                signedPdf = responseBuffer
                console.log(`[PDF Helper] ✅ PDF signed successfully by BSrE - Size: ${signedPdf.length} bytes`)

              } else if (contentType.includes('application/json') || contentType.includes('text/')) {
                // Response is JSON or text - parse it
                const responseText = responseBuffer.toString('utf-8')
                console.log(`[PDF Helper] BSrE JSON/text response (first 500 chars): ${responseText.substring(0, 500)}`)

                try {
                  const responseData = JSON.parse(responseText)
                  console.log(`[PDF Helper] BSrE sign response:`, responseData)

                  // Check for explicit error indicators in JSON
                  if (
                    responseData.status === 'error' ||
                    responseData.status === 'gagal' ||
                    responseData.error ||
                    responseData.pesan?.toLowerCase().includes('salah') ||
                    responseData.pesan?.toLowerCase().includes('gagal') ||
                    responseData.message?.toLowerCase().includes('invalid') ||
                    responseData.message?.toLowerCase().includes('incorrect') ||
                    responseData.message?.toLowerCase().includes('wrong')
                  ) {
                    const errMsg = responseData.pesan || responseData.message || responseData.error || 'Passphrase salah'
                    console.error(`[PDF Helper] ❌ BSrE returned 200 but JSON contains error indicator:`, errMsg)
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)

                    // ── Cek NIK dulu sebelum menyimpulkan passphrase salah ──
                    const errMsgLower = errMsg.toLowerCase()
                    const isNikErrorInJson =
                      errMsgLower.includes('nik') ||
                      errMsgLower.includes('user not found') ||
                      errMsgLower.includes('pengguna tidak ditemukan') ||
                      errMsgLower.includes('tidak terdaftar') ||
                      errMsgLower.includes('not registered') ||
                      errMsgLower.includes('unauthorized user') ||
                      errMsgLower.includes('identity') ||
                      errMsgLower.includes('identitas')

                    if (isNikErrorInJson) {
                      console.error(`[PDF Helper] ❌ BSrE JSON 200 error terkait NIK: ${errMsg}`)
                      return {
                        success: false,
                        error: `NIK_INVALID_IN_BSRE: ${errMsg}`
                      }
                    }

                    return {
                      success: false,
                      error: `Passphrase TTE salah atau tidak valid: ${errMsg}`
                    }
                  }

                  // Check if response contains id_dokumen (for download endpoint)
                  if (responseData.id_dokumen || responseData.id || responseData.document_id) {
                    const documentId = responseData.id_dokumen || responseData.id || responseData.document_id
                    console.log(`[PDF Helper] Document ID received: ${documentId}, downloading signed PDF...`)

                    const downloadEndpoint = `${bsreBaseURL}/api/sign/download/${documentId}`
                    console.log(`[PDF Helper] Downloading from: ${downloadEndpoint}`)

                    const downloadController = new AbortController()
                    const downloadTimeoutId = setTimeout(() => downloadController.abort(), 120000)

                    const downloadResponse = await fetch(downloadEndpoint, {
                      method: 'GET',
                      headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/pdf'
                      },
                      signal: downloadController.signal
                    })

                    clearTimeout(downloadTimeoutId)

                    if (!downloadResponse.ok) {
                      const dlError = await downloadResponse.text().catch(() => '')
                      console.error(`[PDF Helper] Failed to download signed PDF: ${downloadResponse.status} - ${dlError}`)
                      // Cek apakah error download terkait passphrase atau NIK
                      const dlErrorLower = dlError.toLowerCase()
                      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                      if (dlErrorLower.includes('nik') || dlErrorLower.includes('user not found') || dlErrorLower.includes('tidak terdaftar')) {
                        return { success: false, error: `NIK_INVALID_IN_BSRE: ${dlError}` }
                      }
                      if (downloadResponse.status === 401 || downloadResponse.status === 403 || dlErrorLower.includes('passphrase') || dlErrorLower.includes('salah')) {
                        return { success: false, error: `Passphrase TTE salah atau tidak valid (download gagal HTTP ${downloadResponse.status}): ${dlError}` }
                      }
                      return { success: false, error: `BSrE_DOWNLOAD_FAILED: Gagal mengunduh PDF yang ditandatangani dari BSrE (HTTP ${downloadResponse.status}). ${dlError.substring(0, 200)}` }
                    } else {
                      const downloadBuf = Buffer.from(await downloadResponse.arrayBuffer())
                      if (!isPdfBuffer(downloadBuf)) {
                        console.error(`[PDF Helper] Downloaded file is not a valid PDF`)
                        const bodyStr = downloadBuf.slice(0, 300).toString('utf-8')
                        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                        // Coba parse sebagai JSON error dari BSrE
                        try {
                          const errJson = JSON.parse(bodyStr)
                          const errMsg = errJson.pesan || errJson.message || errJson.error || bodyStr
                          const errMsgL = errMsg.toLowerCase()
                          if (errMsgL.includes('nik') || errMsgL.includes('user not found') || errMsgL.includes('tidak terdaftar')) {
                            return { success: false, error: `NIK_INVALID_IN_BSRE: ${errMsg}` }
                          }
                          return { success: false, error: `Passphrase TTE salah atau tidak valid: ${errMsg}` }
                        } catch {
                          return { success: false, error: `BSrE_DOWNLOAD_FAILED: File yang diunduh bukan PDF yang valid. Preview: ${bodyStr.substring(0, 100)}` }
                        }
                      } else {
                        signedPdf = downloadBuf
                        console.log(`[PDF Helper] ✅ PDF downloaded and signed successfully - Size: ${signedPdf.length} bytes`)
                      }
                    }
                  } else if (responseData.pdf || responseData.signed_pdf) {
                    const pdfBase64 = responseData.pdf || responseData.signed_pdf
                    const decoded = Buffer.from(pdfBase64, 'base64')
                    if (!isPdfBuffer(decoded)) {
                      console.error(`[PDF Helper] Base64 decoded content is not a valid PDF`)
                      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                      return { success: false, error: `BSrE_DOWNLOAD_FAILED: Konten base64 dari BSrE bukan PDF yang valid.` }
                    } else {
                      signedPdf = decoded
                      console.log(`[PDF Helper] ✅ PDF signed successfully (from base64) - Size: ${signedPdf.length} bytes`)
                    }
                  } else {
                    console.warn(`[PDF Helper] BSrE JSON response has no id_dokumen or pdf field and no error indicator. Full response:`, responseData)
                    // CAUTION: Do NOT accept this as success - return error
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `BSrE mengembalikan response JSON tanpa data PDF. Response: ${responseText.substring(0, 200)}`
                    }
                  }
                } catch (jsonError: any) {
                  // Not valid JSON - maybe binary data served with wrong content-type?
                  console.warn(`[PDF Helper] Response text is not valid JSON, checking if it's binary PDF...`)
                  if (isPdfBuffer(responseBuffer)) {
                    signedPdf = responseBuffer
                    console.log(`[PDF Helper] ✅ PDF signed successfully (binary disguised as text) - Size: ${signedPdf.length} bytes`)
                  } else {
                    console.error(`[PDF Helper] Response is neither valid JSON nor a PDF`)
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah.`
                    }
                  }
                }

              } else {
                // Unknown content-type - validate PDF magic bytes STRICTLY
                if (isPdfBuffer(responseBuffer)) {
                  signedPdf = responseBuffer
                  console.log(`[PDF Helper] ✅ PDF signed successfully (binary, unknown content-type) - Size: ${signedPdf.length} bytes`)
                } else {
                  // Could be an error response with wrong content-type
                  const bodyPreview = responseBuffer.slice(0, 300).toString('utf-8')
                  console.error(`[PDF Helper] ❌ BSrE returned 200 but response is NOT a valid PDF (unknown content-type)`)
                  console.error(`[PDF Helper] Body preview: ${bodyPreview}`)

                  // Try to check if it's a JSON error
                  try {
                    const errJson = JSON.parse(responseBuffer.toString('utf-8'))
                    const errMsg = errJson.pesan || errJson.message || errJson.error || JSON.stringify(errJson)
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `Passphrase TTE salah atau tidak valid: ${errMsg}`
                    }
                  } catch {
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
                    return {
                      success: false,
                      error: `BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah. Preview: ${bodyPreview.substring(0, 100)}`
                    }
                  }
                }
              }
            }
          }
        }
      } catch (signError: any) {
        console.error(`[PDF Helper] Error signing PDF with BSrE:`, signError)
        console.error(`[PDF Helper] Error details:`, signError.message, signError.stack)
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
        return {
          success: false,
          error: `Gagal menandatangani PDF: ${signError.message || 'Unknown error'}`
        }
      }

      // Only save PDF if signing was successful
      if (!signedPdf) {
        console.error(`[PDF Helper] No signed PDF received from BSrE`)
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
        // Return prefix BSrE_DOWNLOAD_FAILED agar sign-level-3 bisa mengenali ini
        // sebagai error download/koneksi BSrE, bukan error passphrase atau NIK
        return {
          success: false,
          error: 'BSrE_DOWNLOAD_FAILED: Tidak ada PDF yang berhasil diterima dari BSrE. Kemungkinan passphrase salah atau ada masalah koneksi ke server BSrE.'
        }
      }

      // Save signed PDF
      try {
        fs.writeFileSync(filePath, signedPdf)
        console.log(`[PDF Helper] Signed PDF saved successfully to: ${filePath}`)

        // Remove temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }

        // Verify file was saved
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          console.log(`[PDF Helper] File verified - Size: ${stats.size} bytes, Signed: true`)
        } else {
          console.error(`[PDF Helper] File was not created at: ${filePath}`)
          return { success: false, error: 'File was not created' }
        }
      } catch (writeError: any) {
        console.error(`[PDF Helper] Error writing signed PDF file:`, writeError)
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
        return { success: false, error: `Failed to write signed PDF file: ${writeError.message}` }
      }

      // Update certificate with PDF path (relative path for reference)
      const relativePath = `e-certificate-signed/${fileName}`
      const { error: updateError } = await supabaseAdmin
        .from('certificate')
        .update({
          pdf_path: relativePath,
          pdf_generated_at: new Date().toISOString()
        })
        .eq('id', certificateId)

      if (updateError) {
        console.error('[PDF Helper] Update error:', updateError)
        return { success: false, error: updateError.message }
      }

      console.log(`[PDF Helper] PDF generated and saved successfully: ${relativePath}${signedPdf ? ' (Signed by BSrE)' : ' (Not signed - BSrE unavailable)'}`)
      return { success: true, pdfPath: relativePath, signed: signedPdf !== null }

    } finally {
      await browser.close()
    }
  } catch (error: any) {
    console.error('[PDF Helper] Error generating PDF:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

