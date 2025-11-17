import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser
  try {
    const { id } = await params
    const certificateId = parseInt(id)

    if (isNaN(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
    }

    // Dynamic import playwright to handle cases where it's not installed
    let playwright: any
    try {
      // Dynamic import with require for server-side only
      playwright = await import('playwright')
    } catch (importError) {
      console.error('Playwright not available, using fallback method:', importError)
      // Fallback: redirect to print page with download parameter
      const baseUrl = request.nextUrl.origin
      const printUrl = `${baseUrl}/certificates/${certificateId}/print?download=true`
      return NextResponse.redirect(printUrl)
    }

    // Get base URL
    const baseUrl = request.nextUrl.origin
    const printUrl = `${baseUrl}/certificates/${certificateId}/print?pdf=true`

    // Launch browser with Playwright
    browser = await playwright.chromium.launch({
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

      // Wait for loading to complete - wait for main content to appear
      // Check if loading message exists, if yes wait for it to disappear
      const loadingSelector = 'text=Memuat data sertifikat untuk dicetak...'
      const loadingExists = await page.locator(loadingSelector).count() > 0
      
      if (loadingExists) {
        console.log('Loading message detected, waiting for content to load...')
        // Wait for loading message to disappear
        await page.waitForSelector(loadingSelector, { 
          state: 'hidden', 
          timeout: 30000 
        }).catch(() => {
          console.log('Loading message still visible, but continuing...')
        })
      }

      // Wait for main content to appear - check for page container
      console.log('Waiting for main content...')
      await page.waitForSelector('.page-container', { 
        timeout: 30000,
        state: 'visible'
      }).catch(() => {
        console.log('Page container not found, trying alternative selectors...')
      })

      // Wait for footer to appear (indicates content is loaded)
      console.log('Waiting for footer...')
      await page.waitForSelector('.page-1-footer', { 
        timeout: 30000,
        state: 'visible'
      }).catch(() => {
        console.log('Footer not found, but continuing...')
      })

      // Wait for React to finish rendering - check if loading state is false
      console.log('Waiting for React to finish rendering...')
      await page.waitForFunction(() => {
        // Check if loading message is not in DOM
        const loadingText = Array.from(document.querySelectorAll('*')).find(el => 
          el.textContent?.includes('Memuat data sertifikat untuk dicetak...')
        )
        if (loadingText) return false
        
        // Check if main content exists
        const pageContainer = document.querySelector('.page-container')
        if (!pageContainer) return false
        
        // Check if footer exists
        const footer = document.querySelector('.page-1-footer')
        if (!footer) return false
        
        return true
      }, { timeout: 30000 }).catch(() => {
        console.log('Wait function timeout, but continuing...')
      })

      // Additional wait to ensure all dynamic content (QR codes, etc.) is loaded
      console.log('Waiting for dynamic content (QR codes, etc.)...')
      await page.waitForTimeout(5000) // Wait for QR codes and dynamic content
      
      // Final verification - check if loading message is still visible
      const stillLoading = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*')).some(el => 
          el.textContent?.includes('Memuat data sertifikat untuk dicetak...')
        )
      })
      
      if (stillLoading) {
        console.log('Warning: Loading message still visible, waiting more...')
        await page.waitForTimeout(5000)
      }
      
      console.log('Content should be loaded, proceeding with PDF generation...')
      
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
            width: 0 !important;
            height: 0 !important;
          }
          ul, ol, li {
            list-style: none !important;
            list-style-type: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          ul::before, ol::before, li::before,
          ul::after, ol::after, li::after {
            display: none !important;
            content: none !important;
          }
          .page-1-footer,
          .page-1-footer * {
            list-style: none !important;
            list-style-type: none !important;
            overflow: visible !important;
            clip-path: none !important;
          }
          .page-1-footer span,
          .page-1-footer div {
            background: transparent !important;
            border: none !important;
          }
        `
      })
      
      // Additional wait to ensure styles are applied
      await page.waitForTimeout(500)
      
      // Execute JavaScript to remove any unwanted elements or styling
      await page.evaluate(() => {
        // Remove all ::marker pseudo-elements by forcing display style
        const style = document.createElement('style');
        style.textContent = `
          * { list-style: none !important; }
          *::marker { display: none !important; content: "" !important; }
        `;
        document.head.appendChild(style);
        
        // Force remove any list styling on all elements
        document.querySelectorAll('*').forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.listStyle = 'none';
            el.style.listStyleType = 'none';
            el.style.listStylePosition = 'outside';
            el.style.listStyleImage = 'none';
          }
        });
        
        // Special handling for footer elements
        const footer = document.querySelector('.page-1-footer');
        if (footer) {
          footer.querySelectorAll('*').forEach((el) => {
            if (el instanceof HTMLElement) {
              el.style.listStyle = 'none';
              el.style.listStyleType = 'none';
              el.style.background = 'transparent';
              el.style.border = 'none';
            }
          });
        }
      })
      
      // Wait a bit more to ensure JavaScript changes are applied
      await page.waitForTimeout(300)

      // Generate PDF with Playwright
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
      let filename = `Certificate_${certificateId}.pdf`
      try {
        const certRes = await fetch(`${baseUrl}/api/certificates/${certificateId}`)
        if (certRes.ok) {
          const cert = await certRes.json()
          if (cert?.no_certificate) {
            filename = `Certificate_${cert.no_certificate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
          }
        }
      } catch {
        // Use default filename
      }

      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': pdf.length.toString()
        }
      })
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    
    // Fallback: redirect to print page with download parameter
    const { id } = await params
    const certificateId = parseInt(id)
    const baseUrl = request.nextUrl.origin
    const printUrl = `${baseUrl}/certificates/${certificateId}/print?download=true`
    
    return NextResponse.redirect(printUrl)
  }
}
