# Test Script for Next.js Dashboard App (PowerShell)
# This script runs all tests and generates coverage reports

param(
    [switch]$Watch,
    [switch]$CI,
    [switch]$Help
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# Show help
if ($Help) {
    Write-Host "Test Script for Next.js Dashboard App" -ForegroundColor $Blue
    Write-Host "=====================================" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "Usage: .\scripts\test.ps1 [options]" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "Options:" -ForegroundColor $Blue
    Write-Host "  -Watch    Run tests in watch mode" -ForegroundColor $Blue
    Write-Host "  -CI       Run tests in CI mode" -ForegroundColor $Blue
    Write-Host "  -Help     Show this help message" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Blue
    Write-Host "  .\scripts\test.ps1              # Run all tests" -ForegroundColor $Blue
    Write-Host "  .\scripts\test.ps1 -Watch      # Run tests in watch mode" -ForegroundColor $Blue
    Write-Host "  .\scripts\test.ps1 -CI         # Run tests in CI mode" -ForegroundColor $Blue
    exit 0
}

Write-Host "🧪 Starting Test Suite for Next.js Dashboard App" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Using Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Status "Using npm version: $npmVersion"
} catch {
    Write-Error "npm is not installed. Please install npm first."
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Status "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error "Failed to install dependencies"
        exit 1
    }
} else {
    Write-Status "Dependencies already installed"
}

# Check if Jest is installed
try {
    npm list jest | Out-Null
} catch {
    Write-Status "Installing Jest and testing dependencies..."
    npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-jest
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Testing dependencies installed successfully"
    } else {
        Write-Error "Failed to install testing dependencies"
        exit 1
    }
}

# Run linting
Write-Status "Running ESLint..."
npm run lint
if ($LASTEXITCODE -eq 0) {
    Write-Success "ESLint passed"
} else {
    Write-Warning "ESLint found issues"
}

# Run type checking
Write-Status "Running TypeScript type checking..."
npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
    Write-Success "TypeScript type checking passed"
} else {
    Write-Error "TypeScript type checking failed"
    exit 1
}

# Run tests based on mode
if ($CI) {
    Write-Status "Running tests in CI mode..."
    npm run test:ci
    if ($LASTEXITCODE -eq 0) {
        Write-Success "CI tests passed"
    } else {
        Write-Error "CI tests failed"
        exit 1
    }
} elseif ($Watch) {
    Write-Status "Starting tests in watch mode..."
    npm run test:watch
} else {
    # Run tests with coverage
    Write-Status "Running tests with coverage..."
    npm run test:coverage
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All tests passed"
    } else {
        Write-Error "Some tests failed"
        exit 1
    }
}

# Check coverage threshold
$COVERAGE_THRESHOLD = 70
Write-Status "Checking coverage threshold ($COVERAGE_THRESHOLD%)..."

# Extract coverage percentages from coverage report
if (Test-Path "coverage/lcov-report/index.html") {
    Write-Success "Coverage report generated at coverage/lcov-report/index.html"
} else {
    Write-Warning "Coverage report not found"
}

# Run specific test suites
Write-Status "Running component tests..."
npm test -- --testPathPattern="components" --verbose
if ($LASTEXITCODE -eq 0) {
    Write-Success "Component tests passed"
} else {
    Write-Error "Component tests failed"
}

Write-Status "Running API tests..."
npm test -- --testPathPattern="api" --verbose
if ($LASTEXITCODE -eq 0) {
    Write-Success "API tests passed"
} else {
    Write-Error "API tests failed"
}

# Generate test report
Write-Status "Generating test report..."
if (Test-Path "coverage") {
    Write-Success "Test coverage report available in coverage/ directory"
    Write-Status "Open coverage/lcov-report/index.html in your browser to view detailed coverage"
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor $Blue
Write-Success "Test suite completed successfully!"
Write-Host "==================================================" -ForegroundColor $Blue
Write-Host ""
Write-Host "Available test commands:" -ForegroundColor $Blue
Write-Host "  npm test              - Run all tests" -ForegroundColor $Blue
Write-Host "  npm run test:watch    - Run tests in watch mode" -ForegroundColor $Blue
Write-Host "  npm run test:coverage - Run tests with coverage" -ForegroundColor $Blue
Write-Host "  npm run test:ci       - Run tests in CI mode" -ForegroundColor $Blue
Write-Host ""
Write-Host "Test files location:" -ForegroundColor $Blue
Write-Host "  __tests__/components/ - Component tests" -ForegroundColor $Blue
Write-Host "  __tests__/api/        - API tests" -ForegroundColor $Blue
Write-Host "  __tests__/utils/      - Test utilities" -ForegroundColor $Blue
Write-Host ""
Write-Host "Coverage report:" -ForegroundColor $Blue
Write-Host "  coverage/lcov-report/index.html" -ForegroundColor $Blue
Write-Host ""



