import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
  validatePassword,
} from '../../lib/password-policy'

describe('password policy', () => {
  it('accepts passwords that meet every requirement', () => {
    expect(validatePassword('ValidPass12!')).toBeNull()
    expect(validatePassword(`Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 4)}`)).toBeNull()
  })

  it.each([
    ['a non-string value', null],
    ['fewer than 12 characters', 'Short1!a'],
    ['more than 128 characters', `Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 3)}`],
    ['no uppercase letter', 'lowercase12!'],
    ['no lowercase letter', 'UPPERCASE12!'],
    ['no digit', 'NoDigitsHere!'],
    ['no symbol', 'NoSymbols123'],
    ['whitespace as the only non-alphanumeric character', 'NoSymbol123 '],
  ])('rejects %s with the standard error', (_case, password) => {
    expect(validatePassword(password)).toBe(PASSWORD_POLICY_ERROR)
  })

  it('exports the documented length limits', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12)
    expect(PASSWORD_MAX_LENGTH).toBe(128)
  })
})
