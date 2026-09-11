import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/api-auth'

async function handleAuthRequest(request: NextRequest) {
  const gate = await requireAdmin(request)
  if (gate instanceof NextResponse) return gate

  // 1. Ambil konfigurasi dari .env.local
  const baseURL = process.env.BSRE_BASE_URL
  const username = process.env.BSRE_USERNAME
  const password = process.env.BSRE_PASSWORD

  // Validasi konfigurasi
  if (!baseURL || !username || !password) {
    return NextResponse.json({ error: 'Layanan BSrE belum dikonfigurasi.' }, { status: 503 })
  }

  try {
    // 2. Buat Basic Auth header
    // Basic Auth format: base64(username:password)
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')
    const authHeader = `Basic ${credentials}`

    // 3. Request ke BSrE dengan Basic Auth (Server to Server)
    // Ini akan berjalan dari server Next.js Anda yang sudah "Terhubung" ke VPN
    // Endpoint dapat disesuaikan sesuai kebutuhan (misalnya untuk test status user)
    const testNik = process.env.BSRE_TEST_NIK
    if (!testNik) {
      return NextResponse.json({ error: 'BSrE test identity belum dikonfigurasi.' }, { status: 503 })
    }
    const testEndpoint = `${baseURL}/api/user/status/${encodeURIComponent(testNik)}`
    
    console.log('Menghubungi BSrE untuk pemeriksaan koneksi...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // Timeout 30 detik

    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Gagal autentikasi ke BSrE',
          status: response.status
        },
        { status: response.status }
      )
    }

    await response.body?.cancel()

    // 3. Berhasil! Kirim response kembali ke frontend
    console.log('Berhasil autentikasi ke BSrE.')
    return NextResponse.json({
      success: true,
      message: 'Berhasil terhubung ke BSrE',
      authenticated: true
    })
  } catch (error: any) {
    console.error('Gagal koneksi ke BSrE:', error)

    // Handle timeout atau network errors
    if (error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Gagal koneksi ke BSrE',
          details: 'Request timeout (30 detik). Layanan BSrE tidak merespons.'
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      {
        error: 'Gagal koneksi ke BSrE',
        details: 'Layanan BSrE tidak tersedia.'
      },
      { status: 500 }
    )
  }
}

// Export untuk POST method
export async function POST(request: NextRequest) {
  return handleAuthRequest(request)
}

// Export untuk GET method (opsional, untuk fleksibilitas)
export async function GET(request: NextRequest) {
  return handleAuthRequest(request)
}
