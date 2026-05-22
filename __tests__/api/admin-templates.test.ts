/**
 * Unit tests for GET and POST /api/admin/templates
 */

// Mock next/server before importing route
jest.mock('next/server', () => {
  class MockNextRequest {
    url: string
    method: string
    headers: Map<string, string>
    private _body: any

    constructor(url: string, init?: any) {
      this.url = url
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this._body = init?.body || null
    }

    async json() {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
    }
  }

  class MockNextResponse {
    static json(data: any, init?: { status?: number }) {
      return {
        status: init?.status || 200,
        json: async () => data,
        _data: data,
      }
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  }
})

// Mock dependencies
jest.mock('../../lib/certificate-access', () => ({
  authenticateRequest: jest.fn(),
  getUserRole: jest.fn(),
}))

const mockFrom = jest.fn()
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}))

jest.mock('../../lib/rich-text-editor/validation', () => ({
  isValidTipTapDocument: jest.fn().mockReturnValue(true),
  validateLoopPairs: jest.fn().mockReturnValue(true),
}))

import { GET, POST } from '../../app/api/admin/templates/route'
import { authenticateRequest, getUserRole } from '../../lib/certificate-access'

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>
const mockGetUserRole = getUserRole as jest.MockedFunction<typeof getUserRole>

function createMockRequest(method: string, body?: any): any {
  const url = 'http://localhost:3000/api/admin/templates'
  const init: any = {
    method,
    headers: { authorization: 'Bearer test-token' },
  }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers['content-type'] = 'application/json'
  }
  const { NextRequest } = require('next/server')
  return new NextRequest(url, init)
}

describe('GET /api/admin/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: null, error: 'Authorization header required' })

    const request = createMockRequest('GET')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authorization header required')
  })

  it('returns 403 when user is not admin', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: { id: 'user-1' }, error: null })
    mockGetUserRole.mockResolvedValue('calibrator')

    const request = createMockRequest('GET')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Akses ditolak')
  })

  it('returns template list for admin users', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: { id: 'admin-1' }, error: null })
    mockGetUserRole.mockResolvedValue('admin')

    const mockTemplates = [
      {
        id: '1',
        name: 'Template FC',
        certificate_type: 'fc',
        version: 1,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockTemplates, error: null }),
        }),
      }),
    })

    const request = createMockRequest('GET')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockTemplates)
  })
})

describe('POST /api/admin/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: null, error: 'Invalid token' })

    const request = createMockRequest('POST', { name: 'Test' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid token')
  })

  it('returns 403 when user is not admin', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: { id: 'user-1' }, error: null })
    mockGetUserRole.mockResolvedValue('calibrator')

    const request = createMockRequest('POST', {
      name: 'Test',
      certificate_type: 'fc',
      cover_blocks: [],
      results_blocks: [],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Akses ditolak')
  })

  it('returns 400 when name is missing', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: { id: 'admin-1' }, error: null })
    mockGetUserRole.mockResolvedValue('admin')

    const request = createMockRequest('POST', {
      certificate_type: 'fc',
      cover_blocks: [],
      results_blocks: [],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Nama template wajib diisi')
  })

  it('returns 400 when certificate_type is missing', async () => {
    mockAuthenticateRequest.mockResolvedValue({ user: { id: 'admin-1' }, error: null })
    mockGetUserRole.mockResolvedValue('admin')

    const request = createMockRequest('POST', {
      name: 'Test Template',
      cover_blocks: [],
      results_blocks: [],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Tipe sertifikat wajib diisi')
  })
})
