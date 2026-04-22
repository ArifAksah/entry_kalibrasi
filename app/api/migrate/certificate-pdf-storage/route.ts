import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildStoragePdfPath,
  isStoragePdfPath,
  tryReadLocalPdf,
  uploadPdfToStorage,
} from '../../../../lib/certificate-pdf-storage'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, pdf_path, status, pdf_generated_at')
      .not('pdf_path', 'is', null)
      .order('id', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data || []).map((cert: any) => {
      const fileName = cert.pdf_path ? cert.pdf_path.split('/').pop() : null
      const localBuffer = cert.pdf_path ? tryReadLocalPdf(cert.pdf_path) : null
      return {
        id: cert.id,
        no_certificate: cert.no_certificate,
        status: cert.status,
        pdf_path: cert.pdf_path,
        is_storage_path: isStoragePdfPath(cert.pdf_path),
        expected_storage_path: fileName ? buildStoragePdfPath(fileName) : null,
        local_exists: Boolean(localBuffer),
      }
    })

    return NextResponse.json({
      total: rows.length,
      storageBacked: rows.filter(r => r.is_storage_path).length,
      legacyLocalPath: rows.filter(r => !r.is_storage_path).length,
      rows,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to inspect certificate PDFs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const certificateId = body?.certificateId ? Number(body.certificateId) : null
    const limit = body?.limit ? Number(body.limit) : null

    let query = supabaseAdmin
      .from('certificate')
      .select('id, no_certificate, pdf_path')
      .not('pdf_path', 'is', null)
      .order('id', { ascending: true })

    if (certificateId) {
      query = query.eq('id', certificateId)
    }

    if (limit && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results: Array<Record<string, any>> = []

    for (const cert of data || []) {
      if (!cert.pdf_path) continue

      if (isStoragePdfPath(cert.pdf_path)) {
        results.push({
          id: cert.id,
          no_certificate: cert.no_certificate,
          status: 'skipped',
          reason: 'already_on_storage',
          pdf_path: cert.pdf_path,
        })
        continue
      }

      const localBuffer = tryReadLocalPdf(cert.pdf_path)
      if (!localBuffer) {
        results.push({
          id: cert.id,
          no_certificate: cert.no_certificate,
          status: 'failed',
          reason: 'local_file_missing',
          pdf_path: cert.pdf_path,
        })
        continue
      }

      if (localBuffer.slice(0, 5).toString('ascii') !== '%PDF-') {
        results.push({
          id: cert.id,
          no_certificate: cert.no_certificate,
          status: 'failed',
          reason: 'invalid_local_pdf',
          pdf_path: cert.pdf_path,
        })
        continue
      }

      const fileName = cert.pdf_path.split('/').pop() || `certificate_${cert.id}.pdf`

      try {
        const storagePath = await uploadPdfToStorage(supabaseAdmin as any, localBuffer, fileName)
        const { error: updateError } = await supabaseAdmin
          .from('certificate')
          .update({ pdf_path: storagePath })
          .eq('id', cert.id)

        if (updateError) {
          results.push({
            id: cert.id,
            no_certificate: cert.no_certificate,
            status: 'failed',
            reason: 'db_update_failed',
            details: updateError.message,
            pdf_path: cert.pdf_path,
            storage_path: storagePath,
          })
          continue
        }

        results.push({
          id: cert.id,
          no_certificate: cert.no_certificate,
          status: 'migrated',
          previous_pdf_path: cert.pdf_path,
          storage_path: storagePath,
        })
      } catch (storageError: any) {
        results.push({
          id: cert.id,
          no_certificate: cert.no_certificate,
          status: 'failed',
          reason: 'storage_upload_failed',
          details: storageError?.message || 'unknown error',
          pdf_path: cert.pdf_path,
        })
      }
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      migrated: results.filter(r => r.status === 'migrated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 })
  }
}
