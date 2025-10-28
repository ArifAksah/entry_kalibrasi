// Simple test to verify Jest setup
describe('Jest Setup Test', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have jest functions available', () => {
    expect(jest.fn).toBeDefined()
    expect(jest.mock).toBeDefined()
  })
})