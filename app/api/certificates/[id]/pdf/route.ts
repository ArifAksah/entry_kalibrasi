import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

    // Build local file path
    const fileName = path.basename(cert.pdf_path)
    const filePath = path.join(process.cwd(), 'e-certificate-signed', fileName)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('[PDF View] File not found:', filePath)
      return NextResponse.json({ 
        error: 'PDF file not found in local storage',
        pdf_path: cert.pdf_path,
        file_path: filePath
      }, { status: 404 })
    }

    // Read PDF file from local filesystem
    const buffer = fs.readFileSync(filePath)

    // Get filename from certificate number
    const certificateNumber = cert.no_certificate || String(certificateId)
    const safeFileName = certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `Certificate_${safeFileName}.pdf`

    // Return PDF with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
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

