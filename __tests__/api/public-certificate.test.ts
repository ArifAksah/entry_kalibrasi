jest.mock('next/server', () => {
  class MockNextResponse {
    status: number
    private data: unknown

    constructor(data: unknown, status = 200) {
      this.data = data
      this.status = status
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init?.status || 200)
    }

    async json() {
      return this.data
    }
  }

  return { NextRequest: class {}, NextResponse: MockNextResponse }
})

const mockFrom = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}))

import { GET } from '../../app/api/public/certificates/[public_id]/route'

function certificateQuery(result: { data: unknown; error: unknown }, eq: jest.Mock) {
  const query = {
    eq,
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
  eq.mockReturnValue(query)
  return { select: jest.fn().mockReturnValue(query) }
}

describe('public certificate endpoint', () => {
  beforeEach(() => jest.clearAllMocks())

  it('queries only completed certificates and returns non-final records as not found', async () => {
    const eq = jest.fn()
    mockFrom.mockReturnValue(certificateQuery({ data: null, error: null }, eq))

    const response = await GET({} as any, { params: Promise.resolve({ public_id: 'public-1' }) })

    expect(eq).toHaveBeenNthCalledWith(1, 'public_id', 'public-1')
    expect(eq).toHaveBeenNthCalledWith(2, 'status', 'completed')
    expect(response.status).toBe(404)
  })

  it('returns a minimized completed-certificate response without internal IDs or workflow data', async () => {
    const eq = jest.fn()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'certificate') {
        return certificateQuery({
          data: {
            no_certificate: 'CERT-1',
            no_identification: 'UUT-1',
            issue_date: '2026-01-01',
            status: 'completed',
            authorized_by: 'signer-1',
            station: null,
            instrument: null,
            pdf_generated_at: '2026-01-02T00:00:00Z',
          },
          error: null,
        }, eq)
      }
      if (table === 'personel') {
        const signerQuery = {
          eq: jest.fn(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'signer-1', name: 'Signer' }, error: null }),
        }
        signerQuery.eq.mockReturnValue(signerQuery)
        return { select: jest.fn().mockReturnValue(signerQuery) }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET({} as any, { params: Promise.resolve({ public_id: 'public-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.certificate).toEqual({
      no_certificate: 'CERT-1',
      no_identification: 'UUT-1',
      issue_date: '2026-01-01',
      status: 'completed',
      status_label: 'Selesai',
      station_name: '-',
      instrument_name: '-',
    })
    expect(payload.signature).toEqual({
      signed: true,
      provider: 'BSrE',
      signed_at: '2026-01-02T00:00:00Z',
      signer: { name: 'Signer' },
    })
    expect(payload).not.toHaveProperty('people')
    expect(payload).not.toHaveProperty('workflow')
    expect(JSON.stringify(payload)).not.toContain('signer-1')
  })
})
