/**
 * PDF Service Facade for the Flexible Certificate PDF Service.
 *
 * Orchestrates the full PDF generation pipeline:
 * 1. Fetch certificate data from Supabase
 * 2. Pre-checks (existing PDF, NIK availability)
 * 3. Initialize templates
 * 4. Determine certificate type
 * 5. Get template config from registry
 * 6. Render PDF via Playwright
 * 7. Sign with BSrE (if passphrase provided)
 * 8. Upload to Supabase Storage
 * 9. Update certificate record
 *
 * This is a parallel implementation to the existing `lib/certificate-pdf-helper.ts`.
 * API endpoints will be updated in a later task to point here.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

import {
  buildLocalPdfPath,
  isStoragePdfPath,
  uploadPdfToStorage,
} from '../certificate-pdf-storage'
import { initializeTemplates } from './templates'
import { determineCertificateType } from './type-determinator'
import { databaseTemplateSource } from './database-template-source'
import { createTemplateRenderer } from './template-renderer'
import { shouldUsePdfTemplateService, renderPdfViaTemplateService } from './pdf-template-client'
import { mapCertificateToTemplateData } from './certificate-data-mapper'
import { getActiveRichTextTemplate, getRichTextTemplateByVersion } from '../rich-text-editor/storage-service'
import type { PdfServiceResult } from './types'

// ─── Supabase Admin Client ───────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── BSrE Constants ──────────────────────────────────────────────────────────

const BSRE_SIGN_TIMEOUT_MS = 120_000
const BSRE_DOWNLOAD_TIMEOUT_MS = 120_000

// ─── BSrE Signing ────────────────────────────────────────────────────────────

/**
 * Signs a PDF buffer using the BSrE (Balai Sertifikasi Elektronik) API.
 *
 * Sends the PDF as multipart/form-data with NIK, passphrase, and signing parameters.
 * Handles multiple response formats: direct PDF, JSON with id_dokumen, base64 encoded.
 *
 * @param pdfBuffer - The unsigned PDF buffer
 * @param nik - The signer's NIK (Nomor Induk Kependudukan)
 * @param passphrase - The signer's BSrE passphrase
 * @param fileName - The PDF file name for the multipart upload
 * @param publicId - Optional public_id for QR link generation
 * @returns The signed PDF buffer
 * @throws Error with descriptive message on failure
 */
async function signPdfWithBsre(
  pdfBuffer: Buffer,
  nik: string,
  passphrase: string,
  fileName: string,
  publicId?: string | null
): Promise<Buffer> {
  const bsreBaseURL = process.env.BSRE_BASE_URL || 'http://172.19.2.171'
  const bsreUsername = process.env.BSRE_USERNAME!
  const bsrePassword = process.env.BSRE_PASSWORD!

  // Create Basic Auth header
  const credentials = Buffer.from(`${bsreUsername}:${bsrePassword}`).toString('base64')
  const authHeader = `Basic ${credentials}`

  // Build multipart/form-data body
  const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`
  const CRLF = '\r\n'
  const formDataParts: Buffer[] = []

  // Helper to add text field
  const addTextField = (name: string, value: string) => {
    formDataParts.push(Buffer.from(`--${boundary}${CRLF}`))
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`))
    formDataParts.push(Buffer.from(value))
    formDataParts.push(Buffer.from(CRLF))
  }

  // Add file field
  formDataParts.push(Buffer.from(`--${boundary}${CRLF}`))
  formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`))
  formDataParts.push(Buffer.from(`Content-Type: application/pdf${CRLF}${CRLF}`))
  formDataParts.push(pdfBuffer)
  formDataParts.push(Buffer.from(CRLF))

  // Add signing parameters
  addTextField('nik', nik)
  addTextField('passphrase', passphrase)
  addTextField('tampilan', 'invisible')
  addTextField('page', '1')
  addTextField('image', 'false')

  // QR link (for BSrE compatibility, though invisible mode may not use it)
  const publicBaseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || ''
  ).replace(/\/$/, '')

  const qrLink = publicId ? `${publicBaseUrl}/verify/${publicId}` : ''
  const linkQR = process.env.BSRE_QR_LINK || qrLink
  addTextField('linkQR', linkQR)
  addTextField('xAxis', '0')
  addTextField('yAxis', '0')
  addTextField('width', '0')
  addTextField('height', '0')

  // Close boundary
  formDataParts.push(Buffer.from(`--${boundary}--${CRLF}`))

  const formDataBody = Buffer.concat(formDataParts)

  // Send signing request
  const signEndpoint = `${bsreBaseURL}/api/sign/pdf`
  console.log(`[PDF Service] Calling BSrE sign endpoint: ${signEndpoint}`)
  console.log(`[PDF Service] Parameters: nik=${nik}, passphrase=***, tampilan=invisible, page=1, image=false`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BSRE_SIGN_TIMEOUT_MS)

  let signResponse: Response
  try {
    signResponse = await fetch(signEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formDataBody.length.toString(),
        'Accept': 'application/pdf, application/json',
      },
      body: formDataBody,
      signal: controller.signal,
    })
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    if (fetchError.name === 'AbortError') {
      throw new Error('BSRE_TIMEOUT: BSrE tidak merespons dalam batas waktu 120 detik.')
    }
    throw new Error(`BSRE_CONNECTION_FAILED: Gagal terhubung ke server BSrE. ${fetchError.message || ''}`)
  }

  clearTimeout(timeoutId)

  console.log(`[PDF Service] BSrE response status: ${signResponse.status}`)

  // Handle non-OK responses
  if (!signResponse.ok) {
    const errorText = await signResponse.text().catch(() => '')
    let errorDetail = errorText
    let bsreStatusCode: number | null = null

    try {
      const errJson = JSON.parse(errorText)
      bsreStatusCode = typeof errJson.status_code === 'number' ? errJson.status_code : null
      errorDetail = errJson.message || errJson.error || errJson.pesan || errorText
    } catch { /* not JSON */ }

    // Check BSrE account error codes
    const BSRE_ACCOUNT_ERROR_CODES = [2021, 2022, 2023, 4001, 4002, 4003]
    if (bsreStatusCode !== null && BSRE_ACCOUNT_ERROR_CODES.includes(bsreStatusCode)) {
      throw new Error(`NIK_INVALID_IN_BSRE: [${bsreStatusCode}] ${errorDetail}`)
    }

    // Check NIK-related errors
    const errorDetailLower = errorDetail.toLowerCase()
    const isNIKError =
      errorDetailLower.includes('nik') ||
      errorDetailLower.includes('sertifikat aktif') ||
      errorDetailLower.includes('belum memiliki sertifikat') ||
      errorDetailLower.includes('user not found') ||
      errorDetailLower.includes('pengguna tidak ditemukan') ||
      errorDetailLower.includes('user tidak ditemukan') ||
      errorDetailLower.includes('tidak terdaftar') ||
      errorDetailLower.includes('not registered') ||
      errorDetailLower.includes('unauthorized user') ||
      errorDetailLower.includes('identity') ||
      errorDetailLower.includes('identitas')

    if (isNIKError) {
      throw new Error(`NIK_INVALID_IN_BSRE: ${errorDetail}`)
    }

    // Check passphrase errors
    if (signResponse.status === 401 || signResponse.status === 400 || signResponse.status === 403) {
      const isPassphraseError =
        errorDetailLower.includes('passphrase') ||
        errorDetailLower.includes('password') ||
        errorDetailLower.includes('salah') ||
        errorDetailLower.includes('wrong') ||
        errorDetailLower.includes('invalid passphrase')

      if (isPassphraseError) {
        throw new Error(`Passphrase TTE salah. Silakan masukkan passphrase yang benar dan coba lagi. (HTTP ${signResponse.status})`)
      }

      throw new Error(`BSRE_SIGN_FAILED_HTTP_${signResponse.status}: ${errorDetail || 'BSrE menolak permintaan penandatanganan.'}`)
    }

    // Server errors (5xx)
    throw new Error(`Gagal menandatangani PDF (BSrE HTTP ${signResponse.status}). ${errorDetail || 'Silakan coba lagi nanti.'}`)
  }

  // Handle successful response (200)
  return await parseBsreSuccessResponse(signResponse, authHeader, bsreBaseURL)
}

/**
 * Parses a successful (HTTP 200) BSrE response.
 * Handles: direct PDF, JSON with id_dokumen, base64 encoded PDF.
 */
async function parseBsreSuccessResponse(
  response: Response,
  authHeader: string,
  bsreBaseURL: string
): Promise<Buffer> {
  const contentType = response.headers.get('content-type') || ''
  const responseArrayBuffer = await response.arrayBuffer()
  const responseBuffer = Buffer.from(responseArrayBuffer)

  // Helper: validate PDF magic bytes
  const isPdfBuffer = (buf: Buffer): boolean => {
    return buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-'
  }

  // Case 1: Response claims to be PDF
  if (contentType.includes('application/pdf')) {
    if (!isPdfBuffer(responseBuffer)) {
      // BSrE returned 200 with PDF content-type but body is NOT a PDF
      const bodyPreview = responseBuffer.slice(0, 500).toString('utf-8')
      try {
        const errJson = JSON.parse(responseBuffer.toString('utf-8'))
        const errMsg = errJson.message || errJson.error || errJson.pesan || errJson.status || JSON.stringify(errJson)
        throw new Error(`Passphrase TTE salah atau tidak valid: ${errMsg}`)
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Passphrase')) throw e
        throw new Error(`BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah. Body: ${bodyPreview.substring(0, 100)}`)
      }
    }
    console.log(`[PDF Service] ✅ PDF signed successfully by BSrE - Size: ${responseBuffer.length} bytes`)
    return responseBuffer
  }

  // Case 2: Response is JSON or text
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    const responseText = responseBuffer.toString('utf-8')

    try {
      const responseData = JSON.parse(responseText)

      // Check for explicit error indicators in JSON
      if (
        responseData.status === 'error' ||
        responseData.status === 'gagal' ||
        responseData.error ||
        responseData.pesan?.toLowerCase().includes('salah') ||
        responseData.pesan?.toLowerCase().includes('gagal') ||
        responseData.message?.toLowerCase().includes('invalid') ||
        responseData.message?.toLowerCase().includes('incorrect') ||
        responseData.message?.toLowerCase().includes('wrong')
      ) {
        const errMsg = responseData.pesan || responseData.message || responseData.error || 'Passphrase salah'
        const errMsgLower = errMsg.toLowerCase()

        // Check NIK errors first
        const isNikErrorInJson =
          errMsgLower.includes('nik') ||
          errMsgLower.includes('user not found') ||
          errMsgLower.includes('pengguna tidak ditemukan') ||
          errMsgLower.includes('tidak terdaftar') ||
          errMsgLower.includes('not registered') ||
          errMsgLower.includes('unauthorized user') ||
          errMsgLower.includes('identity') ||
          errMsgLower.includes('identitas')

        if (isNikErrorInJson) {
          throw new Error(`NIK_INVALID_IN_BSRE: ${errMsg}`)
        }

        throw new Error(`Passphrase TTE salah atau tidak valid: ${errMsg}`)
      }

      // Check if response contains id_dokumen (for download endpoint)
      if (responseData.id_dokumen || responseData.id || responseData.document_id) {
        const documentId = responseData.id_dokumen || responseData.id || responseData.document_id
        console.log(`[PDF Service] Document ID received: ${documentId}, downloading signed PDF...`)
        return await downloadSignedPdfFromBsre(documentId, authHeader, bsreBaseURL)
      }

      // Check for base64 encoded PDF
      if (responseData.pdf || responseData.signed_pdf) {
        const pdfBase64 = responseData.pdf || responseData.signed_pdf
        const decoded = Buffer.from(pdfBase64, 'base64')
        if (!isPdfBuffer(decoded)) {
          throw new Error('BSrE_DOWNLOAD_FAILED: Konten base64 dari BSrE bukan PDF yang valid.')
        }
        console.log(`[PDF Service] ✅ PDF signed successfully (from base64) - Size: ${decoded.length} bytes`)
        return decoded
      }

      // No recognizable data
      throw new Error(`BSrE mengembalikan response JSON tanpa data PDF. Response: ${responseText.substring(0, 200)}`)
    } catch (jsonError: any) {
      // Re-throw our own errors
      if (jsonError instanceof Error && (
        jsonError.message.startsWith('Passphrase') ||
        jsonError.message.startsWith('NIK_') ||
        jsonError.message.startsWith('BSrE')
      )) {
        throw jsonError
      }

      // Not valid JSON - maybe binary data served with wrong content-type?
      if (isPdfBuffer(responseBuffer)) {
        console.log(`[PDF Service] ✅ PDF signed successfully (binary disguised as text) - Size: ${responseBuffer.length} bytes`)
        return responseBuffer
      }

      throw new Error('BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah.')
    }
  }

  // Case 3: Unknown content-type - validate PDF magic bytes
  if (isPdfBuffer(responseBuffer)) {
    console.log(`[PDF Service] ✅ PDF signed successfully (binary, unknown content-type) - Size: ${responseBuffer.length} bytes`)
    return responseBuffer
  }

  // Could be an error response with wrong content-type
  const bodyPreview = responseBuffer.slice(0, 300).toString('utf-8')
  try {
    const errJson = JSON.parse(responseBuffer.toString('utf-8'))
    const errMsg = errJson.pesan || errJson.message || errJson.error || JSON.stringify(errJson)
    throw new Error(`Passphrase TTE salah atau tidak valid: ${errMsg}`)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Passphrase')) throw e
    throw new Error(`BSrE mengembalikan response tidak valid. Kemungkinan passphrase salah. Preview: ${bodyPreview.substring(0, 100)}`)
  }
}

/**
 * Downloads a signed PDF from BSrE using a document ID.
 */
async function downloadSignedPdfFromBsre(
  documentId: string,
  authHeader: string,
  bsreBaseURL: string
): Promise<Buffer> {
  const downloadEndpoint = `${bsreBaseURL}/api/sign/download/${documentId}`
  console.log(`[PDF Service] Downloading signed PDF from: ${downloadEndpoint}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BSRE_DOWNLOAD_TIMEOUT_MS)

  let downloadResponse: Response
  try {
    downloadResponse = await fetch(downloadEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/pdf',
      },
      signal: controller.signal,
    })
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    if (fetchError.name === 'AbortError') {
      throw new Error('BSRE_TIMEOUT: BSrE download tidak merespons dalam batas waktu.')
    }
    throw new Error(`BSRE_CONNECTION_FAILED: Gagal mengunduh PDF dari BSrE. ${fetchError.message || ''}`)
  }

  clearTimeout(timeoutId)

  if (!downloadResponse.ok) {
    const dlError = await downloadResponse.text().catch(() => '')
    const dlErrorLower = dlError.toLowerCase()

    if (dlErrorLower.includes('nik') || dlErrorLower.includes('user not found') || dlErrorLower.includes('tidak terdaftar')) {
      throw new Error(`NIK_INVALID_IN_BSRE: ${dlError}`)
    }
    if (downloadResponse.status === 401 || downloadResponse.status === 403 || dlErrorLower.includes('passphrase') || dlErrorLower.includes('salah')) {
      throw new Error(`Passphrase TTE salah atau tidak valid (download gagal HTTP ${downloadResponse.status}): ${dlError}`)
    }
    throw new Error(`BSrE_DOWNLOAD_FAILED: Gagal mengunduh PDF yang ditandatangani dari BSrE (HTTP ${downloadResponse.status}). ${dlError.substring(0, 200)}`)
  }

  const downloadBuf = Buffer.from(await downloadResponse.arrayBuffer())

  // Validate PDF magic bytes
  const isPdfBuffer = (buf: Buffer): boolean => {
    return buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-'
  }

  if (!isPdfBuffer(downloadBuf)) {
    const bodyStr = downloadBuf.slice(0, 300).toString('utf-8')
    try {
      const errJson = JSON.parse(bodyStr)
      const errMsg = errJson.pesan || errJson.message || errJson.error || bodyStr
      const errMsgL = errMsg.toLowerCase()
      if (errMsgL.includes('nik') || errMsgL.includes('user not found') || errMsgL.includes('tidak terdaftar')) {
        throw new Error(`NIK_INVALID_IN_BSRE: ${errMsg}`)
      }
      throw new Error(`Passphrase TTE salah atau tidak valid: ${errMsg}`)
    } catch (e) {
      if (e instanceof Error && (e.message.startsWith('NIK_') || e.message.startsWith('Passphrase'))) throw e
      throw new Error(`BSrE_DOWNLOAD_FAILED: File yang diunduh bukan PDF yang valid. Preview: ${bodyStr.substring(0, 100)}`)
    }
  }

  console.log(`[PDF Service] ✅ PDF downloaded and signed successfully - Size: ${downloadBuf.length} bytes`)
  return downloadBuf
}

// ─── PDF Service Facade ──────────────────────────────────────────────────────

/**
 * Generate PDF for certificate and save to Supabase Storage.
 *
 * Drop-in replacement for the existing `generateAndSaveCertificatePDF` in
 * `lib/certificate-pdf-helper.ts`. Same signature, same return type.
 *
 * Pipeline:
 * 1. Fetch certificate data from Supabase
 * 2. Pre-check: return early if PDF already exists (when no passphrase)
 * 3. Pre-check: fetch NIK, fail fast if missing and BSrE is configured
 * 4. Initialize templates (idempotent)
 * 5. Determine certificate type
 * 6. Get template config from registry
 * 7. Render PDF via template renderer
 * 8. Sign with BSrE (if passphrase provided)
 * 9. Upload to Supabase Storage
 * 10. Update certificate record
 *
 * @param certificateId - The certificate ID to generate PDF for
 * @param userId - The user ID (authorized_by) to get NIK from personel table
 * @param passphrase - The passphrase for BSrE signing
 * @param simulateSigned - If true, render with visual signature without BSrE
 */
export async function generateAndSaveCertificatePDF(
  certificateId: number,
  userId?: string,
  passphrase?: string,
  simulateSigned: boolean = false
): Promise<PdfServiceResult> {
  try {
    // ─── Step 1: Fetch certificate data ──────────────────────────────────
    const { data: certData, error: certError } = await supabaseAdmin
      .from('certificate')
      .select('pdf_path, no_certificate, authorized_by, public_id, calibration_place, calibration_kind, balai_id, is_standard, certificate_type, template_version')
      .eq('id', certificateId)
      .single()

    if (certError || !certData) {
      console.error(`[PDF Service] Failed to fetch certificate ${certificateId}:`, certError)
      return { success: false, error: `Certificate not found: ${certError?.message || 'No data'}` }
    }

    // Get userId from certificate if not provided
    const authorizedByUserId = userId || certData.authorized_by

    // ─── Step 2: Pre-check NIK ───────────────────────────────────────────
    let nik: string | null = null
    if (authorizedByUserId) {
      try {
        const { data: personelData, error: personelError } = await supabaseAdmin
          .from('personel')
          .select('nik')
          .eq('id', authorizedByUserId)
          .single()

        if (!personelError && personelData?.nik) {
          nik = personelData.nik
          console.log(`[PDF Service] Found NIK for user ${authorizedByUserId}`)
        } else {
          console.warn(`[PDF Service] NIK not found for user ${authorizedByUserId}`)
        }
      } catch (nikError: any) {
        console.error(`[PDF Service] Error fetching NIK:`, nikError)
      }
    }

    // Fail fast if NIK is missing and BSrE is configured
    const bsreUsername = process.env.BSRE_USERNAME
    const bsrePassword = process.env.BSRE_PASSWORD
    if (bsreUsername && bsrePassword && !nik) {
      console.error('[PDF Service] NIK not available, cannot sign PDF. Aborting generation.')
      return { success: false, error: 'NIK_NOT_FOUND_IN_DB' }
    }

    // ─── Step 3: Pre-check existing PDF ──────────────────────────────────
    // Only skip regeneration if no passphrase is provided.
    // If passphrase IS provided, we must always go through BSrE signing to validate it.
    if (!passphrase && certData.pdf_path) {
      if (isStoragePdfPath(certData.pdf_path)) {
        console.log(`[PDF Service] PDF already exists in storage for certificate ${certificateId}: ${certData.pdf_path}`)
        return { success: true, pdfPath: certData.pdf_path }
      }

      // Check if file exists in local filesystem
      const localPath = buildLocalPdfPath(certData.pdf_path)
      if (fs.existsSync(localPath)) {
        console.log(`[PDF Service] PDF already exists locally for certificate ${certificateId}: ${certData.pdf_path}`)
        return { success: true, pdfPath: certData.pdf_path }
      }
    }

    console.log(`[PDF Service] Generating PDF for certificate ${certificateId}...`)

    // ─── Step 4: Initialize templates ────────────────────────────────────
    initializeTemplates()

    // ─── Step 5: Determine certificate type ──────────────────────────────
    const certificateType = determineCertificateType(
      {
        calibration_place: certData.calibration_place,
        calibration_kind: certData.calibration_kind,
        balai_id: certData.balai_id,
        is_standard: certData.is_standard,
        certificate_type: certData.certificate_type,
      },
      certificateId
    )
    console.log(`[PDF Service] Determined certificate type: ${certificateType}`)

    // ─── Step 6: Get template config ─────────────────────────────────────
    let config
    let usedTemplateVersion: number | null = null
    try {
      const templateResult = await databaseTemplateSource.getTemplateConfig(
        certificateType,
        certData.template_version ?? null
      )
      config = templateResult.config
      usedTemplateVersion = templateResult.version
    } catch (templateError: any) {
      console.error(`[PDF Service] Template lookup failed:`, templateError.message)
      return { success: false, error: templateError.message }
    }

    // ─── Step 6b: Check if Python PDF Template Service should be used ────
    // Fetch the raw template record to check for cover_template_path
    let templateRecord: any = null
    try {
      if (certData.template_version != null) {
        templateRecord = await getRichTextTemplateByVersion(certificateType, certData.template_version)
      }
      if (!templateRecord) {
        templateRecord = await getActiveRichTextTemplate(certificateType)
      }
    } catch (e: any) {
      // Non-fatal: if we can't fetch the record, we'll fall through to Playwright
      console.warn(`[PDF Service] Could not fetch template record for Python service check: ${e.message}`)
    }

    // ─── Step 7: Render PDF ──────────────────────────────────────────────
    let pdfBuffer!: Buffer
    let pdfFileName!: string
    let usedPythonService = false

    if (templateRecord && shouldUsePdfTemplateService(templateRecord)) {
      // ─── Route A: Python PDF Template Service ──────────────────────────
      console.log(`[PDF Service] Routing to Python PDF Template Service (cover_template_path: ${templateRecord.cover_template_path})`)

      let pythonServiceSuccess = false
      try {
        // Fetch full certificate data with relations for the mapper
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

        if (fullCertError || !fullCert) {
          console.warn(`[PDF Service] Failed to fetch full certificate for Python service, falling back to Playwright`)
        } else {
          const templateData = mapCertificateToTemplateData(fullCert)
          pdfBuffer = await renderPdfViaTemplateService(templateRecord.id, templateData)

          const certNumber = certData.no_certificate || ''
          const safeNumber = certNumber.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
          pdfFileName = `certificate_${safeNumber}_${certificateId}.pdf`

          console.log(`[PDF Service] PDF rendered via Python service: ${pdfBuffer.length} bytes`)
          pythonServiceSuccess = true
          usedPythonService = true
        }
      } catch (pythonServiceError: any) {
        console.warn(`[PDF Service] Python service failed, falling back to Playwright: ${pythonServiceError.message}`)
      }

      // Fallback to Playwright if Python service failed
      if (!pythonServiceSuccess) {
        const renderer = createTemplateRenderer()
        const renderResult = await renderer.render(certificateId, config, {
          simulateSigned,
          certificateNumber: certData.no_certificate || undefined,
        })
        pdfBuffer = renderResult.pdfBuffer
        pdfFileName = renderResult.metadata.fileName
        console.log(`[PDF Service] PDF rendered via Playwright (fallback): ${renderResult.metadata.fileSize} bytes`)
      }
    } else {
      // ─── Route B: Playwright-based rendering ───────────────────────────
      const renderer = createTemplateRenderer()
      const renderResult = await renderer.render(certificateId, config, {
        simulateSigned,
        certificateNumber: certData.no_certificate || undefined,
      })
      pdfBuffer = renderResult.pdfBuffer
      pdfFileName = renderResult.metadata.fileName
      console.log(`[PDF Service] PDF rendered via Playwright: ${renderResult.metadata.fileSize} bytes, type: ${renderResult.metadata.certificateType}`)
    }

    // ─── Step 8: Sign with BSrE (if passphrase provided) ─────────────────
    if (!pdfBuffer || !pdfFileName) {
      return { success: false, error: 'PDF_GENERATION_FAILED' }
    }

    let finalPdfBuffer = pdfBuffer
    let signed = false

    if (passphrase && bsreUsername && bsrePassword) {
      if (!nik) {
        return { success: false, error: 'NIK_NOT_FOUND_IN_DB' }
      }

      try {
        console.log(`[PDF Service] Sending PDF to BSrE for signing...`)
        finalPdfBuffer = await signPdfWithBsre(
          pdfBuffer,
          nik,
          passphrase,
          pdfFileName,
          certData.public_id
        )
        signed = true
        console.log(`[PDF Service] PDF signed successfully: ${finalPdfBuffer.length} bytes`)
      } catch (signError: any) {
        console.error(`[PDF Service] BSrE signing failed:`, signError.message)
        return { success: false, error: signError.message }
      }
    } else if (passphrase && (!bsreUsername || !bsrePassword)) {
      console.warn('[PDF Service] BSrE credentials not configured, skipping signature')
    }

    // ─── Step 9: Upload to Supabase Storage ──────────────────────────────
    let persistedPdfPath: string
    try {
      persistedPdfPath = await uploadPdfToStorage(
        supabaseAdmin as any,
        finalPdfBuffer,
        pdfFileName
      )
      console.log(`[PDF Service] PDF uploaded to storage: ${persistedPdfPath}`)
    } catch (storageError: any) {
      console.error('[PDF Service] Failed to upload PDF to storage:', storageError)
      return { success: false, error: `Storage upload failed: ${storageError.message}` }
    }

    // ─── Step 10: Update certificate record ──────────────────────────────
    const updatePayload: Record<string, any> = {
      pdf_path: persistedPdfPath,
      pdf_generated_at: new Date().toISOString(),
    }

    // Record the template version used for this certificate (Requirement 6.4)
    if (usedTemplateVersion != null && !certData.template_version) {
      updatePayload.template_version = usedTemplateVersion
    }

    const { error: updateError } = await supabaseAdmin
      .from('certificate')
      .update(updatePayload)
      .eq('id', certificateId)

    if (updateError) {
      console.error('[PDF Service] Failed to update certificate record:', updateError)
      return { success: false, error: updateError.message }
    }

    console.log(`[PDF Service] ✅ PDF generated and saved: ${persistedPdfPath}${signed ? ' (Signed by BSrE)' : ''}${usedPythonService ? ' (via Python service)' : ''}`)
    return { success: true, pdfPath: persistedPdfPath, signed }
  } catch (error: any) {
    console.error('[PDF Service] Unexpected error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
