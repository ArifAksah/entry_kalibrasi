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

const mockRequireAdmin = jest.fn()
const mockRequireRoles = jest.fn()
const mockRequireCaller = jest.fn()

jest.mock('../../lib/api-auth', () => {
  const { NextResponse } = require('next/server')
  return {
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
    requireRoles: (...args: unknown[]) => mockRequireRoles(...args),
    requireCaller: (...args: unknown[]) => mockRequireCaller(...args),
    isAdminCaller: (caller: { role: string | null }) => caller.role === 'admin',
    forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message: string) => NextResponse.json({ error: message }, { status: 404 }),
  }
})

const mockFrom = jest.fn()

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}))

jest.mock('../../lib/wa', () => ({ sendWhatsApp: jest.fn() }))
jest.mock('../../lib/wa-messages', () => ({ buildDraftSubmissionMessage: jest.fn() }))

import * as endpointCatalog from '../../app/api/endpoint-catalog/route'
import * as endpointCatalogScan from '../../app/api/endpoint-catalog/scan/route'
import * as masterQc from '../../app/api/master-qc/route'
import * as masterQcById from '../../app/api/master-qc/[id]/route'
import * as units from '../../app/api/units/route'
import * as instrumentCode from '../../app/api/instrument-code/route'
import * as instrumentCodeById from '../../app/api/instrument-code/[id]/route'
import * as instrumentNames from '../../app/api/instrument-names/route'
import * as instrumentNamesById from '../../app/api/instrument-names/[id]/route'
import * as sensorNames from '../../app/api/sensor-names/route'
import * as sensorNamesById from '../../app/api/sensor-names/[id]/route'
import * as notes from '../../app/api/notes/route'
import * as notesById from '../../app/api/notes/[id]/route'
import * as notesInstrumentStandard from '../../app/api/notes-instrumen-standard/route'
import * as notesInstrumentStandardById from '../../app/api/notes-instrumen-standard/[id]/route'
import * as certStandards from '../../app/api/cert-standards/route'
import * as certStandardsById from '../../app/api/cert-standards/[id]/route'
import { POST as sendToVerifiers } from '../../app/api/certificates/[id]/send-to-verifiers/route'
import { POST as addTimestamp } from '../../app/api/timestamp/route'
import { POST as uploadCertificateImage } from '../../app/api/uploads/certificates/route'

const { NextResponse } = require('next/server')

function request(body: unknown = {}) {
  return {
    url: 'http://localhost/api/test?id=1',
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as any
}

describe('service-role mutation authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['POST', endpointCatalog.POST],
    ['PUT', endpointCatalog.PUT],
    ['DELETE', endpointCatalog.DELETE],
    ['scan', endpointCatalogScan.POST],
  ])('requires admin for endpoint catalog %s', async (_name, handler) => {
    const denied = NextResponse.json({ error: 'admin only' }, { status: 403 })
    mockRequireAdmin.mockResolvedValue(denied)
    const req = request()

    expect(await handler(req)).toBe(denied)
    expect(req.json).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it.each([
    ['master QC POST', masterQc.POST, false],
    ['master QC PUT', masterQcById.PUT, true],
    ['master QC DELETE', masterQcById.DELETE, true],
    ['units POST', units.POST, false],
    ['units PUT', units.PUT, false],
    ['units DELETE', units.DELETE, false],
    ['instrument code POST', instrumentCode.POST, false],
    ['instrument code PUT', instrumentCodeById.PUT, true],
    ['instrument code DELETE', instrumentCodeById.DELETE, true],
    ['instrument names POST', instrumentNames.POST, false],
    ['instrument names PUT', instrumentNamesById.PUT, true],
    ['instrument names DELETE', instrumentNamesById.DELETE, true],
    ['sensor names POST', sensorNames.POST, false],
    ['sensor names PUT', sensorNamesById.PUT, true],
    ['sensor names DELETE', sensorNamesById.DELETE, true],
    ['notes POST', notes.POST, false],
    ['notes PUT', notesById.PUT, true],
    ['notes DELETE', notesById.DELETE, true],
    ['notes instrument standard POST', notesInstrumentStandard.POST, false],
    ['notes instrument standard PUT', notesInstrumentStandardById.PUT, true],
    ['notes instrument standard DELETE', notesInstrumentStandardById.DELETE, true],
    ['certificate standards POST', certStandards.POST, false],
    ['certificate standards PUT', certStandardsById.PUT, true],
    ['certificate standards DELETE', certStandardsById.DELETE, true],
    ['certificate image upload', uploadCertificateImage, false],
  ])('requires admin/calibrator for %s', async (_name, handler, hasParams) => {
    const denied = NextResponse.json({ error: 'role denied' }, { status: 403 })
    mockRequireRoles.mockResolvedValue(denied)
    const req = request()
    const response = hasParams
      ? await (handler as any)(req, { params: Promise.resolve({ id: '1' }) })
      : await (handler as any)(req)

    expect(response).toBe(denied)
    expect(mockRequireRoles).toHaveBeenCalledWith(req, ['admin', 'calibrator'])
    expect(req.json).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('certificate actor authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects a calibrator who does not own the certificate and ignores spoofed sent_by', async () => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'calibrator-2' }, role: 'calibrator' })
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 7, created_by: 'calibrator-1', sent_by: null },
            error: null,
          }),
        }),
      }),
    })
    const req = request({ sent_by: 'calibrator-1' })

    const response = await sendToVerifiers(req, { params: Promise.resolve({ id: '7' }) })

    expect(response.status).toBe(403)
    expect(req.json).not.toHaveBeenCalled()
  })

  it('accepts ownership from created_by without reading sent_by from the body', async () => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'calibrator-1' }, role: 'calibrator' })
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 7,
              created_by: 'calibrator-1',
              sent_by: null,
              status: 'sent',
            },
            error: null,
          }),
        }),
      }),
    })
    const req = request({ sent_by: 'spoofed-user' })

    const response = await sendToVerifiers(req, { params: Promise.resolve({ id: '7' }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Certificate is not in draft status' })
    expect(req.json).not.toHaveBeenCalled()
  })
})

describe('timestamp authorization', () => {
  const originalMock = process.env.BSRE_MOCK

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BSRE_MOCK = 'true'
  })

  afterAll(() => {
    process.env.BSRE_MOCK = originalMock
  })

  it('rejects callers other than the signer or admin', async () => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'other-user' }, role: 'calibrator' })
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 7, authorized_by: 'signer-1' },
            error: null,
          }),
        }),
      }),
    })

    const response = await addTimestamp(request({ documentId: 7, documentHash: 'hash' }))

    expect(response.status).toBe(403)
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('allows the assigned signer', async () => {
    mockRequireCaller.mockResolvedValue({ user: { id: 'signer-1' }, role: 'assignor' })
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 7, authorized_by: 'signer-1' },
      error: null,
    })
    const updateEqLevel = jest.fn().mockResolvedValue({ error: null })
    const updateEqCertificate = jest.fn().mockReturnValue({ eq: updateEqLevel })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'certificate') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle }) }) }
      }
      return { update: jest.fn().mockReturnValue({ eq: updateEqCertificate }) }
    })

    const response = await addTimestamp(request({ documentId: 7, documentHash: 'hash' }))

    expect(response.status).toBe(200)
    expect(updateEqCertificate).toHaveBeenCalledWith('certificate_id', 7)
    expect(updateEqLevel).toHaveBeenCalledWith('verification_level', 3)
  })
})
