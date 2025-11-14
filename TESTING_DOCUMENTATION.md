# Testing Documentation

## Overview
This project uses Jest and React Testing Library (RTL) for comprehensive testing of the Next.js dashboard application.

## Testing Stack

### Core Testing Libraries
- **Jest**: JavaScript testing framework
- **React Testing Library**: React component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM elements
- **@testing-library/user-event**: User interaction simulation
- **ts-jest**: TypeScript support for Jest

### Test Environment
- **jsdom**: Browser environment simulation for Node.js
- **Next.js Jest Integration**: Optimized configuration for Next.js

## Project Structure

```
__tests__/
├── components/           # Component tests
│   ├── certificates-crud.test.tsx
│   ├── instruments-crud.test.tsx
│   └── draft-view.test.tsx
├── api/                  # API endpoint tests
│   ├── certificates.test.ts
│   └── instruments.test.ts
└── utils/                # Test utilities
    └── test-utils.tsx

scripts/
└── test.sh              # Test execution script

.github/workflows/
└── test.yml             # CI/CD pipeline

jest.config.js           # Jest configuration
jest.setup.js            # Jest setup file
```

## Configuration Files

### Jest Configuration (`jest.config.js`)
```javascript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/contexts/(.*)$': '<rootDir>/contexts/$1',
  },
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

export default createJestConfig(config)
```

### Jest Setup (`jest.setup.js`)
```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  })),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
```

## Test Utilities

### Test Utils (`__tests__/utils/test-utils.tsx`)
```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { AuthContext } from '../contexts/AuthContext'

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

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthContext.Provider value={{
      user: mockUser,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      updateProfile: jest.fn()
    }}>
      {children}
    </AuthContext.Provider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
```

## Running Tests

### Available Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

### Command Line Usage
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci

# Run specific test file
npm test certificates-crud.test.tsx

# Run tests matching pattern
npm test -- --testPathPattern="components"

# Run tests with verbose output
npm test -- --verbose
```

### Test Script Usage
```bash
# Make script executable
chmod +x scripts/test.sh

# Run full test suite
./scripts/test.sh

# Run tests in watch mode
./scripts/test.sh --watch

# Run tests in CI mode
./scripts/test.sh --ci
```

## Test Categories

### 1. Component Tests
- **CertificatesCRUD**: Tests for certificate management component
- **InstrumentsCRUD**: Tests for instrument management component
- **DraftView**: Tests for draft view and preview functionality

#### Component Test Example
```typescript
describe('CertificatesCRUD', () => {
  it('renders certificate list correctly', () => {
    render(<CertificatesCRUD />)
    
    expect(screen.getByText('Certificates')).toBeInTheDocument()
    expect(screen.getByText('CERT-001')).toBeInTheDocument()
  })

  it('opens add certificate modal when add button is clicked', async () => {
    render(<CertificatesCRUD />)
    
    const addButton = screen.getByText('Add Certificate')
    fireEvent.click(addButton)
    
    await waitFor(() => {
      expect(screen.getByText('Add Certificate')).toBeInTheDocument()
    })
  })
})
```

### 2. API Tests
- **Certificates API**: Tests for certificate CRUD operations
- **Instruments API**: Tests for instrument CRUD operations

#### API Test Example
```typescript
describe('Certificates API', () => {
  it('returns certificates successfully', async () => {
    const mockCertificates = [mockCertificate]
    
    mockSupabase.from().select().order().single.mockResolvedValue(
      mockSupabaseResponse(mockCertificates)
    )

    const request = new NextRequest('http://localhost:3000/api/certificates')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockCertificates)
  })
})
```

### 3. Integration Tests
- **Form Submission**: Tests complete form submission flow
- **Data Flow**: Tests data flow from form to API to database
- **User Interactions**: Tests user interactions and state changes

## Test Coverage

### Coverage Thresholds
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **JSON Report**: `coverage/coverage-final.json`

### Viewing Coverage
```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/lcov-report/index.html
```

## Mocking Strategy

### 1. External Dependencies
- **Supabase**: Mocked client and database operations
- **Next.js Router**: Mocked navigation functions
- **Next.js Image**: Mocked image component

### 2. Hooks
- **useCertificates**: Mocked certificate operations
- **useInstruments**: Mocked instrument operations
- **useStations**: Mocked station operations
- **usePersonel**: Mocked personel operations

### 3. Context Providers
- **AuthContext**: Mocked authentication state
- **User Context**: Mocked user data and permissions

## Best Practices

### 1. Test Structure
- Use `describe` blocks to group related tests
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mocking
- Mock external dependencies
- Use realistic mock data
- Reset mocks between tests

### 3. Assertions
- Use specific assertions
- Test both positive and negative cases
- Test edge cases and error conditions

### 4. Async Testing
- Use `waitFor` for async operations
- Use `findBy` queries for elements that appear asynchronously
- Handle loading states and error states

## CI/CD Integration

### GitHub Actions
```yaml
name: Test Suite

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm run lint
    - run: npx tsc --noEmit
    - run: npm run test:ci
```

### Pre-commit Hooks
```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:ci"
```

## Troubleshooting

### Common Issues

#### 1. Test Environment Issues
```bash
# Clear Jest cache
npx jest --clearCache

# Reset node_modules
rm -rf node_modules package-lock.json
npm install
```

#### 2. Mock Issues
```typescript
// Reset all mocks
beforeEach(() => {
  jest.clearAllMocks()
})

// Reset specific mock
mockFunction.mockReset()
```

#### 3. Async Issues
```typescript
// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
})

// Use findBy queries
const element = await screen.findByText('Expected Text')
expect(element).toBeInTheDocument()
```

### Debug Mode
```bash
# Run tests in debug mode
npm test -- --detectOpenHandles --forceExit

# Run specific test in debug mode
npm test -- --testNamePattern="specific test" --verbose
```

## Performance Testing

### Test Performance
```bash
# Run tests with performance info
npm test -- --verbose --detectSlowTests

# Run tests with memory usage
npm test -- --logHeapUsage
```

### Coverage Performance
```bash
# Generate coverage without source maps
npm test -- --coverage --coverageReporters=text

# Generate coverage with specific reporters
npm test -- --coverage --coverageReporters=html,text,lcov
```

## Future Enhancements

### 1. E2E Testing
- Add Playwright or Cypress for end-to-end testing
- Test complete user workflows
- Test cross-browser compatibility

### 2. Visual Testing
- Add visual regression testing
- Test component appearance
- Test responsive design

### 3. Performance Testing
- Add performance benchmarks
- Test component rendering performance
- Test API response times

### 4. Accessibility Testing
- Add accessibility testing
- Test keyboard navigation
- Test screen reader compatibility








