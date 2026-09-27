const mockVerifyPdfRenderToken = jest.fn()
const mockMaybeSingle = jest.fn()
const mockInstrumentMaybeSingle = jest.fn()
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn((table: string) => table === 'instrument'
  ? { select: () => ({ eq: () => ({ maybeSingle: mockInstrumentMaybeSingle }) }) }
  : { select: mockSelect })

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    static json(data: unknown, init?: { status?: number }) {
      return { data, status: init?.status ?? 200 }
    }
  },
}))

jest.mock('../../lib/pdf-render-token', () => ({
  verifyPdfRenderToken: (certificateId: string, token: string, timestamp: string) =>
    mockVerifyPdfRenderToken(certificateId, token, timestamp),
}))

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}))

import { isRenderAuthorizedFor } from '../../lib/api-auth'

function renderRequest(certificateId = '42') {
  return {
    method: 'GET',
    headers: new Headers({
      'x-pdf-render-token': 'valid-token',
      'x-pdf-render-ts': '1234',
      'x-pdf-render-cert': certificateId,
    }),
  } as any
}

describe('PDF render resource authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyPdfRenderToken.mockReturnValue(true)
    mockMaybeSingle.mockResolvedValue({
      data: {
        instrument: 7,
        station: 8,
        authorized_by: 'person-a',
        verifikator_1: 'person-b',
        verifikator_2: null,
        verifikator_3: null,
        results: [{
          sensorId: 9,
          session_id: 'session-a',
          notesForm: { standardInstruments: [10] },
        }],
      },
      error: null,
    })
    mockInstrumentMaybeSingle.mockResolvedValue({ data: { names: 11 }, error: null })
  })

  it('binds the primary certificate path to the signed certificate id', async () => {
    await expect(isRenderAuthorizedFor(renderRequest(), { type: 'certificate', id: '42' })).resolves.toBe(true)
    await expect(isRenderAuthorizedFor(renderRequest(), { type: 'certificate', id: '43' })).resolves.toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it.each([
    [{ type: 'instrument', id: '7' }],
    [{ type: 'instrument-name', id: '11' }],
    [{ type: 'station', id: '8' }],
    [{ type: 'personel', id: 'person-b' }],
    [{ type: 'sensor', id: '9' }],
    [{ type: 'sensor', id: '10' }],
    [{ type: 'raw-data', sessionId: 'session-a' }],
  ] as const)('allows a certificate-related resource: %o', async (resource) => {
    await expect(isRenderAuthorizedFor(renderRequest(), resource)).resolves.toBe(true)
  })

  it.each([
    [{ type: 'instrument', id: '70' }],
    [{ type: 'instrument-name', id: '110' }],
    [{ type: 'station', id: '80' }],
    [{ type: 'personel', id: 'person-other' }],
    [{ type: 'sensor', id: '90' }],
    [{ type: 'raw-data', sessionId: 'session-other' }],
  ] as const)('rejects a resource from another certificate: %o', async (resource) => {
    await expect(isRenderAuthorizedFor(renderRequest(), resource)).resolves.toBe(false)
  })

  it('fails closed when the certificate lookup fails', async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(isRenderAuthorizedFor(renderRequest(), { type: 'instrument', id: '7' })).resolves.toBe(false)
  })
})
