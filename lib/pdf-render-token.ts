import crypto from 'crypto'

const TOKEN_TTL_MS = 5 * 60 * 1000

function getRenderSecret() {
  return process.env.PDF_RENDER_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NIK_HMAC_SALT || ''
}

function signPayload(certificateId: number | string, timestamp: number) {
  const secret = getRenderSecret()
  if (!secret) return ''

  return crypto
    .createHmac('sha256', secret)
    .update(`${certificateId}:${timestamp}`)
    .digest('hex')
}

export function createPdfRenderToken(certificateId: number | string) {
  const timestamp = Date.now()
  return {
    token: signPayload(certificateId, timestamp),
    timestamp,
  }
}

export function verifyPdfRenderToken(certificateId: number | string, token: string | null, timestampValue: string | null) {
  if (!token || !timestampValue) return false

  const timestamp = Number(timestampValue)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() - timestamp) > TOKEN_TTL_MS) return false

  const expected = signPayload(certificateId, timestamp)
  if (!expected || expected.length !== token.length) return false

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}
