import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveCertificatePDF } from '../../../lib/certificate-pdf-helper'
import fs from 'fs'
import path from 'path'

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
        pdfPath: result.pdfPath,
        filePath: filePath,
        fileExists: fileExists,
        fileSize: fileSize,
        storageDirectory: storageDir,
        storageDirectoryExists: fs.existsSync(storageDir)
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        storageDirectory: storageDir,
        storageDirectoryExists: fs.existsSync(storageDir)
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Test PDF] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check storage directory status
 */
export async function GET() {
  try {
    const cwd = process.cwd()
    const storageDir = path.join(cwd, 'e-certificate-signed')
    const dirExists = fs.existsSync(storageDir)
    
    let files: string[] = []
    if (dirExists) {
      files = fs.readdirSync(storageDir).filter(f => f.endsWith('.pdf'))
    }

    return NextResponse.json({
      currentWorkingDirectory: cwd,
      storageDirectory: storageDir,
      directoryExists: dirExists,
      fileCount: files.length,
      files: files
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

