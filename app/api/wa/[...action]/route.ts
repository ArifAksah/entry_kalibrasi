import { NextRequest, NextResponse } from 'next/server'
import { getCaller, unauthorized } from '../../../../lib/api-auth'

export const dynamic = 'force-dynamic'

const WA_URL = (process.env.WA_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '')

function waHeaders(): Record<string, string> {
  const token = process.env.WA_SERVICE_TOKEN?.trim()
  return token ? { 'x-wa-token': token } : {}
}

/**
 * Server-side proxy for the WA service UI.
 *
 * The WA service is protected by a shared secret (WA_SERVICE_TOKEN) and binds
 * to loopback. The browser can no longer call it directly, so this route
 * forwards only authenticated admin/calibrator sessions and injects the token
 * server-side. That keeps the secret out of the client bundle.
 */
async function requireOperator(request: NextRequest) {
  const caller = await getCaller(request)
  if (!caller) return unauthorized()
  if (caller.role !== 'admin' && caller.role !== 'calibrator') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> },
) {
  const gate = await requireOperator(request)
  if (gate) return gate

  const { action } = await params
  const target = (action || []).join('/')
  if (target !== 'status' && target !== 'qr') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const res = await fetch(`${WA_URL}/${target}`, {
      headers: waHeaders(),
      cache: 'no-store',
    })
    const body = await res.json().catch(() => ({}))
    return NextResponse.json(body, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'WA service tidak dapat dihubungi' },
      { status: 502 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> },
) {
  const gate = await requireOperator(request)
  if (gate) return gate

  const { action } = await params
  const target = (action || []).join('/')
  if (target !== 'logout') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const res = await fetch(`${WA_URL}/${target}`, {
      method: 'POST',
      headers: waHeaders(),
    })
    const body = await res.json().catch(() => ({}))
    return NextResponse.json(body, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'WA service tidak dapat dihubungi' },
      { status: 502 },
    )
  }
}
