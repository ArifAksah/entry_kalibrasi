jest.mock('next/server', () => {
  class MockNextRequest {
    method: string
    private body: unknown

    constructor(_url: string, init?: { method?: string; body?: string }) {
      this.method = init?.method || 'GET'
      this.body = init?.body ? JSON.parse(init.body) : null
    }

    async json() {
      return this.body
    }
  }

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

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse }
})

const mockRequireRoles = jest.fn()
jest.mock('../../lib/api-auth', () => ({
  requireRoles: (...args: unknown[]) => mockRequireRoles(...args),
}))

const mockFrom = jest.fn()
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { POST } from '../../app/api/stations/route'
import { PUT } from '../../app/api/stations/[id]/route'

const stationPayload = {
  station_id: '96745',
  name: 'Stasiun Uji',
  address: 'Alamat Uji',
  latitude: -6.2,
  longitude: 106.8,
  elevation: 10,
  time_zone: 'UTC+07:00',
  region: 'Region I',
  province: 'DKI Jakarta',
  regency: 'Jakarta Pusat',
  type_id: 3,
  created_by: 'user-1',
}

function mockPersonelLookup() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-1' },
          error: null,
        }),
      }),
    }),
  }
}

describe('station mutation response shape', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoles.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'admin',
    })
  })

  it('PUT returns the updated station with station_type relation', async () => {
    const select = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: {
          ...stationPayload,
          id: 12,
          station_type: { name: 'Geofisika' },
        },
        error: null,
      }),
    })
    const stationQuery = {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ select }),
      }),
    }

    mockFrom.mockImplementation((table: string) =>
      table === 'personel' ? mockPersonelLookup() : stationQuery,
    )

    const request = new (require('next/server').NextRequest)('/api/stations/12', {
      method: 'PUT',
      body: JSON.stringify(stationPayload),
    })
    const response = await PUT(request, {
      params: Promise.resolve({ id: '12' }),
    })
    const data = await response.json()

    expect(select).toHaveBeenCalledWith('*, station_type(name)')
    expect(data.station_type.name).toBe('Geofisika')
  })

  it('POST returns the created station with station_type relation', async () => {
    const select = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: {
          ...stationPayload,
          id: 13,
          station_type: { name: 'Geofisika' },
        },
        error: null,
      }),
    })
    const stationQuery = {
      insert: jest.fn().mockReturnValue({ select }),
    }

    mockFrom.mockImplementation((table: string) =>
      table === 'personel' ? mockPersonelLookup() : stationQuery,
    )

    const request = new (require('next/server').NextRequest)('/api/stations', {
      method: 'POST',
      body: JSON.stringify(stationPayload),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(select).toHaveBeenCalledWith('*, station_type(name)')
    expect(response.status).toBe(201)
    expect(data.station_type.name).toBe('Geofisika')
  })
})
