#!/bin/bash

# Test Script for Next.js Dashboard App
# This script runs all tests and generates coverage reports

set -e

echo "🧪 Starting Test Suite for Next.js Dashboard App"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Get Node.js version
NODE_VERSION=$(node --version)
print_status "Using Node.js version: $NODE_VERSION"

# Get npm version
NPM_VERSION=$(npm --version)
print_status "Using npm version: $NPM_VERSION"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies already installed"
fi

# Check if Jest is installed
if ! npm list jest &> /dev/null; then
    print_status "Installing Jest and testing dependencies..."
    npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-jest
    if [ $? -eq 0 ]; then
        print_success "Testing dependencies installed successfully"
    else
        print_error "Failed to install testing dependencies"
        exit 1
    fi
fi

# Run linting
print_status "Running ESLint..."
npm run lint
if [ $? -eq 0 ]; then
    print_success "ESLint passed"
else
    print_warning "ESLint found issues"
fi

# Run type checking
print_status "Running TypeScript type checking..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    print_success "TypeScript type checking passed"
else
    print_error "TypeScript type checking failed"
    exit 1
fi

# Run tests with coverage
print_status "Running tests with coverage..."
npm run test:coverage
if [ $? -eq 0 ]; then
    print_success "All tests passed"
else
    print_error "Some tests failed"
    exit 1
fi

# Check coverage threshold
COVERAGE_THRESHOLD=70
print_status "Checking coverage threshold ($COVERAGE_THRESHOLD%)..."

# Extract coverage percentages from coverage report
if [ -f "coverage/lcov-report/index.html" ]; then
    print_success "Coverage report generated at coverage/lcov-report/index.html"
else
    print_warning "Coverage report not found"
fi

# Run specific test suites
print_status "Running component tests..."
npm test -- --testPathPattern="components" --verbose
if [ $? -eq 0 ]; then
    print_success "Component tests passed"
else
    print_error "Component tests failed"
fi

print_status "Running API tests..."
npm test -- --testPathPattern="api" --verbose
if [ $? -eq 0 ]; then
    print_success "API tests passed"
else
    print_error "API tests failed"
fi

# Run tests in watch mode if requested
if [ "$1" = "--watch" ]; then
    print_status "Starting tests in watch mode..."
    npm run test:watch
fi

# Run tests in CI mode if requested
if [ "$1" = "--ci" ]; then
    print_status "Running tests in CI mode..."
    npm run test:ci
    if [ $? -eq 0 ]; then
        print_success "CI tests passed"
    else
        print_error "CI tests failed"
        exit 1
    fi
fi

# Generate test report
print_status "Generating test report..."
if [ -d "coverage" ]; then
    print_success "Test coverage report available in coverage/ directory"
    print_status "Open coverage/lcov-report/index.html in your browser to view detailed coverage"
fi

# Summary
echo ""
echo "=================================================="
print_success "Test suite completed successfully!"
echo "=================================================="
echo ""
echo "Available test commands:"
echo "  npm test              - Run all tests"
echo "  npm run test:watch    - Run tests in watch mode"
echo "  npm run test:coverage - Run tests with coverage"
echo "  npm run test:ci       - Run tests in CI mode"
echo ""
echo "Test files location:"
echo "  __tests__/components/ - Component tests"
echo "  __tests__/api/        - API tests"
echo "  __tests__/utils/      - Test utilities"
echo ""
echo "Coverage report:"
echo "  coverage/lcov-report/index.html"
echo ""














