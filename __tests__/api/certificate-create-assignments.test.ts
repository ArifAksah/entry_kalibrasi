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
const mockRpc = jest.fn()
const mockGetUser = jest.fn()

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

jest.mock('../../lib/email', () => ({ sendAssignmentNotificationEmail: jest.fn() }))
jest.mock('../../lib/certificate-log-helper', () => ({ createCertificateLog: jest.fn() }))

import { POST } from '../../app/api/certificates/route'

const validBody = {
  no_identification: 'UUT-1',
  instrument_code: 'AWS',
  authorized_by: 'signer-1',
  verifikator_1: 'verifier-1',
  verifikator_2: 'verifier-2',
  verifikator_3: 'verifier-3',
  results: null,
}

function request(body: Record<string, unknown>) {
  return {
    headers: new Headers({ authorization: 'Bearer token' }),
    json: jest.fn().mockResolvedValue(body),
  } as any
}

function roleLookup(role = 'calibrator') {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { role }, error: null }),
      }),
    }),
  }
}

describe('certificate creation assignments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'creator-1' } }, error: null })
  })

  it('requires an explicit authorized_by assignment', async () => {
    mockFrom.mockImplementation((table: string) => table === 'user_roles' ? roleLookup() : {})

    const response = await POST(request({ ...validBody, authorized_by: null }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining('authorized_by') }))
  })

  it('rejects duplicate assignments before querying assigned personnel', async () => {
    mockFrom.mockImplementation((table: string) => table === 'user_roles' ? roleLookup() : {})

    const response = await POST(request({ ...validBody, verifikator_2: 'verifier-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Assigned verifiers and authorized_by must be distinct' })
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('prevents the creator from being assigned to any approval stage', async () => {
    mockFrom.mockImplementation((table: string) => table === 'user_roles' ? roleLookup() : {})

    const response = await POST(request({ ...validBody, verifikator_3: 'creator-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Certificate creator cannot verify or authorize their own certificate' })
  })

  it('rejects inactive assigned personnel', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_roles') return roleLookup()
      if (table === 'personel') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 'verifier-1', is_active: true },
                { id: 'verifier-2', is_active: false },
                { id: 'verifier-3', is_active: true },
                { id: 'signer-1', is_active: true },
              ],
              error: null,
            }),
          }),
        }
      }
      return {}
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Assigned personnel must be active' })
  })

  it('requires authoritative verifier and signer roles', async () => {
    let userRoleCalls = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        userRoleCalls += 1
        if (userRoleCalls === 1) return roleLookup()
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { user_id: 'verifier-1', role: 'verifikator' },
                { user_id: 'verifier-2', role: 'calibrator' },
                { user_id: 'verifier-3', role: 'verifikator' },
                { user_id: 'signer-1', role: 'assignor' },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'personel') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 'verifier-1', is_active: true },
                { id: 'verifier-2', is_active: true },
                { id: 'verifier-3', is_active: true },
                { id: 'signer-1', is_active: true },
              ],
              error: null,
            }),
          }),
        }
      }
      return {}
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Assigned verifiers must have the verifikator role' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('rejects authorized_by without assignor or admin authority', async () => {
    let userRoleCalls = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        userRoleCalls += 1
        if (userRoleCalls === 1) return roleLookup()
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { user_id: 'verifier-1', role: 'verifikator' },
                { user_id: 'verifier-2', role: 'verifikator' },
                { user_id: 'verifier-3', role: 'verifikator' },
                { user_id: 'signer-1', role: 'calibrator' },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'personel') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 'verifier-1', is_active: true },
                { id: 'verifier-2', is_active: true },
                { id: 'verifier-3', is_active: true },
                { id: 'signer-1', is_active: true },
              ],
              error: null,
            }),
          }),
        }
      }
      return {}
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'authorized_by must have the assignor or admin role' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('accepts active verifiers and an admin signer with distinct identities', async () => {
    let userRoleCalls = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        userRoleCalls += 1
        if (userRoleCalls === 1) return roleLookup()
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { user_id: 'verifier-1', role: 'verifikator' },
                { user_id: 'verifier-2', role: 'verifikator' },
                { user_id: 'verifier-3', role: 'verifikator' },
                { user_id: 'signer-1', role: 'admin' },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'personel') {
        return {
          select: jest.fn().mockImplementation((columns: string) => {
            if (columns === 'email') {
              return {
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { email: null }, error: null }),
                }),
              }
            }
            return {
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'verifier-1', is_active: true },
                  { id: 'verifier-2', is_active: true },
                  { id: 'verifier-3', is_active: true },
                  { id: 'signer-1', is_active: true },
                ],
                error: null,
              }),
            }
          }),
        }
      }
      return {}
    })
    mockRpc.mockResolvedValue({
      data: [{ id: 7, no_certificate: 'CERT-7', no_order: '7' }],
      error: null,
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(201)
    expect(mockRpc).toHaveBeenCalledWith('create_certificate_with_auto_number', {
      p_data: expect.objectContaining({
        authorized_by: 'signer-1',
        assignor: 'signer-1',
        verifikator_1: 'verifier-1',
        verifikator_2: 'verifier-2',
        verifikator_3: 'verifier-3',
        created_by: 'creator-1',
      }),
    })
  })
})
