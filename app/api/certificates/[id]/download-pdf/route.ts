import { NextRequest, NextResponse } from 'next/server'
import { authorizeCertificateAccess } from '../../../../../lib/certificate-access'
import { initializeTemplates } from '../../../../../lib/pdf-service/templates'
import { determineCertificateType } from '../../../../../lib/pdf-service/type-determinator'
import { defaultRegistry } from '../../../../../lib/pdf-service/template-registry'
import { createTemplateRenderer } from '../../../../../lib/pdf-service/template-renderer'
import { shouldUsePdfTemplateService, renderPdfViaTemplateService } from '../../../../../lib/pdf-service/pdf-template-client'
import { mapCertificateToTemplateData } from '../../../../../lib/pdf-service/certificate-data-mapper'
import { getActiveRichTextTemplate } from '../../../../../lib/rich-text-editor/storage-service'
import { createClient } from '@supabase/supabase-js'

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
    const certificate = access.certificate

    // Determine certificate type from certificate data
    const certificateType = determineCertificateType({
      calibration_place: certificate.calibration_place,
      calibration_kind: certificate.calibration_kind,
      balai_id: certificate.balai_id,
      is_standard: certificate.is_standard,
      certificate_type: certificate.certificate_type,
    })

    // Build filename from certificate number
    let filename = `Certificate_${certificateId}.pdf`
    if (certificate?.no_certificate) {
      filename = `Certificate_${certificate.no_certificate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    }

    // ─── Try Python PDF Template Service first ─────────────────────────────
    let templateRecord: any = null
    try {
      templateRecord = await getActiveRichTextTemplate(certificateType)
    } catch (e: any) {
      console.warn(`[download-pdf] Could not fetch template record: ${e.message}`)
    }

    if (templateRecord && shouldUsePdfTemplateService(templateRecord)) {
      console.log(`[download-pdf] Using Python PDF Template Service for certificate ${certificateId}`)

      try {
        // Fetch full certificate with relations
        const { data: fullCert, error: fullCertError } = await supabaseAdmin
          .from('certificate')
          .select(`
            *,
            instrument:instrument_id(*),
            station:station_id(*),
            sensors:certificate_sensor(*, sensor:sensor_id(*), results:calibration_result(*))
          `)
          .eq('id', certificateId)
          .single()

        if (!fullCertError && fullCert) {
          const templateData = mapCertificateToTemplateData(fullCert)
          const pdfBuffer = await renderPdfViaTemplateService(templateRecord.id, templateData)

          console.log(`[download-pdf] PDF rendered via Python service: ${pdfBuffer.length} bytes`)

          return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          })
        }
      } catch (pythonError: any) {
        console.warn(`[download-pdf] Python service failed, falling back to Playwright: ${pythonError.message}`)
      }
    }

    // ─── Fallback: Playwright-based rendering ──────────────────────────────
    initializeTemplates()

    let config
    try {
      config = defaultRegistry.get(certificateType)
    } catch (registryError: any) {
      console.error(`[download-pdf] Template lookup failed for type "${certificateType}":`, registryError.message)
      return NextResponse.json({ error: `Template not found: ${registryError.message}` }, { status: 500 })
    }

    const renderer = createTemplateRenderer()
    let renderResult
    try {
      renderResult = await renderer.render(certificateId, config, {
        certificateNumber: certificate.no_certificate || undefined,
      })
    } catch (renderError: any) {
      console.error(`[download-pdf] PDF rendering failed for certificate ${certificateId}:`, renderError.message)

      // Fallback: redirect to print page with download parameter
      const baseUrl = request.nextUrl.origin
      const printUrl = `${baseUrl}/certificates/${certificateId}/print?download=true`
      return NextResponse.redirect(printUrl)
    }

    const pdfBytes = new Uint8Array(renderResult.pdfBuffer)

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': renderResult.pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('[download-pdf] Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
