const mockSendAssignmentNotificationEmail = jest.fn()
const mockCreateCertificateLog = jest.fn()

;(global as any).Request =
  (global as any).Request ||
  class Request {}

;(global as any).Headers =
  (global as any).Headers ||
  class Headers {
    private map: Record<string, string>

    constructor(init?: Record<string, string>) {
      this.map = Object.fromEntries(
        Object.entries(init || {}).map(([key, value]) => [key.toLowerCase(), value])
      )
    }

    get(key: string) {
      return this.map[key.toLowerCase()] ?? null
    }

    set(key: string, value: string) {
      this.map[key.toLowerCase()] = value
    }
  }

;(global as any).Response =
  (global as any).Response ||
  class Response {
    body: string
    status: number
    headers: InstanceType<any>

    constructor(body?: string, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body || ''
      this.status = init?.status || 200
      this.headers = new (global as any).Headers(init?.headers)
    }

    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new (global as any).Response(JSON.stringify(data), {
        status: init?.status,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers || {}),
        },
      })
    }

    async json() {
      return JSON.parse(this.body || 'null')
    }
  }

const mockSupabaseAdmin = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
}

const mockCreateClient = jest.fn(() => mockSupabaseAdmin)

jest.mock('../../lib/supabase', () => ({
  supabase: {},
  supabaseAdmin: mockSupabaseAdmin,
}))

jest.mock('../../lib/email', () => ({
  sendAssignmentNotificationEmail: (...args: unknown[]) =>
    mockSendAssignmentNotificationEmail(...args),
}))

jest.mock('../../../../lib/certificate-log-helper', () => ({
  createCertificateLog: (...args: unknown[]) => mockCreateCertificateLog(...args),
}), { virtual: true })

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

function createRequest(url: string, body: unknown) {
  return {
    url,
    method: 'POST',
    headers: {
      get: (key: string) => {
        const normalized = key.toLowerCase()
        if (normalized === 'authorization') return 'Bearer test-token'
        if (normalized === 'content-type') return 'application/json'
        return null
      },
    },
    json: async () => body,
  }
}

describe('certificate routes normalize results wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  it('POST /api/certificates mengirim payload V1 ke RPC saat body masih legacy V0', async () => {
    const body = {
      no_identification: 'ID-001',
      issue_date: '2026-04-25',
      verifikator_1: 'ver-1',
      verifikator_2: 'ver-2',
      verifikator_3: 'ver-3',
      instrument_code: 'AWS',
      calibration_place: 'FC',
      results: [
        {
          place: 'Lab Kalibrasi',
          sensorId: 42,
          sensorDetails: { name: 'Sensor Suhu' },
          notesForm: {},
          table: [],
          images: [],
          environment: [],
        },
      ],
    }

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }
      }

      if (table === 'personel') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'ok' },
            error: null,
          }),
        }
      }

      if (table === 'certificate_logs') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null,
          }),
        }
      }

      throw new Error(`Unexpected table in POST test: ${table}`)
    })

    mockSupabaseAdmin.rpc.mockResolvedValue({
      data: [{ id: 77, no_certificate: 'SERT/001', no_order: '001' }],
      error: null,
    })

    const { POST } = await import('../../app/api/certificates/route')
    const response = await POST(createRequest('http://localhost/api/certificates', body) as any)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.id).toBe(77)
    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledTimes(1)

    const rpcPayload = mockSupabaseAdmin.rpc.mock.calls[0][1].p_data
    expect(rpcPayload.results.schema_version).toBe(1)
    expect(rpcPayload.results.calibration_kind).toBe('FC')
    expect(rpcPayload.results.sensors[0].links.sensor_id).toBe(42)
  })

  it('PUT /api/certificates/[id] menormalisasi results legacy sebelum update', async () => {
    const body = {
      no_certificate: 'SERT/001',
      no_order: '001',
      no_identification: 'ID-001',
      issue_date: '2026-04-25',
      results: [
        {
          place: 'Lab Uji',
          sensorId: 55,
          sensorDetails: { name: 'Sensor Tekanan' },
          notesForm: {},
          table: [],
          images: [],
          environment: [],
        },
      ],
    }

    let certificateSelectCount = 0
    let updatePayload: any = null

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'certificate') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockImplementation(async () => {
            certificateSelectCount += 1
            if (certificateSelectCount === 1) {
              return {
                data: {
                  id: 99,
                  version: 1,
                  status: 'draft',
                  no_certificate: 'SERT/001',
                  no_order: '001',
                  no_identification: 'ID-001',
                  issue_date: '2026-04-25',
                  station: null,
                  instrument: null,
                  station_address: null,
                  results: null,
                  calibration_place: 'FC',
                  calibration_kind: 'FC',
                  results_frozen_at: null,
                  authorized_by: null,
                  verifikator_1: null,
                  verifikator_2: null,
                  verifikator_3: null,
                },
                error: null,
              }
            }

            return {
              data: { status: 'draft' },
              error: null,
            }
          }),
          update: jest.fn().mockImplementation((payload) => {
            updatePayload = payload
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 99, ...payload },
                    error: null,
                  }),
                }),
              }),
            }
          }),
        }
      }

      if (table === 'certificate_verification') {
        return {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'personel') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
            error: null,
          }),
        }
      }

      if (table === 'certificate_logs') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null,
          }),
        }
      }

      throw new Error(`Unexpected table in PUT test: ${table}`)
    })

    const { PUT } = await import('../../app/api/certificates/[id]/route')
    const response = await PUT(
      createRequest('http://localhost/api/certificates/99', body) as any,
      { params: Promise.resolve({ id: '99' }) }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.id).toBe(99)
    expect(updatePayload).not.toBeNull()
    expect(updatePayload.results.schema_version).toBe(1)
    expect(updatePayload.results.calibration_kind).toBe('FC')
    expect(updatePayload.results.sensors[0].links.sensor_id).toBe(55)
  })
})
