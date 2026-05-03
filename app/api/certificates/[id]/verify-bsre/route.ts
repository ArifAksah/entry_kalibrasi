import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isStoragePdfPath, tryDownloadPdfByFileNameFromStorage, tryReadLocalPdf } from '../../../../../lib/certificate-pdf-storage'
import { authorizeCertificateAccess } from '../../../../../lib/certificate-access'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(
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

        // 1. Get certificate info
        const { data: cert, error: certError } = await supabaseAdmin
            .from('certificate')
            .select('id, pdf_path, no_certificate')
            .eq('id', certificateId)
            .single()

        if (certError || !cert) {
            return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
        }

        if (!cert.pdf_path) {
            return NextResponse.json({ error: 'Certificate has not been signed yet (No PDF)' }, { status: 400 })
        }

        const fileName = cert.pdf_path.split('/').pop() || `certificate_${certificateId}.pdf`

        let fileBuffer: Buffer | null = null
        if (isStoragePdfPath(cert.pdf_path)) {
            try {
                const { downloadPdfFromStorage } = await import('../../../../../lib/certificate-pdf-storage')
                fileBuffer = await downloadPdfFromStorage(supabaseAdmin as any, cert.pdf_path)
            } catch (storageError) {
                console.error('[BSrE Verify] Failed to load storage PDF:', storageError)
            }
        } else {
            fileBuffer = tryReadLocalPdf(cert.pdf_path)
            if (!fileBuffer) {
                fileBuffer = await tryDownloadPdfByFileNameFromStorage(supabaseAdmin as any, fileName)
            }
        }

        if (!fileBuffer) {
            return NextResponse.json({ error: 'Signed PDF file not found on server or storage' }, { status: 404 })
        }

        // 4. Send to BSrE
        const bsreBaseURL = process.env.BSRE_BASE_URL || 'http://172.19.2.171'
        const verifyEndpoint = `${bsreBaseURL}/api/sign/verify`
        const bsreUsername = process.env.BSRE_USERNAME
        const bsrePassword = process.env.BSRE_PASSWORD

        // Create Basic Auth header
        let authHeader = ''
        if (bsreUsername && bsrePassword) {
            const credentials = Buffer.from(`${bsreUsername}:${bsrePassword}`).toString('base64')
            authHeader = `Basic ${credentials}`
        }

        // Create boundary
        const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`

        // Build multipart body manually
        const parts: Buffer[] = []
        const CRLF = '\r\n'

        // File part
        parts.push(Buffer.from(`--${boundary}${CRLF}`))
        parts.push(Buffer.from(`Content-Disposition: form-data; name="signed_file"; filename="${fileName}"${CRLF}`))
        parts.push(Buffer.from(`Content-Type: application/pdf${CRLF}${CRLF}`))
        parts.push(fileBuffer)
        parts.push(Buffer.from(CRLF))

        // Close boundary
        parts.push(Buffer.from(`--${boundary}--${CRLF}`))

        const body = Buffer.concat(parts)

        console.log(`[BSrE Verify] Verifying certificate ${certificateId} at ${verifyEndpoint}`)

        const headers: Record<string, string> = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString()
        }

        if (authHeader) {
            headers['Authorization'] = authHeader
        }

        const response = await fetch(verifyEndpoint, {
            method: 'POST',
            headers: headers,
            body: body
        })

        const responseText = await response.text()
        let result

        try {
            result = JSON.parse(responseText)
        } catch (e) {
            console.error(`[BSrE Verify] Failed to parse JSON. Status: ${response.status}. Response preview: ${responseText.substring(0, 200)}...`)
            return NextResponse.json({
                error: 'Invalid response from BSrE server',
                details: 'Server returned non-JSON response (likely HTML error page).',
                status: response.status,
                raw_response_preview: responseText.substring(0, 500)
            }, { status: response.ok ? 502 : response.status })
        }

        if (!response.ok) {
            console.error(`[BSrE Verify] Failed: ${response.status} - ${JSON.stringify(result)}`)
            return NextResponse.json({
                error: 'BSrE Verification Failed',
                details: result,
                status: response.status
            }, { status: response.status })
        }

        console.log(`[BSrE Verify] Success:`, result)
        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[BSrE Verify] Internal Error:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message
        }, { status: 500 })
    }
}
