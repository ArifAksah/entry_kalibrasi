import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = parseInt(id)

    if (isNaN(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
    }

    // Dynamic import puppeteer to handle cases where it's not installed
    let puppeteer: any
    try {
      // Dynamic import with require for server-side only
      puppeteer = await import('puppeteer')
    } catch (importError) {
      console.error('Puppeteer not available, using fallback method:', importError)
      // Fallback: redirect to print page with download parameter
      const baseUrl = request.nextUrl.origin
      const printUrl = `${baseUrl}/certificates/${certificateId}/print?download=true`
      return NextResponse.redirect(printUrl)
    }

    // Get base URL
    const baseUrl = request.nextUrl.origin
    const printUrl = `${baseUrl}/certificates/${certificateId}/print?pdf=true`

    // Launch browser with new headless mode
    const browser = await puppeteer.default.launch({
      headless: 'new', // Use new headless mode to avoid deprecation warning
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
      const page = await browser.newPage()

      // Set viewport to A4 size
      await page.setViewport({
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        deviceScaleFactor: 2 // Higher quality
      })

      // Navigate to print page
      await page.goto(printUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      })

      // Wait for all content to load, especially QR codes
      await page.waitForTimeout(3000) // Wait for QR codes and dynamic content

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

      // Ensure filename always ends with .pdf
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename = `${filename}.pdf`
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
