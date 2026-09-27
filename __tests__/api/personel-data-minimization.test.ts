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

let callerRole = 'calibrator'
const mockPersonelSelect = jest.fn()
const mockRoleSelect = jest.fn()

jest.mock('../../lib/api-auth', () => ({
  getCaller: jest.fn(async () => ({ user: { id: 'caller' }, role: callerRole })),
  isAdminCaller: (caller: { role: string | null }) => caller.role === 'admin',
  isRenderAuthorized: jest.fn(() => false),
  requireAdmin: jest.fn(),
  unauthorized: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'user_roles') return { select: mockRoleSelect }
      return { select: mockPersonelSelect }
    },
  },
}))

import { GET } from '../../app/api/personel/route'

const personelRows = [{
  id: 'person-1',
  name: 'Person One',
  balai_id: 2,
  email: 'private@example.com',
  nip: 'private-nip',
}]

function request() {
  return { url: 'http://localhost/api/personel', headers: new Headers() } as any
}

function mockQueries() {
  mockPersonelSelect.mockImplementation((columns: string) => {
    const data = columns === '*'
      ? personelRows
      : personelRows.map(({ id, name, balai_id }) => ({ id, name, balai_id }))
    const order = jest.fn().mockResolvedValue({ data, error: null })
    const query: any = { order }
    query.or = jest.fn(() => query)
    return query
  })
  mockRoleSelect.mockResolvedValue({
    data: [{ user_id: 'person-1', role: 'assignor', station_id: 7 }],
    error: null,
  })
}

describe('GET /api/personel data minimization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    callerRole = 'calibrator'
    mockQueries()
  })

  it('returns only fields needed by assignment UI to non-admin users', async () => {
    const response = await GET(request())

    expect(mockPersonelSelect).toHaveBeenCalledWith('id, name, balai_id')
    expect(await response.json()).toEqual([{
      id: 'person-1',
      name: 'Person One',
      balai_id: 2,
      role: 'assignor',
    }])
  })

  it('preserves full personnel and station-role data for admins', async () => {
    callerRole = 'admin'
    const response = await GET(request())

    expect(mockPersonelSelect).toHaveBeenCalledWith('*')
    expect(await response.json()).toEqual([{
      ...personelRows[0],
      role: 'assignor',
      station_id: 7,
    }])
  })
})
