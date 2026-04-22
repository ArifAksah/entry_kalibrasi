import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export const CERTIFICATE_PDF_BUCKET = process.env.CERTIFICATE_PDF_BUCKET || 'certificate-pdfs'
export const CERTIFICATE_PDF_FOLDER = 'signed'
const STORAGE_PREFIX = 'storage:'

export const buildStoragePdfPath = (fileName: string) =>
  `${STORAGE_PREFIX}${CERTIFICATE_PDF_BUCKET}/${CERTIFICATE_PDF_FOLDER}/${fileName}`

export const isStoragePdfPath = (pdfPath: string | null | undefined) =>
  typeof pdfPath === 'string' && pdfPath.startsWith(STORAGE_PREFIX)

export const parseStoragePdfPath = (pdfPath: string) => {
  const withoutPrefix = pdfPath.slice(STORAGE_PREFIX.length)
  const firstSlash = withoutPrefix.indexOf('/')
  if (firstSlash === -1) {
    throw new Error(`Invalid storage PDF path: ${pdfPath}`)
  }

  return {
    bucket: withoutPrefix.slice(0, firstSlash),
    objectPath: withoutPrefix.slice(firstSlash + 1),
  }
}

export async function ensurePdfBucketExists(supabaseAdmin: SupabaseClient) {
  try {
    const { data: bucketInfo, error: getErr } = await (supabaseAdmin as any).storage.getBucket(CERTIFICATE_PDF_BUCKET)
    if (!getErr && bucketInfo) {
      // Bucket sudah ada
      return
    }
    console.log(`[Storage] Bucket '${CERTIFICATE_PDF_BUCKET}' belum ada (error: ${getErr?.message}), mencoba membuat...`)
  } catch (checkEx: any) {
    console.log(`[Storage] Gagal mengecek bucket: ${checkEx?.message}, mencoba membuat...`)
  }

  try {
    const { error: createErr } = await (supabaseAdmin as any).storage.createBucket(CERTIFICATE_PDF_BUCKET, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    })

    if (createErr && !String(createErr.message || '').toLowerCase().includes('already exists')) {
      console.error(`[Storage] ❌ Gagal membuat bucket '${CERTIFICATE_PDF_BUCKET}':`, createErr.message)
      throw createErr
    }

    if (!createErr) {
      console.log(`[Storage] ✅ Bucket '${CERTIFICATE_PDF_BUCKET}' berhasil dibuat`)
    }
  } catch (createEx: any) {
    // Jika sudah ada (race condition), abaikan
    if (String(createEx?.message || '').toLowerCase().includes('already exists')) return
    throw createEx
  }
}

export async function uploadPdfToStorage(
  supabaseAdmin: SupabaseClient,
  buffer: Buffer,
  fileName: string,
) {
  await ensurePdfBucketExists(supabaseAdmin)
  const objectPath = `${CERTIFICATE_PDF_FOLDER}/${fileName}`
  const { error } = await supabaseAdmin.storage
    .from(CERTIFICATE_PDF_BUCKET)
    .upload(objectPath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    })

  if (error) throw error
  return buildStoragePdfPath(fileName)
}

export async function downloadPdfFromStorage(
  supabaseAdmin: SupabaseClient,
  pdfPath: string,
) {
  const { bucket, objectPath } = parseStoragePdfPath(pdfPath)
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(objectPath)
  if (error || !data) {
    throw error || new Error(`Failed to download PDF from storage: ${pdfPath}`)
  }

  return Buffer.from(await data.arrayBuffer())
}

export async function tryDownloadPdfByFileNameFromStorage(
  supabaseAdmin: SupabaseClient,
  fileName: string,
) {
  try {
    return await downloadPdfFromStorage(supabaseAdmin, buildStoragePdfPath(fileName))
  } catch {
    return null
  }
}

export const buildLocalPdfPath = (fileNameOrPath: string) =>
  path.join(process.cwd(), 'e-certificate-signed', path.basename(fileNameOrPath))

export const tryReadLocalPdf = (fileNameOrPath: string) => {
  const filePath = buildLocalPdfPath(fileNameOrPath)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath)
}
