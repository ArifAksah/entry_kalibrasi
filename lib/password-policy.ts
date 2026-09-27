export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const PASSWORD_POLICY_ERROR =
  'Password harus 12-128 karakter dan mengandung huruf besar, huruf kecil, angka, dan simbol'

export function validatePassword(password: unknown): string | null {
  if (
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  ) {
    return PASSWORD_POLICY_ERROR
  }

  return null
}
