import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPdfRenderToken } from './lib/pdf-render-token'

// ─── Signed-PDF renderer bypass ────────────────────────────────────────────
// lib/certificate-pdf-helper.ts spins up headless Chromium against
// /certificates/{id}/print?render_token=… — that page then fetches several
// GET /api/* endpoints with no browser session. Instead of Bearer tokens these
// requests carry an HMAC render token (5-minute TTL, bound to the certificate
// id, verified with the same secret as the route at /api/certificates/[id]).
const RENDER_ALLOWED_PREFIXES = [
  '/api/certificates/',
  '/api/personel',
  '/api/stations',
  '/api/instruments',
  '/api/sensors',
  '/api/instrument-names',
  '/api/raw-data',
  '/api/notes',
  '/api/notes-instrumen-standard',
  '/api/cert-standards',
  '/api/calibration-results',
]

function renderBypassAllowed(request: NextRequest): boolean {
  if (request.method !== 'GET') return false
  const token = request.headers.get('x-pdf-render-token')
  const ts = request.headers.get('x-pdf-render-ts')
  const certId = request.headers.get('x-pdf-render-cert')
  if (!token || !ts || !certId || !/^\d+$/.test(certId)) return false
  const { pathname } = request.nextUrl
  if (!RENDER_ALLOWED_PREFIXES.some(p => pathname === p.slice(0, -1) || pathname.startsWith(p) || pathname === p)) return false
  try {
    return verifyPdfRenderToken(certId, token, ts)
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
  'http://localhost:7000'

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

function isPublicPath(pathname: string) {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (PUBLIC_EXACT.has(normalized)) return true
  return PUBLIC_PREFIXES.some(p => normalized.startsWith(p.replace(/\/$/, '')))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
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
