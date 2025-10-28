import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function ensureBucketExists(bucket: string) {
  try {
    // Try to get bucket; if not exists, create as public
    const { data: bucketInfo, error: getErr } = await (supabaseAdmin as any).storage.getBucket(bucket)
    if (!getErr && bucketInfo) return
  } catch {}

  try {
    const { error: createErr } = await (supabaseAdmin as any).storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    })
    if (createErr) {
      // Best effort - ignore if already exists
      if (!String(createErr.message || '').toLowerCase().includes('already exists')) {
        throw createErr
      }
    }
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = (form.get('folder') as string | null) || 'misc'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    const MAX_BYTES = 10 * 1024 * 1024 // 10MB
    if ((file as any).size && (file as any).size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 413 })
    }

    const bucket = 'certificates'
    await ensureBucketExists(bucket)

    const ext = file.name?.split('.').pop()?.toLowerCase() || 'png'
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${folder}/${safeName}`

    const { error: uploadErr } = await supabaseAdmin.storage.from(bucket).upload(path, file as any, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    let publicUrl: string | null = null
    try {
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
      publicUrl = data.publicUrl
    } catch {
      // Create a signed URL for 7 days if bucket not public
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7)
      if (!error && data?.signedUrl) publicUrl = data.signedUrl
    }

    return NextResponse.json({ path, url: publicUrl }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}






