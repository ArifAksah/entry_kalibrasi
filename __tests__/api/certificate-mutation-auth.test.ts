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

const mockRequireCaller = jest.fn()

jest.mock('../../lib/api-auth', () => {
  const { NextResponse } = require('next/server')
  return {
    requireCaller: (...args: unknown[]) => mockRequireCaller(...args),
    isAdminCaller: (caller: { role: string | null }) => caller.role === 'admin',
    forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
  }
})

const mockFrom = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}))

jest.mock('../../lib/email', () => ({ sendAssignmentNotificationEmail: jest.fn() }))

import {
  DELETE as deleteCertificate,
  PUT as updateCertificate,
} from '../../app/api/certificates/[id]/route'
import {
  DELETE as deleteLegacyCertificate,
  PUT as updateLegacyCertificate,
} from '../../app/api/certificates/role-based/route'

type Handler = (request: any, context?: { params: Promise<{ id: string }> }) => Promise<any>

const handlers: Array<[string, Handler, boolean]> = [
  ['certificate PUT', updateCertificate as Handler, true],
  ['certificate DELETE', deleteCertificate as Handler, true],
  ['legacy role-based PUT', updateLegacyCertificate as Handler, false],
  ['legacy role-based DELETE', deleteLegacyCertificate as Handler, false],
]

function request(body: unknown = { id: 7 }) {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  }
}

async function call(handler: Handler, hasParams: boolean, req: ReturnType<typeof request>) {
  return hasParams
    ? handler(req, { params: Promise.resolve({ id: '7' }) })
    : handler(req)
}

function mockCertificate(certificate: Record<string, unknown>) {
  const result = { data: certificate, error: null }
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(result),
        maybeSingle: jest.fn().mockResolvedValue(result),
      }),
    }),
    update: mockUpdate,
    delete: mockDelete,
  })
}

describe('certificate mutation authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(handlers.flatMap(([name, handler, hasParams]) =>
    ['verifikator', 'assignor', 'user_station'].map(role => [name, handler, hasParams, role] as const)
  ))('denies %s for %s before reading or querying', async (_name, handler, hasParams, role) => {
    mockRequireCaller.mockResolvedValue({ user: { id: `${role}-1` }, role })
    const req = request()

    const response = await call(handler, hasParams, req)

    expect(response.status).toBe(403)
    expect(req.json).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it.each(handlers)('denies an unrelated calibrator for %s before mutation', async (_name, handler, hasParams) => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'calibrator-2' }, role: 'calibrator' })
    mockCertificate({ id: 7, status: 'draft', created_by: 'calibrator-1', sent_by: null })
    const req = request()

    const response = await call(handler, hasParams, req)

    expect(response.status).toBe(403)
    expect(req.json).toHaveBeenCalledTimes(hasParams ? 0 : 1)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it.each(handlers)('denies a calibrator owner of a non-draft certificate for %s before mutation', async (_name, handler, hasParams) => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'calibrator-1' }, role: 'calibrator' })
    mockCertificate({ id: 7, status: 'sent', created_by: 'calibrator-1', sent_by: null })
    const req = request()

    const response = await call(handler, hasParams, req)

    expect(response.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
