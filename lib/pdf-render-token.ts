import crypto from 'crypto'

const TOKEN_TTL_MS = 5 * 60 * 1000

export type RenderScope = 'certificate' | 'letter'

function getRenderSecret() {
  return process.env.PDF_RENDER_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NIK_HMAC_SALT || ''
}

function signPayload(scope: RenderScope, documentId: number | string, timestamp: number) {
  const secret = getRenderSecret()
  if (!secret) return ''

  return crypto
    .createHmac('sha256', secret)
    .update(`${scope}:${documentId}:${timestamp}`)
    .digest('hex')
}

export function createPdfRenderToken(documentId: number | string, scope: RenderScope = 'certificate') {
  const timestamp = Date.now()
  return {
    token: signPayload(scope, documentId, timestamp),
    timestamp,
  }
}

export function verifyPdfRenderToken(
  documentId: number | string,
  token: string | null,
  timestampValue: string | null,
  scope: RenderScope = 'certificate',
) {
  if (!token || !timestampValue) return false

  const timestamp = Number(timestampValue)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() - timestamp) > TOKEN_TTL_MS) return false

  const expected = signPayload(scope, documentId, timestamp)
  if (!expected || expected.length !== token.length) return false

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}
