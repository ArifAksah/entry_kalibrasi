import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPdfRenderToken, type RenderScope } from './lib/pdf-render-token'

// ─── Signed-PDF renderer bypass ────────────────────────────────────────────
// lib/certificate-pdf-helper.ts spins up headless Chromium against
// /certificates/{id}/print?render_token=… — that page then fetches several
// GET /api/* endpoints with no browser session. Instead of Bearer tokens these
// requests carry an HMAC render token (5-minute TTL, bound to the certificate
// id). Only the exact single-record reads used by the print page are allowed;
// route handlers additionally bind related ids to that certificate.
const RENDER_RELATED_PATHS = [
  /^\/api\/instruments\/\d+$/,
  /^\/api\/instrument-names\/\d+$/,
  /^\/api\/stations\/\d+$/,
  /^\/api\/sensors\/\d+$/,
  /^\/api\/personel\/[^/]+$/,
]

export function isPdfRenderPathAllowed(
  request: NextRequest,
  documentId: string,
  scope: RenderScope = 'certificate',
): boolean {
  const { pathname, searchParams } = request.nextUrl
  const queryKeys = Array.from(searchParams.keys())
  const documentPath =
    scope === 'letter' ? `/api/letters/${documentId}` : `/api/certificates/${documentId}`
  if (pathname === documentPath) return queryKeys.length === 0
  if (RENDER_RELATED_PATHS.some(pattern => pattern.test(pathname))) return queryKeys.length === 0
  if (pathname !== '/api/raw-data') return false

  return queryKeys.length === 2
    && queryKeys.every(key => key === 'session_id' || key === 'mode')
    && Boolean(searchParams.get('session_id'))
    && searchParams.get('mode') === 'room'
}

export function resolveRenderScope(request: NextRequest): RenderScope {
  return request.headers.get('x-pdf-render-doc') === 'letter' ? 'letter' : 'certificate'
}

export function renderBypassAllowed(request: NextRequest): boolean {
  if (request.method !== 'GET') return false
  const token = request.headers.get('x-pdf-render-token')
  const ts = request.headers.get('x-pdf-render-ts')
  const certId = request.headers.get('x-pdf-render-cert')
  if (!token || !ts || !certId || !/^\d+$/.test(certId)) return false
  const scope = resolveRenderScope(request)
  if (!isPdfRenderPathAllowed(request, certId, scope)) return false
  try {
    return verifyPdfRenderToken(certId, token, ts, scope)
  } catch {
    return false
  }
}

// Defense-in-depth gateway: every /api/* route requires a valid logged-in
// user's Bearer token unless it is on the explicit public allowlist below.
// This closes Broken Object/Function Level Authorization on the many API
// routes that historically had no authentication at all.

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PUBLIC_URL ||
  process.env.API_EXTERNAL_URL ||
  'http://localhost:8000'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY || ''

const PUBLIC_PREFIXES = [
  '/api/public/', // certificate verification portal (public_id based)
]

const PUBLIC_EXACT = new Set([
  '/api/auth/forgot-password', // self-service, response is already generic
  '/api/auth/reset-password', // token-gated
])

// Ops/admin surfaces that require the *admin* role, not just a login.
const ADMIN_PREFIXES = [
  '/api/admin/',
  '/api/migrate/',
  '/api/debug/',
  '/api/test/',
  '/api/test-pdf-generation',
  '/api/endpoint-catalog',
  '/api/openapi/',
  '/api/resources',
  '/api/bsre/auth',
  '/api/role-permissions',
  '/api/role-endpoint-permissions',
]

function isAdminPath(pathname: string) {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return ADMIN_PREFIXES.some(p => normalized === p.replace(/\/$/, '') || normalized.startsWith(p))
}

export function isPublicPath(pathname: string) {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (PUBLIC_EXACT.has(normalized)) return true
  return PUBLIC_PREFIXES.some(p => {
    const prefix = p.replace(/\/$/, '')
    return normalized === prefix || normalized.startsWith(`${prefix}/`)
  })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Unduhan PDF Surat Keterangan yang sudah ditandatangani bersifat publik,
  // asalkan membawa public_id. Route handler-nya tetap memverifikasi bahwa
  // public_id itu memang milik surat tersebut dan suratnya sudah selesai.
  if (
    /^\/api\/letters\/\d+\/pdf$/.test(pathname) &&
    request.nextUrl.searchParams.get('public_id')
  ) {
    return NextResponse.next()
  }

  if (renderBypassAllowed(request)) {
    return NextResponse.next()
  }

  if (!supabaseAnonKey) {
    // Fail closed: without an anon key we cannot validate tokens.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data, error } = await client.auth.getUser(token)
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isAdminPath(pathname)) {
      // RLS di user_roles membatasi baris ini ke milik pemanggil.
      const { data: roleRow } = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (roleRow?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
