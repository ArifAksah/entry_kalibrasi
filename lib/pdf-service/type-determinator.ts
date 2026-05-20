/**
 * Type Determinator for the Flexible Certificate PDF Service.
 *
 * Pure function that maps certificate data to a CertificateType string
 * based on priority rules defined in Requirements 9.1–9.6.
 *
 * Priority order:
 * 1. is_standard = true → 'standar'
 * 2. balai_id not null → '{place}_balai_{id}'
 * 3. calibration_place without balai → 'fc' or 'lc'
 * 4. fallback → 'fc' (with warning logged)
 */

import type { CertificateType, CertificateTypeInput } from './types'

/**
 * Resolves the effective calibration place from input fields.
 * Uses `calibration_place` as primary, falls back to `calibration_kind` for legacy records.
 * Returns 'fc' or 'lc' in lowercase, or null if neither field is available.
 */
function resolveCalibrationPlace(input: CertificateTypeInput): 'fc' | 'lc' | null {
  const place = input.calibration_place ?? input.calibration_kind ?? null
  if (place === null) return null
  return place.toLowerCase() as 'fc' | 'lc'
}

/**
 * Determines the CertificateType based on priority rules:
 *
 * 1. is_standard = true → 'standar' (regardless of other fields)
 * 2. balai_id not null → '{place}_balai_{id}' (e.g., 'fc_balai_3')
 * 3. calibration_place = 'LC' without balai → 'lc'
 * 4. calibration_place = 'FC' without balai → 'fc'
 * 5. fallback (null calibration_place) → 'fc' with warning logged
 *
 * Legacy handling: if `calibration_place` is null, `calibration_kind` is used as fallback.
 *
 * @param input - Certificate data fields used for type determination
 * @param certificateId - Optional certificate ID for warning log context
 * @returns The determined CertificateType
 */
export function determineCertificateType(
  input: CertificateTypeInput,
  certificateId?: number | string
): CertificateType {
  // Priority 1: is_standard = true → 'standar'
  if (input.is_standard === true) {
    return 'standar'
  }

  // Resolve effective calibration place (with legacy fallback)
  const place = resolveCalibrationPlace(input)

  // Priority 2: balai_id not null → '{place}_balai_{id}'
  if (input.balai_id != null) {
    const effectivePlace = place ?? 'fc'

    if (place === null) {
      console.warn(
        `[PDF Service] Certificate ${certificateId ?? 'unknown'}: calibration_place is null with balai_id=${input.balai_id}, defaulting place to 'fc'`
      )
    }

    const balaiId = input.balai_id
    return `${effectivePlace}_balai_${balaiId}` as CertificateType
  }

  // Priority 3: calibration_place = 'LC' → 'lc'
  if (place === 'lc') {
    return 'lc'
  }

  // Priority 4: calibration_place = 'FC' → 'fc'
  if (place === 'fc') {
    return 'fc'
  }

  // Priority 5: fallback → 'fc' with warning
  console.warn(
    `[PDF Service] Certificate ${certificateId ?? 'unknown'}: unable to determine certificate type from available fields (calibration_place=${input.calibration_place}, calibration_kind=${input.calibration_kind}, is_standard=${input.is_standard}), defaulting to 'fc'`
  )
  return 'fc'
}
