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
 */
export async function generateAndSaveCertificatePDF(certificateId: number): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
  try {
    // Get certificate info
    const { data: existingCert } = await supabaseAdmin
      .from('certificate')
      .select('pdf_path, no_certificate')
      .eq('id', certificateId)
      .single()

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

      // Save PDF to local filesystem
      try {
        fs.writeFileSync(filePath, pdf)
        console.log(`[PDF Helper] PDF saved successfully to: ${filePath}`)
        
        // Verify file was saved
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          console.log(`[PDF Helper] File verified - Size: ${stats.size} bytes`)
        } else {
          console.error(`[PDF Helper] File was not created at: ${filePath}`)
          return { success: false, error: 'File was not created' }
        }
      } catch (writeError: any) {
        console.error(`[PDF Helper] Error writing file:`, writeError)
        return { success: false, error: `Failed to write file: ${writeError.message}` }
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

      console.log(`[PDF Helper] PDF generated and saved successfully: ${relativePath}`)
      return { success: true, pdfPath: relativePath }

    } finally {
      await browser.close()
    }
  } catch (error: any) {
    console.error('[PDF Helper] Error generating PDF:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

