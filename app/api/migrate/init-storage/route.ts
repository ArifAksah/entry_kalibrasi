import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CERTIFICATE_PDF_BUCKET, ensurePdfBucketExists } from '../../../../lib/certificate-pdf-storage'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/migrate/init-storage
 * Membuat bucket Supabase Storage jika belum ada.
 * Berguna untuk inisialisasi pertama kali atau saat bucket terhapus.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

    console.log(`[Init Storage] Supabase URL: ${supabaseUrl}`)
    console.log(`[Init Storage] Service role key available: ${hasServiceKey}`)
    console.log(`[Init Storage] Target bucket: ${CERTIFICATE_PDF_BUCKET}`)

    // 1. Cek apakah bucket sudah ada
    const { data: existingBucket, error: getBucketErr } = await (supabaseAdmin as any).storage.getBucket(CERTIFICATE_PDF_BUCKET)

    if (!getBucketErr && existingBucket) {
      return NextResponse.json({
        success: true,
        message: `Bucket '${CERTIFICATE_PDF_BUCKET}' sudah ada`,
        bucket: existingBucket,
        action: 'already_exists'
      })
    }

    console.log(`[Init Storage] Bucket tidak ada atau error: ${getBucketErr?.message}`)
    console.log(`[Init Storage] Membuat bucket baru...`)

    // 2. Buat bucket baru
    const { data: newBucket, error: createErr } = await (supabaseAdmin as any).storage.createBucket(CERTIFICATE_PDF_BUCKET, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024, // 25 MB
      allowedMimeTypes: ['application/pdf'],
    })

    if (createErr) {
      // Cek apakah sudah ada (race condition atau error "already exists")
      const alreadyExists = String(createErr.message || '').toLowerCase().includes('already exists')
      if (alreadyExists) {
        return NextResponse.json({
          success: true,
          message: `Bucket '${CERTIFICATE_PDF_BUCKET}' sudah ada (konfirmasi via create)`,
          action: 'already_exists_confirmed'
        })
      }

      console.error(`[Init Storage] ❌ Gagal membuat bucket:`, createErr)
      return NextResponse.json({
        success: false,
        error: createErr.message || 'Gagal membuat bucket',
        bucket_name: CERTIFICATE_PDF_BUCKET,
        supabase_url: supabaseUrl
      }, { status: 500 })
    }

    console.log(`[Init Storage] ✅ Bucket berhasil dibuat:`, newBucket)

    return NextResponse.json({
      success: true,
      message: `Bucket '${CERTIFICATE_PDF_BUCKET}' berhasil dibuat`,
      bucket: newBucket,
      action: 'created'
    })
  } catch (error: any) {
    console.error('[Init Storage] Internal error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * GET /api/migrate/init-storage
 * Cek status bucket Supabase Storage.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Cek apakah bucket ada
    const { data: bucket, error: getBucketErr } = await (supabaseAdmin as any).storage.getBucket(CERTIFICATE_PDF_BUCKET)

    // Coba list objects di dalam bucket untuk verifikasi akses
    let objectCount = 0
    let listError: string | null = null
    try {
      const { data: listData, error: listErr } = await supabaseAdmin.storage
        .from(CERTIFICATE_PDF_BUCKET)
        .list('signed', { limit: 100 })

      if (listErr) {
        listError = listErr.message
      } else {
        objectCount = listData?.length || 0
      }
    } catch (listEx: any) {
      listError = listEx?.message || 'Unknown error listing objects'
    }

    return NextResponse.json({
      supabase_url: supabaseUrl,
      service_key_available: hasServiceKey,
      bucket_name: CERTIFICATE_PDF_BUCKET,
      bucket_exists: !getBucketErr && Boolean(bucket),
      bucket_info: bucket || null,
      bucket_error: getBucketErr?.message || null,
      storage_access: {
        objects_in_signed_folder: objectCount,
        list_error: listError
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Internal server error',
    }, { status: 500 })
  }
}
