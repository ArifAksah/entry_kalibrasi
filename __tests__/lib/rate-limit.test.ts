import { checkRateLimit, clientIp } from '../../lib/rate-limit'

describe('in-memory fixed-window rate limiter', () => {
  it('allows requests up to the limit', () => {
    const key = `t-allow-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).ok).toBe(true)
    }
  })

  it('blocks requests beyond the limit and reports retry-after', () => {
    const key = `t-block-${Math.random()}`
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true)
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true)
    const third = checkRateLimit(key, 2, 60_000)
    expect(third.ok).toBe(false)
    if (!third.ok) expect(third.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window elapses', async () => {
    const key = `t-window-${Math.random()}`
    expect(checkRateLimit(key, 1, 20).ok).toBe(true)
    expect(checkRateLimit(key, 1, 20).ok).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(checkRateLimit(key, 1, 20).ok).toBe(true)
  })

  const withHeaders = (headers: Record<string, string>) => ({
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  })

  it('derives client IP from forwarded headers', () => {
    expect(clientIp(withHeaders({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })))
      .toBe('203.0.113.9')
  })

  it('falls back to x-real-ip then unknown', () => {
    expect(clientIp(withHeaders({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(clientIp(withHeaders({}))).toBe('unknown')
  })
})
