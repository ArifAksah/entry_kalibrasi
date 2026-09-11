import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveCertificatePDF } from '../../../lib/certificate-pdf-helper'
import fs from 'fs'
import path from 'path'
import { clientSafeMessage } from '../../../lib/api-error'

/**
 * Test endpoint to manually trigger PDF generation
 * Usage: POST /api/test-pdf-generation with body: { certificateId: 1 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { certificateId } = body

    if (!certificateId) {
      return NextResponse.json({ error: 'certificateId is required' }, { status: 400 })
    }

    console.log(`[Test PDF] Starting PDF generation test for certificate ${certificateId}...`)

    // Check current working directory
    const cwd = process.cwd()
    const storageDir = path.join(cwd, 'e-certificate-signed')
    
    console.log(`[Test PDF] Current working directory: ${cwd}`)
    console.log(`[Test PDF] Storage directory: ${storageDir}`)
    console.log(`[Test PDF] Storage directory exists: ${fs.existsSync(storageDir)}`)

    // Generate PDF
    const result = await generateAndSaveCertificatePDF(certificateId)

    if (result.success) {
      // Verify file exists
      const fileName = path.basename(result.pdfPath || '')
      const filePath = path.join(storageDir, fileName)
      const fileExists = fs.existsSync(filePath)
      
      let fileSize = 0
      if (fileExists) {
        const stats = fs.statSync(filePath)
        fileSize = stats.size
      }

      return NextResponse.json({
        success: true,
        message: 'PDF generated successfully',
        fileExists: fileExists,
        fileSize: fileSize,
        storageDirectoryExists: fs.existsSync(storageDir)
      })
    } else {
      return NextResponse.json({
        success: false,
        error: clientSafeMessage(result.error, 'PDF gagal dibuat.'),
        storageDirectoryExists: fs.existsSync(storageDir)
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Test PDF] Error:', error)
    return NextResponse.json({
      success: false,
      error: clientSafeMessage(error, 'PDF gagal dibuat.')
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check storage directory status
 */
export async function GET() {
  try {
    const storageDir = path.join(process.cwd(), 'e-certificate-signed')
    const dirExists = fs.existsSync(storageDir)
    
    let fileCount = 0
    if (dirExists) {
      fileCount = fs.readdirSync(storageDir).filter(f => f.endsWith('.pdf')).length
    }

    return NextResponse.json({
      directoryExists: dirExists,
      fileCount
    })
  } catch (error: any) {
    return NextResponse.json({
      error: clientSafeMessage(error, 'Status penyimpanan PDF tidak dapat diperiksa.')
    }, { status: 500 })
  }
}
