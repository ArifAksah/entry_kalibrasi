# Testing Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### 3. Using Test Scripts

#### Windows (PowerShell)
```powershell
# Run all tests
.\scripts\test.ps1

# Run tests in watch mode
.\scripts\test.ps1 -Watch

# Run tests in CI mode
.\scripts\test.ps1 -CI

# Show help
.\scripts\test.ps1 -Help
```

#### Linux/macOS (Bash)
```bash
# Make script executable
chmod +x scripts/test.sh

# Run all tests
./scripts/test.sh

# Run tests in watch mode
./scripts/test.sh --watch

# Run tests in CI mode
./scripts/test.sh --ci
```

## Test Structure

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
```

## Test Categories

### 1. Component Tests
- **CertificatesCRUD**: Certificate management component
- **InstrumentsCRUD**: Instrument management component  
- **DraftView**: Draft view and preview functionality

### 2. API Tests
- **Certificates API**: Certificate CRUD operations
- **Instruments API**: Instrument CRUD operations

### 3. Integration Tests
- Form submission flows
- Data flow from form to API
- User interactions and state changes

## Coverage Requirements

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Viewing Coverage Reports

After running tests with coverage:
```bash
# Open coverage report in browser
open coverage/lcov-report/index.html
```

## CI/CD Integration

Tests run automatically on:
- Push to main/master/develop branches
- Pull requests to main/master/develop branches

## Troubleshooting

### Common Issues

1. **Test Environment Issues**
   ```bash
   # Clear Jest cache
   npx jest --clearCache
   
   # Reset node_modules
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Mock Issues**
   ```typescript
   // Reset all mocks
   beforeEach(() => {
     jest.clearAllMocks()
   })
   ```

3. **Async Issues**
   ```typescript
   // Use waitFor for async operations
   await waitFor(() => {
     expect(screen.getByText('Expected Text')).toBeInTheDocument()
   })
   ```

### Debug Mode
```bash
# Run tests in debug mode
npm test -- --detectOpenHandles --forceExit

# Run specific test in debug mode
npm test -- --testNamePattern="specific test" --verbose
```

## Available Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:ci` | Run tests in CI mode |
| `npm test -- --testPathPattern="components"` | Run component tests only |
| `npm test -- --testPathPattern="api"` | Run API tests only |
| `npm test -- --verbose` | Run tests with verbose output |

## Test Files

### Component Tests
- `certificates-crud.test.tsx` - Tests certificate CRUD operations
- `instruments-crud.test.tsx` - Tests instrument CRUD operations
- `draft-view.test.tsx` - Tests draft view and preview functionality

### API Tests
- `certificates.test.ts` - Tests certificate API endpoints
- `instruments.test.ts` - Tests instrument API endpoints

### Test Utilities
- `test-utils.tsx` - Shared test utilities and mock data

## Mock Data

The test suite includes comprehensive mock data for:
- Certificates
- Instruments
- Stations
- Personel
- Sensors
- Users

## Best Practices

1. **Test Structure**: Use `describe` blocks to group related tests
2. **Descriptive Names**: Use clear, descriptive test names
3. **AAA Pattern**: Follow Arrange, Act, Assert pattern
4. **Mocking**: Mock external dependencies and use realistic data
5. **Async Testing**: Use `waitFor` and `findBy` queries for async operations
6. **Edge Cases**: Test both positive and negative cases
7. **Error Handling**: Test error conditions and edge cases

## Performance

- Tests run in parallel when possible
- Coverage collection is optimized for speed
- Mock data is lightweight and realistic
- CI/CD pipeline is optimized for fast feedback

## Future Enhancements

- E2E testing with Playwright/Cypress
- Visual regression testing
- Performance benchmarking
- Accessibility testing
- Cross-browser testing




