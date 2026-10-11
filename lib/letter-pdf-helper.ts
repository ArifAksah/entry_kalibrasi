import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { buildLocalPdfPath, isStoragePdfPath, uploadPdfToStorage } from './certificate-pdf-storage'
import { createPdfRenderToken } from './pdf-render-token'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const STORAGE_DIR = 'e-letter-signed'

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function isPdfBuffer(buf: Buffer) {
  return buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-'
}

/**
 * Render halaman /letters/[id]/print dengan Playwright, lalu tandatangani via BSrE
 * dan simpan ke letter.pdf_path. Mengikuti pola lib/certificate-pdf-helper.ts.
 */
export async function generateAndSaveLetterPDF(
  letterId: number,
  userId?: string,
  passphrase?: string,
  simulateSigned = false,
): Promise<{ success: boolean; pdfPath?: string; error?: string; signed?: boolean }> {
  try {
    const { data: existingLetter } = await supabaseAdmin
      .from('letter')
      .select('pdf_path, no_letter, authorized_by, public_id')
      .eq('id', letterId)
      .single()

    const authorizedByUserId = userId || existingLetter?.authorized_by

    let nik: string | null = null
    if (authorizedByUserId) {
      const { data: personel } = await supabaseAdmin
        .from('personel')
        .select('nik')
        .eq('id', authorizedByUserId)
        .maybeSingle()
      nik = personel?.nik ?? null
    }

    const bsreBaseURL = (process.env.BSRE_BASE_URL || 'http://172.19.0.243').replace(/\/$/, '')
    const bsreUsername = process.env.BSRE_USERNAME
    const bsrePassword = process.env.BSRE_PASSWORD
    const bsreConfigured = Boolean(bsreUsername && bsrePassword)

    if (bsreConfigured && !nik) {
      return { success: false, error: 'NIK_NOT_FOUND_IN_DB' }
    }

    if (!passphrase && existingLetter?.pdf_path) {
      if (isStoragePdfPath(existingLetter.pdf_path)) {
        return { success: true, pdfPath: existingLetter.pdf_path, signed: true }
      }
      const localPath = buildLocalPdfPath(existingLetter.pdf_path)
      if (fs.existsSync(localPath)) {
        return { success: true, pdfPath: existingLetter.pdf_path, signed: true }
      }
    }

    let playwright: any
    try {
      playwright = await import('playwright')
    } catch {
      return { success: false, error: 'Playwright not available for PDF generation' }
    }

    const baseUrlCandidates = [
      process.env.INTERNAL_APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      'http://localhost:3000',
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/$/, ''))
      .filter((value, index, arr) => arr.indexOf(value) === index)

    const publicBaseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || baseUrlCandidates[0]
    ).replace(/\/$/, '')

    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars'],
    })

    try {
      const context = await browser.newContext({
        viewport: { width: 794, height: 1123 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
      })
      await context.route('**fonts.googleapis.com**', async (route: any) => { await route.abort() })
      await context.route('**fonts.gstatic.com**', async (route: any) => { await route.abort() })

      const page = await context.newPage()
      await page.emulateMedia({ media: 'print' })

      const renderAuth = createPdfRenderToken(letterId, 'letter')
      const headers = {
        'x-pdf-render-token': renderAuth.token,
        'x-pdf-render-ts': String(renderAuth.timestamp),
        'x-pdf-render-cert': String(letterId),
        'x-pdf-render-doc': 'letter',
      }

      const expectedPath = `/letters/${letterId}/print`
      let printResponse: any = null
      let lastError = ''
      let baseUrl = baseUrlCandidates[0]

      for (const candidateBaseUrl of baseUrlCandidates) {
        const url = `${candidateBaseUrl}${expectedPath}?pdf=true&render_token=${encodeURIComponent(renderAuth.token)}&render_ts=${encodeURIComponent(String(renderAuth.timestamp))}${simulateSigned ? '&signed=true' : ''}`
        try {
          await page.setExtraHTTPHeaders(headers)
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
          if (!page.url().includes(expectedPath)) {
            lastError = `PRINT_RENDER_FAILED: final URL ${page.url()}`
            continue
          }
          if (response && !response.ok()) {
            lastError = `PRINT_RENDER_FAILED: HTTP ${response.status()}`
            continue
          }
          baseUrl = candidateBaseUrl
          printResponse = response
          break
        } catch (navigationError: any) {
          lastError = `PRINT_RENDER_FAILED: ${navigationError?.message || 'navigation error'}`
        }
      }

      if (!printResponse) {
        return { success: false, error: lastError || 'PRINT_RENDER_FAILED: halaman print tidak dapat dibuka.' }
      }

      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

      const contentReady = await page
        .waitForFunction(() => {
          const urlParams = new URLSearchParams(window.location.search)
          if (urlParams.get('pdf') === 'true' && (document.body as any)?.dataset?.printDataReady !== 'true') return false
          return !!document.querySelector('.sk-page')
        }, { timeout: 60000 })
        .then(() => true)
        .catch(() => false)

      if (!contentReady) {
        return { success: false, error: `PRINT_RENDER_FAILED: konten print tidak siap (${baseUrl})` }
      }

      await page.evaluate(() => {
        try {
          const maxId = window.setTimeout(() => {}, 1)
          for (let i = 0; i <= maxId + 200; i++) {
            window.clearTimeout(i)
            window.clearInterval(i)
          }
        } catch { /* ignore */ }
      })

      await page
        .waitForFunction(() => {
          const containers = document.querySelectorAll('.qr-code-container')
          if (containers.length === 0) return true
          return Array.from(containers).every((c) => {
            const canvas = c.querySelector('canvas') as HTMLCanvasElement | null
            return canvas && canvas.width > 0 && canvas.height > 0
          })
        }, { timeout: 15000 })
        .catch(() => {})

      await page.waitForTimeout(1500)

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      })

      const letterNumber = existingLetter?.no_letter || String(letterId)
      const safeFileName = letterNumber.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `surat_${safeFileName}_${letterId}.pdf`

      const storageDir = path.join(process.cwd(), STORAGE_DIR)
      if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })
      const filePath = path.join(storageDir, fileName)
      const tempFilePath = filePath.replace('.pdf', '_temp.pdf')

      let signedPdf: Buffer | null = null
      fs.writeFileSync(tempFilePath, pdf)

      try {
        if (!bsreConfigured) {
          console.warn('[Letter PDF] BSrE tidak dikonfigurasi, PDF disimpan tanpa tanda tangan')
        } else {
          if (!passphrase) {
            fs.unlinkSync(tempFilePath)
            return { success: false, error: 'Passphrase tidak tersedia untuk penandatanganan PDF' }
          }

          const authHeader = `Basic ${Buffer.from(`${bsreUsername}:${bsrePassword}`).toString('base64')}`
          const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`
          const CRLF = '\r\n'
          const parts: Buffer[] = []
          const addField = (name: string, value: string) => {
            parts.push(Buffer.from(`--${boundary}${CRLF}`))
            parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`))
            parts.push(Buffer.from(value))
            parts.push(Buffer.from(CRLF))
          }

          parts.push(Buffer.from(`--${boundary}${CRLF}`))
          parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`))
          parts.push(Buffer.from(`Content-Type: application/pdf${CRLF}${CRLF}`))
          parts.push(fs.readFileSync(tempFilePath))
          parts.push(Buffer.from(CRLF))
          addField('nik', nik!)
          addField('passphrase', passphrase)
          addField('tampilan', 'invisible')
          addField('page', '1')
          addField('image', 'false')
          addField(
            'linkQR',
            process.env.BSRE_QR_LINK
              || (existingLetter?.public_id ? `${publicBaseUrl}/verify-surat/${existingLetter.public_id}` : ''),
          )
          addField('xAxis', '0')
          addField('yAxis', '0')
          addField('width', '0')
          addField('height', '0')
          parts.push(Buffer.from(`--${boundary}--${CRLF}`))

          const body = Buffer.concat(parts)
          const signEndpoint = `${bsreBaseURL}/api/sign/pdf`
          console.log('[Letter PDF] Signing payload:', {
            letterId,
            bytes: body.length,
            sha256: createHash('sha256').update(fs.readFileSync(tempFilePath)).digest('hex'),
            bsreHost: (() => { try { return new URL(signEndpoint).host } catch { return 'invalid-url' } })(),
            username: fingerprint(bsreUsername!),
            nik: fingerprint(nik!),
          })

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 120000)
          const signResponse = await fetch(signEndpoint, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': body.length.toString(),
              Accept: 'application/pdf, application/json',
            },
            body,
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          const responseBuffer = Buffer.from(await signResponse.arrayBuffer())
          const contentType = signResponse.headers.get('content-type') || ''

          if (!signResponse.ok || !isPdfBuffer(responseBuffer)) {
            const preview = responseBuffer.slice(0, 400).toString('utf-8')
            const lower = preview.toLowerCase()
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
            if (lower.includes('nik') || lower.includes('tidak terdaftar') || lower.includes('not registered')) {
              return {
                success: false,
                error:
                  'NIK penandatangan tidak terdaftar/tidak valid pada layanan TTE (BSrE). Hubungi administrator untuk memperbaiki data NIK penandatangan.',
              }
            }
            if (
              signResponse.status === 401
              || signResponse.status === 403
              || lower.includes('passphrase')
              || lower.includes('salah')
            ) {
              return { success: false, error: `Passphrase TTE salah atau tidak valid. (HTTP ${signResponse.status})` }
            }
            return { success: false, error: `BSRE_SIGN_FAILED_HTTP_${signResponse.status}: ${preview.slice(0, 200)}` }
          }

          signedPdf = responseBuffer
          console.log(`[Letter PDF] Signed by BSrE (${contentType}), ${signedPdf.length} bytes`)
        }
      } catch (signError: any) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        const raw = String(signError?.message || '')
        // Kegagalan jaringan ke BSrE ("fetch failed", DNS, timeout) sering muncul
        // mentah — terjemahkan agar petugas tahu apa yang harus dilakukan.
        const isNetworkError =
          /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|aborted/i.test(
            raw,
          )
        return {
          success: false,
          error: isNetworkError
            ? 'Layanan TTE (BSrE) tidak dapat dihubungi dari server. Periksa koneksi server ke BSrE atau hubungi administrator.'
            : `Gagal menandatangani PDF: ${raw || 'penyebab tidak diketahui'}`,
        }
      }

      const bufferToSave = signedPdf ?? pdf
      fs.writeFileSync(filePath, bufferToSave)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)

      let persistedPdfPath = `${STORAGE_DIR}/${fileName}`
      try {
        persistedPdfPath = await uploadPdfToStorage(supabaseAdmin as any, bufferToSave, fileName)
      } catch (storageError) {
        console.error('[Letter PDF] Gagal upload ke storage, memakai path lokal:', storageError)
      }

      const { error: updateError } = await supabaseAdmin
        .from('letter')
        .update({ pdf_path: persistedPdfPath, pdf_generated_at: new Date().toISOString() })
        .eq('id', letterId)
      if (updateError) return { success: false, error: updateError.message }

      return { success: true, pdfPath: persistedPdfPath, signed: signedPdf !== null }
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
}
