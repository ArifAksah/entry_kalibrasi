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

    // Get base URL from environment or use default
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!baseUrl) {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }

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
        '--disable-gpu'
      ]
    })

    try {
      const context = await browser.newContext({
        viewport: {
          width: 794, // A4 width in pixels at 96 DPI
          height: 1123, // A4 height in pixels at 96 DPI
        }
      })

      const page = await context.newPage()

      // Navigate to print page
      await page.goto(printUrl, {
        waitUntil: 'networkidle',
        timeout: 60000
      })

      // Wait for loading to complete
      const loadingSelector = 'text=Memuat data sertifikat untuk dicetak...'
      const loadingExists = await page.locator(loadingSelector).count() > 0

      if (loadingExists) {
        await page.waitForSelector(loadingSelector, {
          state: 'hidden',
          timeout: 30000
        }).catch(() => {
          console.log('[PDF Helper] Loading message still visible, but continuing...')
        })
      }

      // Wait for main content
      await page.waitForSelector('.page-container', {
        timeout: 30000,
        state: 'visible'
      }).catch(() => {
        console.log('[PDF Helper] Page container not found, trying alternative selectors...')
      })

      // Wait for footer
      await page.waitForSelector('.page-1-footer', {
        timeout: 30000,
        state: 'visible'
      }).catch(() => {
        console.log('[PDF Helper] Footer not found, but continuing...')
      })

      // Wait for React to finish rendering
      await page.waitForFunction(() => {
        const loadingText = Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent?.includes('Memuat data sertifikat untuk dicetak...')
        )
        if (loadingText) return false

        const pageContainer = document.querySelector('.page-container')
        if (!pageContainer) return false

        const footer = document.querySelector('.page-1-footer')
        if (!footer) return false

        return true
      }, { timeout: 30000 }).catch(() => {
        console.log('[PDF Helper] Wait function timeout, but continuing...')
      })

      // Wait for dynamic content (QR codes, etc.)
      await page.waitForTimeout(5000)

      // Inject CSS to prevent any list styling artifacts
      await page.addStyleTag({
        content: `
          * {
            list-style: none !important;
            list-style-type: none !important;
            list-style-position: outside !important;
            list-style-image: none !important;
          }
          *::marker {
            display: none !important;
            content: "" !important;
            color: transparent !important;
            font-size: 0 !important;
          }
        `
      })

      await page.waitForTimeout(500)

      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        },
        preferCSSPageSize: true,
        displayHeaderFooter: false
      })

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
              ? `${baseUrl}/verify/${existingCert.public_id}`
              : `${baseUrl}/certificates/${certificateId}/verify`

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
                      signedPdf = null
                    } else {
                      const downloadBuf = Buffer.from(await downloadResponse.arrayBuffer())
                      if (!isPdfBuffer(downloadBuf)) {
                        console.error(`[PDF Helper] Downloaded file is not a valid PDF`)
                        signedPdf = null
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
                      signedPdf = null
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
        return {
          success: false,
          error: 'Gagal mendapatkan PDF yang ditandatangani dari BSrE. Silakan coba lagi.'
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

