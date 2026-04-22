import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isStoragePdfPath, tryDownloadPdfByFileNameFromStorage, tryReadLocalPdf } from '../../../../../lib/certificate-pdf-storage'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * GET endpoint to view/download PDF for a certificate
 * This returns the PDF file that was generated when level 3 verification was approved
 * PDF is stored in local filesystem at e-certificate-signed folder
 */
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

    // Get certificate with PDF path
    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, pdf_path, pdf_generated_at')
      .eq('id', certificateId)
      .single()

    if (certError || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (!cert.pdf_path) {
      return NextResponse.json({ 
        error: 'PDF not yet generated. PDF will be generated automatically when level 3 verification is approved.',
        certificate_id: certificateId
      }, { status: 404 })
    }

    const fileName = cert.pdf_path.split('/').pop() || `certificate_${certificateId}.pdf`

    console.log(`[PDF Download] Certificate ID: ${certificateId}`)
    console.log(`[PDF Download] PDF path from DB: ${cert.pdf_path}`)

    let buffer: Buffer | null = null
    if (isStoragePdfPath(cert.pdf_path)) {
      try {
        const { downloadPdfFromStorage } = await import('../../../../../lib/certificate-pdf-storage')
        buffer = await downloadPdfFromStorage(supabaseAdmin as any, cert.pdf_path)
        console.log('[PDF Download] Loaded PDF from Supabase Storage')
      } catch (storageError) {
        console.error('[PDF Download] Failed to load PDF from storage path:', storageError)
      }
    } else {
      buffer = tryReadLocalPdf(cert.pdf_path)
      if (!buffer) {
        buffer = await tryDownloadPdfByFileNameFromStorage(supabaseAdmin as any, fileName)
        if (buffer) {
          console.log('[PDF Download] Local file missing, recovered PDF from Supabase Storage fallback')
        }
      } else {
        console.log('[PDF Download] Loaded PDF from local filesystem')
      }
    }

    if (!buffer) {
      return NextResponse.json({ 
        error: 'PDF yang ditandatangani tidak ditemukan di storage production maupun filesystem lokal.',
        pdf_path: cert.pdf_path,
        file_name: fileName
      }, { status: 404 })
    }

    console.log(`[PDF Download] File read successfully - Size: ${buffer.length} bytes`)

    if (buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
      console.error('[PDF Download] Retrieved file is not a valid PDF')
      return NextResponse.json({
        error: 'File yang tersimpan bukan PDF yang valid.',
        pdf_path: cert.pdf_path,
        file_name: fileName
      }, { status: 500 })
    }

    // Get filename from certificate number
    const certificateNumber = cert.no_certificate || String(certificateId)
    const safeFileName = certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `Certificate_${safeFileName}.pdf`

    // Return PDF with appropriate headers
    // Check if request wants to download (has ?download=true query param) or view inline
    const searchParams = request.nextUrl.searchParams
    const isDownload = searchParams.get('download') === 'true'
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('[PDF View] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to retrieve PDF',
      details: error.message 
    }, { status: 500 })
  }
}

