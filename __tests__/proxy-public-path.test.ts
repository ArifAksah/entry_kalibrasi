jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { next: jest.fn(), json: jest.fn() },
}))

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('../lib/pdf-render-token', () => ({ verifyPdfRenderToken: jest.fn() }))

import { isPublicPath } from '../proxy'

describe('proxy public path matching', () => {
  it.each([
    '/api/public',
    '/api/public/',
    '/api/public/certificates/abc',
  ])('allows the public route segment %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(true)
  })

  it.each([
    '/api/publicity',
    '/api/public-certificate',
    '/api/publication/item',
  ])('does not allow a route that only shares the prefix %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(false)
  })
})
