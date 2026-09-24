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

const mockRequireRoles = jest.fn()
jest.mock('../../lib/api-auth', () => ({
  requireRoles: (...args: unknown[]) => mockRequireRoles(...args),
}))

const mockRawDataFrom = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (...args: unknown[]) => mockRawDataFrom(...args) }),
}))

const mockSessionFrom = jest.fn()
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSessionFrom(...args) },
}))

import * as rawData from '../../app/api/raw-data/route'
import * as calibrationSessions from '../../app/api/calibration-sessions/route'

const { NextResponse } = require('next/server')

function request() {
  return {
    json: jest.fn().mockResolvedValue({}),
  } as any
}

describe('raw data and calibration session mutation authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['raw data POST', rawData.POST],
    ['raw data PUT', rawData.PUT],
    ['raw data PATCH', rawData.PATCH],
    ['calibration sessions POST', calibrationSessions.POST],
    ['calibration sessions PUT', calibrationSessions.PUT],
  ])('denies %s before parsing or accessing the service database', async (_name, handler) => {
    const denied = NextResponse.json({ error: 'role denied' }, { status: 403 })
    mockRequireRoles.mockResolvedValue(denied)
    const req = request()

    expect(await handler(req)).toBe(denied)
    expect(mockRequireRoles).toHaveBeenCalledWith(req, ['admin', 'calibrator'])
    expect(req.json).not.toHaveBeenCalled()
    expect(mockRawDataFrom).not.toHaveBeenCalled()
    expect(mockSessionFrom).not.toHaveBeenCalled()
  })
})
