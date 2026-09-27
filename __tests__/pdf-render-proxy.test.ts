jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    next: jest.fn(),
    json: jest.fn(),
  },
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

import { isPdfRenderPathAllowed } from '../proxy'

function request(path: string) {
  return { nextUrl: new URL(`http://localhost${path}`) } as any
}

describe('PDF render proxy path allowlist', () => {
  it.each([
    '/api/certificates/42',
    '/api/instruments/7',
    '/api/instrument-names/11',
    '/api/stations/8',
    '/api/sensors/9',
    '/api/personel/person-a',
    '/api/raw-data?session_id=session-a&mode=room',
  ])('allows an exact renderer read: %s', (path) => {
    expect(isPdfRenderPathAllowed(request(path), '42')).toBe(true)
  })

  it.each([
    '/api/certificates/43',
    '/api/certificates/42?extra=true',
    '/api/certificates/42/send-to-verifiers',
    '/api/certificates/42/anything',
    '/api/instruments',
    '/api/instruments/7?extra=true',
    '/api/instruments/7/sensors',
    '/api/instrument-names',
    '/api/instrument-names/11/anything',
    '/api/instruments-malicious/7',
    '/api/personel',
    '/api/personel/person-a/reactivate',
    '/api/sensors/standard',
    '/api/instrument-names',
    '/api/notes',
    '/api/raw-data?session_id=session-a',
    '/api/raw-data?session_id=session-a&mode=room&extra=true',
  ])('rejects a broad, mismatched, or action path: %s', (path) => {
    expect(isPdfRenderPathAllowed(request(path), '42')).toBe(false)
  })
})
