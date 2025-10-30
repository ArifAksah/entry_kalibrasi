// Simple component test to verify testing setup works
import { render, screen } from '../utils/test-utils'

// Simple test component
const TestComponent = () => {
  return (
    <div>
      <h1>Test Component</h1>
      <button>Test Button</button>
    </div>
  )
}

describe('Component Testing Setup', () => {
  it('should render a simple component', () => {
    render(<TestComponent />)
    
    expect(screen.getByText('Test Component')).toBeInTheDocument()
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('should have testing library functions available', () => {
    expect(render).toBeDefined()
    expect(screen).toBeDefined()
  })

  it('should have jest matchers available', () => {
    expect(true).toBe(true)
    expect('test').toBe('test')
    expect([1, 2, 3]).toHaveLength(3)
  })
})




