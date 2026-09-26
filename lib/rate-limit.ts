/**
 * Minimal in-memory fixed-window rate limiter for sensitive API routes.
 *
 * This is a best-effort guard for a single Node process (the production
 * deployment runs PM2 in fork mode). Infrastructure-level limits (nginx/Caddy,
 * GoTrue) remain the primary control; this closes the gap where the app proxy
 * had no rate limiting at all.
 *
 * Note: state is per-process. Behind multiple instances, pair this with a
 * shared limiter at the edge.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

type HeaderCarrier = { headers: { get(name: string): string | null } }

export function clientIp(request: HeaderCarrier): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number }

/**
 * @param key      unique bucket key (e.g. `forgot-password:1.2.3.4`)
 * @param limit    max requests per window
 * @param windowMs window length in ms
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  return { ok: true }
}

/** Periodically drop expired buckets so the map cannot grow unbounded. */
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now()
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key)
    })
  }, 60_000)
  // Do not keep the event loop alive in tests/serverless.
  if (typeof (timer as any)?.unref === 'function') (timer as any).unref()
}
