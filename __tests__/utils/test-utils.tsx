import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Mock AuthContext
const mockAuthContext = {
  user: {
    id: '1',
    email: 'test@example.com',
    role: 'admin'
  },
  loading: false,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn()
}

// Mock data for testing
export const mockCertificate = {
  id: 1,
  no_certificate: 'CERT-001',
  no_order: 'ORD-001',
  no_identification: 'ID-001',
  issue_date: '2024-01-01',
  station: 1,
  instrument: 1,
  authorized_by: 1,
  verifikator_1: 2,
  verifikator_2: 3,
  station_address: 'Test Station Address',
  results: [
    {
      sensorId: 1,
      startDate: '2024-01-01',
      endDate: '2024-01-02',
      place: 'Test Lab',
      environment: [
        { key: 'Temperature', value: '20°C' },
        { key: 'Humidity', value: '50%' }
      ],
      table: [
        {
          title: 'Calibration Results',
          rows: [
            { key: 'Range', unit: 'g', value: '100' },
            { key: 'Accuracy', unit: '%', value: '±0.5' }
          ]
        }
      ],
      images: [],
      notesForm: {
        traceable_to_si_through: 'NIST',
        reference_document: 'ISO 17025',
        calibration_methode: 'Direct comparison',
        others: 'Test notes',
        standardInstruments: [1, 2]
      }
    }
  ],
  status: 'draft',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

export const mockStation = {
  id: 1,
  name: 'Test Station',
  address: 'Test Station Address',
  created_at: '2024-01-01T00:00:00Z'
}

export const mockInstrument = {
  id: 1,
  name: 'Test Instrument',
  manufacturer: 'Test Manufacturer',
  type: 'Test Type',
  serial_number: 'SN-001',
  others: 'Test others',
  station_id: 1,
  memiliki_lebih_satu: false,
  created_at: '2024-01-01T00:00:00Z',
  station: mockStation
}

export const mockPersonel = {
  id: 1,
  name: 'Test Personel',
  email: 'test@example.com',
  role: 'admin',
  created_at: '2024-01-01T00:00:00Z'
}

export const mockSensor = {
  id: 1,
  nama_sensor: 'Test Sensor',
  merk_sensor: 'Test Brand',
  tipe_sensor: 'Test Type',
  serial_number_sensor: 'SN-001',
  range_capacity: '100',
  range_capacity_unit: 'g',
  graduating: '0.1',
  graduating_unit: 'g',
  funnel_diameter: 10,
  funnel_diameter_unit: 'mm',
  volume_per_tip: '1',
  volume_per_tip_unit: 'ml',
  funnel_area: 78.5,
  funnel_area_unit: 'mm²',
  is_standard: false,
  created_at: '2024-01-01T00:00:00Z'
}

// Mock user context
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  role: 'admin'
}

// Mock AuthContext
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="auth-provider">
      {children}
    </div>
  )
}

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockAuthProvider>
      {children}
    </MockAuthProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Simple test to verify test-utils works
describe('Test Utils', () => {
  it('should export render function', () => {
    expect(customRender).toBeDefined()
  })
  
  it('should export mock data', () => {
    expect(mockCertificate).toBeDefined()
    expect(mockStation).toBeDefined()
    expect(mockInstrument).toBeDefined()
  })
})

// Test helpers
export const createMockCertificate = (overrides: Partial<typeof mockCertificate> = {}) => ({
  ...mockCertificate,
  ...overrides
})

export const createMockStation = (overrides: Partial<typeof mockStation> = {}) => ({
  ...mockStation,
  ...overrides
})

export const createMockInstrument = (overrides: Partial<typeof mockInstrument> = {}) => ({
  ...mockInstrument,
  ...overrides
})

export const createMockPersonel = (overrides: Partial<typeof mockPersonel> = {}) => ({
  ...mockPersonel,
  ...overrides
})

export const createMockSensor = (overrides: Partial<typeof mockSensor> = {}) => ({
  ...mockSensor,
  ...overrides
})

// Mock API responses
export const mockApiResponse = <T>(data: T, success = true) => ({
  data,
  error: success ? null : { message: 'Test error' },
  success
})

// Mock fetch for API testing
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  ) as jest.Mock
}

// Mock Supabase response
export const mockSupabaseResponse = <T>(data: T | null, error: any = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK'
})

// Test data generators
export const generateMockCertificates = (count: number) => 
  Array.from({ length: count }, (_, i) => 
    createMockCertificate({ 
      id: i + 1, 
      no_certificate: `CERT-${String(i + 1).padStart(3, '0')}` 
    })
  )

export const generateMockStations = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockStation({
      id: i + 1,
      name: `Station ${i + 1}`,
      address: `Address ${i + 1}`
    })
  )

export const generateMockInstruments = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockInstrument({
      id: i + 1,
      name: `Instrument ${i + 1}`,
      serial_number: `SN-${String(i + 1).padStart(3, '0')}`
    })
  )

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Mock file upload
export const createMockFile = (name: string, type: string, size: number) => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Mock form data
export const createMockFormData = (data: Record<string, any>) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}