import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildLocalPdfPath,
  buildStoragePdfPath,
  downloadPdfFromStorage,
  isStoragePdfPath,
  tryReadLocalPdf,
} from '../../../../../lib/certificate-pdf-storage'
import { authorizeCertificateAccess } from '../../../../../lib/certificate-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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

    const access = await authorizeCertificateAccess(request, certificateId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { data: cert, error } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, pdf_path, pdf_generated_at, status')
      .eq('id', certificateId)
      .single()

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const pdfPath = cert.pdf_path || null
    const fileName = pdfPath ? pdfPath.split('/').pop() || null : null
    const localPath = fileName ? buildLocalPdfPath(fileName) : null

    const localBuffer = pdfPath ? tryReadLocalPdf(pdfPath) : null
    const localExists = Boolean(localBuffer)
    const localIsPdf = localBuffer ? localBuffer.slice(0, 5).toString('ascii') === '%PDF-' : false

    let storageExists = false
    let storageIsPdf = false
    let storagePathTried: string | null = null

    if (pdfPath) {
      const storagePath = isStoragePdfPath(pdfPath)
        ? pdfPath
        : fileName
          ? buildStoragePdfPath(fileName)
          : null

      if (storagePath) {
        storagePathTried = storagePath
        try {
          const buffer = await downloadPdfFromStorage(supabaseAdmin as any, storagePath)
          storageExists = true
          storageIsPdf = buffer.slice(0, 5).toString('ascii') === '%PDF-'
        } catch {
          storageExists = false
        }
      }
    }

    return NextResponse.json({
      certificate: {
        id: cert.id,
        no_certificate: cert.no_certificate,
        status: cert.status,
        pdf_path: cert.pdf_path,
        pdf_generated_at: cert.pdf_generated_at,
      },
      path_info: {
        is_storage_path: isStoragePdfPath(pdfPath),
        file_name: fileName,
        local_path: localPath,
        storage_path_tried: storagePathTried,
      },
      local: {
        exists: localExists,
        valid_pdf: localIsPdf,
        size_bytes: localBuffer?.length || 0,
      },
      storage: {
        exists: storageExists,
        valid_pdf: storageIsPdf,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Debug check failed' }, { status: 500 })
  }
}
