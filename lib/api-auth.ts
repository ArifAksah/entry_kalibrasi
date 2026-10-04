import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'
import { isUserInCalibrationOrderTeam } from './certificate-access'
import { verifyPdfRenderToken } from './pdf-render-token'
import { resultsToLegacyView } from './validators/certificate-results-render-adapter'

// Render-context check for route handlers (see proxy.ts): the signed-PDF
// renderer (headless Chromium with ?render_token=…) has no session token.
// Requests carry the HMAC headers; routes re-verify independently of the
// proxy so a spoofed header cannot grant more than read-only access.
export function isRenderAuthorized(request: NextRequest): boolean {
  if (request.method !== 'GET') return false
  const token = request.headers.get('x-pdf-render-token')
  const ts = request.headers.get('x-pdf-render-ts')
  const certId = request.headers.get('x-pdf-render-cert')
  if (!token || !ts || !certId || !/^\d+$/.test(certId)) return false
  try {
    return verifyPdfRenderToken(certId, token, ts)
  } catch {
    return false
  }
}

export function hasRenderCredentials(request: NextRequest): boolean {
  return ['x-pdf-render-token', 'x-pdf-render-ts', 'x-pdf-render-cert']
    .some(header => request.headers.has(header))
}

type RenderResource =
  | { type: 'certificate'; id: string }
  | { type: 'instrument' | 'instrument-name' | 'station' | 'personel' | 'sensor'; id: string }
  | { type: 'raw-data'; sessionId: string }

export async function isRenderAuthorizedFor(
  request: NextRequest,
  resource: RenderResource,
): Promise<boolean> {
  if (!isRenderAuthorized(request)) return false

  const certificateId = request.headers.get('x-pdf-render-cert')!
  if (resource.type === 'certificate') return resource.id === certificateId

  try {
    const { data: certificate, error } = await supabaseAdmin
      .from('certificate')
      .select('instrument, station, authorized_by, verifikator_1, verifikator_2, verifikator_3, results')
      .eq('id', certificateId)
      .maybeSingle()
    if (error || !certificate) return false

    if (resource.type === 'instrument') return String(certificate.instrument ?? '') === resource.id
    if (resource.type === 'instrument-name') {
      if (certificate.instrument == null) return false
      const { data: instrument, error: instrumentError } = await supabaseAdmin
        .from('instrument')
        .select('names')
        .eq('id', certificate.instrument)
        .maybeSingle()
      return !instrumentError && String(instrument?.names ?? '') === resource.id
    }
    if (resource.type === 'station') return String(certificate.station ?? '') === resource.id
    if (resource.type === 'personel') {
      return [certificate.authorized_by, certificate.verifikator_1, certificate.verifikator_2, certificate.verifikator_3]
        .some(id => id != null && String(id) === resource.id)
    }

    const results = resultsToLegacyView(certificate.results ?? [])
    if (resource.type === 'raw-data') {
      return results.some((result: any) => String(result?.session_id ?? '') === resource.sessionId)
    }

    return results.some((result: any) => [
      result?.sensorId,
      ...(Array.isArray(result?.notesForm?.standardInstruments)
        ? result.notesForm.standardInstruments
        : []),
    ].some(id => id != null && String(id) === resource.id))
  } catch {
    return false
  }
}

export interface Caller {
  user: { id: string; email?: string }
  role: string | null
}

export const ASSIGNABLE_ROLES = new Set(['admin', 'calibrator', 'verifikator', 'assignor', 'user_station'])

export function unauthorized() {
  return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 })
}

export function forbidden(message = 'Tidak memiliki hak akses untuk operasi ini') {
  return NextResponse.json({ error: message }, { status: 403 })
}

async function resolveCaller(token: string): Promise<Caller | null> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user) return null

  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  return {
    user: { id: authData.user.id, email: authData.user.email },
    role: roleRow?.role ?? null,
  }
}

// middleware.ts already validates the Bearer token for every protected
// /api route; this helper re-derives identity + role inside the route handler
// (defense in depth, and required for role-based decisions).
export async function getCaller(request: NextRequest): Promise<Caller | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    return await resolveCaller(authHeader.slice(7))
  } catch {
    return null
  }
}

export async function requireCaller(request: NextRequest): Promise<Caller | NextResponse> {
  const caller = await getCaller(request)
  return caller ?? unauthorized()
}

export async function requireAdmin(request: NextRequest): Promise<Caller | NextResponse> {
  const caller = await getCaller(request)
  if (!caller) return unauthorized()
  if (caller.role !== 'admin') return forbidden('Hanya admin yang dapat mengakses endpoint ini')
  return caller
}

// Same as requireAdmin but with an explicit role allowlist — used where the
// established UI grants access to more than 'admin' (e.g. calibrator owns
// the Master Data screens), so hardening never breaks live workflows.
export async function requireRoles(request: NextRequest, roles: string[]): Promise<Caller | NextResponse> {
  const caller = await getCaller(request)
  if (!caller) return unauthorized()
  if (!caller.role || !roles.includes(caller.role)) {
    return forbidden(`Hanya ${roles.join(' atau ')} yang dapat mengakses endpoint ini`)
  }
  return caller
}

export function isAdminCaller(caller: Caller): caller is Caller & { role: 'admin' } {
  return caller.role === 'admin'
}

export function notFound(message = 'Data tidak ditemukan') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export interface CertWorkflowOptions {
  // Roles additionally allowed regardless of the caller's presence on the cert.
  roles?: string[]
  // Certificate columns that entitle the caller (ownership check).
  matchColumns?: string[]
  message?: string
}

// Default party columns for certificate workflow access — mirrors the set
// already used by lib/certificate-access.ts (canUserAccessCertificate).
export const CERT_PARTY_COLUMNS = [
  'authorized_by',
  'verifikator_1',
  'verifikator_2',
  'verifikator_3',
  'assignor',
  'sent_by',
  'created_by',
]

// Gate certificate workflow mutations (reset / repair / complete) so that
// only admins or users actually attached to THAT certificate may act — never
// an unrelated logged-in user (previously every authenticated user could
// reset/complete any certificate's verification via the API).
export async function requireCertWorkflowAccess(
  request: NextRequest,
  certificateId: number | string,
  opts: CertWorkflowOptions = {},
): Promise<Caller | NextResponse> {
  const caller = await getCaller(request)
  if (!caller) return unauthorized()

  const columns = opts.matchColumns?.length ? opts.matchColumns : CERT_PARTY_COLUMNS

  const { data, error } = await supabaseAdmin
    .from('certificate')
    .select(`id, calibration_order_id, ${columns.join(', ')}`)
    .eq('id', certificateId)
    .maybeSingle()

  if (error || !data) return notFound('Sertifikat tidak ditemukan')

  if (caller.role === 'admin') return caller
  if (caller.role && opts.roles?.includes(caller.role)) return caller

  const matched = columns.some(col => String((data as any)[col] ?? '') === caller.user.id)
  if (matched) return caller

  // Akses tim Order Kalibrasi: petugas yang di-assign ke order sertifikat ini
  // boleh melakukan operasi workflow pada sertifikat milik order tersebut.
  if (
    await isUserInCalibrationOrderTeam(
      caller.user.id,
      (data as any).calibration_order_id,
    )
  ) {
    return caller
  }

  return forbidden(opts.message ?? 'Hanya admin atau petugas yang terlibat pada sertifikat ini yang dapat melakukan operasi tersebut')
}
