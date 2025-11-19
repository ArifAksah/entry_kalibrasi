import { NextRequest, NextResponse } from 'next/server'

// Handler untuk GET dan POST (fleksibilitas)
async function handleAuthRequest() {
  // 1. Ambil konfigurasi dari .env.local
  const baseURL = process.env.BSRE_BASE_URL
  const username = process.env.BSRE_USERNAME
  const password = process.env.BSRE_PASSWORD

  // Validasi konfigurasi
  if (!baseURL || !username || !password) {
    return NextResponse.json(
      { 
        error: 'Konfigurasi BSrE belum lengkap di server.',
        required: ['BSRE_BASE_URL', 'BSRE_USERNAME', 'BSRE_PASSWORD']
      },
      { status: 500 }
    )
  }

  try {
    // 2. Buat Basic Auth header
    // Basic Auth format: base64(username:password)
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')
    const authHeader = `Basic ${credentials}`

    // 3. Request ke BSrE dengan Basic Auth (Server to Server)
    // Ini akan berjalan dari server Next.js Anda yang sudah "Terhubung" ke VPN
    // Endpoint dapat disesuaikan sesuai kebutuhan (misalnya untuk test status user)
    const testEndpoint = `${baseURL}/api/user/status/1234567890123452`
    
    console.log(`Menghubungi BSrE di: ${testEndpoint} dengan Basic Auth...`)

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
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: 'Gagal autentikasi ke BSrE',
          details: errorData || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // 3. Berhasil! Kirim response kembali ke frontend
    console.log('Berhasil autentikasi ke BSrE.')
    return NextResponse.json({
      success: true,
      message: 'Berhasil terhubung ke BSrE',
      data: data,
      authenticated: true
    })
  } catch (error: any) {
    console.error('Gagal koneksi ke BSrE:', error.message)

    // Handle timeout atau network errors
    if (error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Gagal koneksi ke BSrE',
          details: 'Request timeout (30 detik). Pastikan server terhubung ke VPN dan BSrE dapat diakses.'
        },
        { status: 504 }
      )
    }

    // Berikan pesan error yang jelas untuk debugging
    return NextResponse.json(
      {
        error: 'Gagal koneksi ke BSrE',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Export untuk POST method
export async function POST(request: NextRequest) {
  console.log('[BSrE Auth] POST request received')
  return handleAuthRequest()
}

// Export untuk GET method (opsional, untuk fleksibilitas)
export async function GET(request: NextRequest) {
  console.log('[BSrE Auth] GET request received')
  return handleAuthRequest()
}

