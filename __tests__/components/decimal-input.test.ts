import { parseDecimalInput } from '../../components/ui/DecimalInput'

describe('parseDecimalInput', () => {
  it('menerima desimal dengan koma', () => {
    expect(parseDecimalInput('200,72')).toBeCloseTo(200.72, 10)
    expect(parseDecimalInput('0,2')).toBeCloseTo(0.2, 10)
    expect(parseDecimalInput('-6,5')).toBeCloseTo(-6.5, 10)
  })

  it('menerima desimal dengan titik', () => {
    expect(parseDecimalInput('200.72')).toBeCloseTo(200.72, 10)
    expect(parseDecimalInput('0.2')).toBeCloseTo(0.2, 10)
  })

  it('mengabaikan spasi', () => {
    expect(parseDecimalInput('1 234,5')).toBeCloseTo(1234.5, 10)
  })

  it('fallback untuk nilai kosong/invalid', () => {
    expect(parseDecimalInput('', 0)).toBe(0)
    expect(parseDecimalInput(null, 0)).toBe(0)
    expect(parseDecimalInput(undefined, 0)).toBe(0)
    expect(parseDecimalInput('abc', 0)).toBe(0)
    expect(parseDecimalInput('abc', 5)).toBe(5)
  })
})
