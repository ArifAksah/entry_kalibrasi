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
export async function generateAndSaveCertificatePDF(certificateId: number, userId?: string, passphrase?: string): Promise<{ success: boolean; pdfPath?: string; error?: string; signed?: boolean }> {
  try {
    // Get certificate info and authorized_by if userId not provided
    const { data: existingCert } = await supabaseAdmin
      .from('certificate')
      .select('pdf_path, no_certificate, authorized_by')
      .eq('id', certificateId)
      .single()

    // Get userId from certificate if not provided
    const authorizedByUserId = userId || existingCert?.authorized_by

    if (existingCert?.pdf_path) {
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
    
    const printUrl = `${baseUrl}/certificates/${certificateId}/print?pdf=true`

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
          // Get NIK from personel table
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
                console.log(`[PDF Helper] Found NIK for user ${authorizedByUserId}: ${nik}`)
              } else {
                console.warn(`[PDF Helper] NIK not found for user ${authorizedByUserId}`)
              }
            } catch (nikError: any) {
              console.error(`[PDF Helper] Error fetching NIK:`, nikError)
            }
          }

          if (!nik) {
            console.error('[PDF Helper] NIK not available, cannot sign PDF')
            return { success: false, error: 'NIK tidak tersedia untuk penandatanganan PDF' }
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
            const linkQR = process.env.BSRE_QR_LINK || ''
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
              
              // If passphrase is wrong (401), fail the PDF generation
              if (signResponse.status === 401) {
                console.error(`[PDF Helper] Passphrase salah, PDF signing gagal`)
                // Clean up temporary file
                if (fs.existsSync(tempFilePath)) {
                  fs.unlinkSync(tempFilePath)
                }
                return { 
                  success: false, 
                  error: 'Passphrase TTE salah. Silakan masukkan passphrase yang benar dan coba lagi.' 
                }
              }
              
              // For 500 errors, log more details for debugging
              if (signResponse.status === 500) {
                console.error(`[PDF Helper] BSrE server error (500). Error details:`, errorText)
                console.error(`[PDF Helper] Request details: endpoint=${signEndpoint}, fileSize=${pdfFile.length}, nik=${nik}`)
                // Try to parse error for more details
                try {
                  const errorJson = JSON.parse(errorText)
                  console.error(`[PDF Helper] BSrE error JSON:`, errorJson)
                } catch (e) {
                  // Not JSON, ignore
                }
                // Clean up temporary file
                if (fs.existsSync(tempFilePath)) {
                  fs.unlinkSync(tempFilePath)
                }
                return { 
                  success: false, 
                  error: 'Gagal menandatangani PDF. Server BSrE mengalami error. Silakan coba lagi nanti.' 
                }
              }
              
              // For other errors, fail PDF generation (don't save unsigned PDF)
              console.error(`[PDF Helper] BSrE sign failed with status ${signResponse.status}, PDF generation cancelled`)
              // Clean up temporary file
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath)
              }
              return { 
                success: false, 
                error: `Gagal menandatangani PDF. Error: ${errorText || `HTTP ${signResponse.status}`}` 
              }
            } else {
              // Check content type to determine if response is PDF or JSON
              const contentType = signResponse.headers.get('content-type') || ''
              console.log(`[PDF Helper] BSrE response content-type: ${contentType}`)
              
              // Read response body only ONCE as ArrayBuffer
              const responseArrayBuffer = await signResponse.arrayBuffer()
              
              if (contentType.includes('application/pdf')) {
                // Response is PDF, use directly
                signedPdf = Buffer.from(responseArrayBuffer)
                console.log(`[PDF Helper] ✅ PDF signed successfully by BSrE - Size: ${signedPdf.length} bytes`)
              } else if (contentType.includes('application/json')) {
                // Response is JSON, try to parse and extract id_dokumen or PDF data
                try {
                  const responseText = Buffer.from(responseArrayBuffer).toString('utf-8')
                  const responseData = JSON.parse(responseText)
                  console.log(`[PDF Helper] BSrE sign response:`, responseData)
                  
                  // Check if response contains id_dokumen (for download endpoint)
                  if (responseData.id_dokumen || responseData.id || responseData.document_id) {
                    const documentId = responseData.id_dokumen || responseData.id || responseData.document_id
                    console.log(`[PDF Helper] Document ID received: ${documentId}, downloading signed PDF...`)
                    
                    // Download signed PDF from BSrE download endpoint
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
                      const errorText = await downloadResponse.text().catch(() => '')
                      console.error(`[PDF Helper] Failed to download signed PDF: ${downloadResponse.status} - ${errorText}`)
                      signedPdf = null
                    } else {
                      const downloadArrayBuffer = await downloadResponse.arrayBuffer()
                      signedPdf = Buffer.from(downloadArrayBuffer)
                      console.log(`[PDF Helper] ✅ PDF downloaded and signed successfully - Size: ${signedPdf.length} bytes`)
                    }
                  } else if (responseData.pdf || responseData.signed_pdf) {
                    // If response contains PDF data in base64 or other format, handle it here
                    const pdfBase64 = responseData.pdf || responseData.signed_pdf
                    signedPdf = Buffer.from(pdfBase64, 'base64')
                    console.log(`[PDF Helper] ✅ PDF signed successfully (from base64) - Size: ${signedPdf.length} bytes`)
                  } else {
                    console.warn(`[PDF Helper] BSrE response does not contain id_dokumen or PDF data`)
                    signedPdf = null
                  }
                } catch (jsonError: any) {
                  console.warn(`[PDF Helper] Failed to parse JSON response:`, jsonError.message)
                  // If JSON parsing fails, try to use response as PDF anyway
                  signedPdf = Buffer.from(responseArrayBuffer)
                  console.log(`[PDF Helper] ✅ PDF signed successfully (fallback to binary) - Size: ${signedPdf.length} bytes`)
                }
              } else {
                // Content type not clear, try to use as PDF (most likely it's PDF)
                signedPdf = Buffer.from(responseArrayBuffer)
                console.log(`[PDF Helper] ✅ PDF signed successfully (binary, unknown content-type) - Size: ${signedPdf.length} bytes`)
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

