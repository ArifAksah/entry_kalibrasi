export type CalibrationMethodScope = 'pyranometer' | 'raw_general' | 'tipping_bucket'

export interface CalibrationMethodProfile {
  id?: number
  code: string
  name: string
  instrument_scope: CalibrationMethodScope
  version: number
  source_documents: Array<{ code: string; edition?: string }>
  rules: Record<string, unknown>
  effective_from?: string
  effective_until?: string | null
  is_active: boolean
  notes?: string | null
  adapter_id: CalibrationMethodAdapterId
}

export type CalibrationMethodAdapterId =
  | 'pyranometer-v1'
  | 'raw-general-v1'
  | 'tipping-bucket-v1'

export const CALIBRATION_METHOD_ADAPTERS: Record<CalibrationMethodScope, CalibrationMethodAdapterId> = {
  pyranometer: 'pyranometer-v1',
  raw_general: 'raw-general-v1',
  tipping_bucket: 'tipping-bucket-v1',
}

export const LEGACY_METHOD_PROFILES: Record<CalibrationMethodScope, CalibrationMethodProfile> = {
  pyranometer: {
    code: 'PYR-LEGACY-BMKG',
    name: 'Pyranometer Legacy BMKG',
    instrument_scope: 'pyranometer',
    version: 1,
    source_documents: [
      { code: 'ISO 9060', edition: '2018' },
      { code: 'ISO 9847', edition: '1992' },
      { code: 'WMO-No. 8', edition: '2018' },
    ],
    rules: { cfRule: 'MEAN_ALL_VALID', outlierRule: 'REPORT_ONLY' },
    is_active: true,
    adapter_id: 'pyranometer-v1',
  },
  raw_general: {
    code: 'RAW-QC-GENERAL',
    name: 'Raw Data QC General',
    instrument_scope: 'raw_general',
    version: 1,
    source_documents: [],
    rules: {
      calculationRule: 'STD_CORRECTED_IN_UUT_UNIT_MINUS_UUT',
      uncertaintyRule: 'GENERAL_FIVE_COMPONENT_BUDGET',
    },
    is_active: true,
    adapter_id: 'raw-general-v1',
  },
  tipping_bucket: {
    code: 'RR-LEGACY-V1',
    name: 'Tipping Bucket Legacy Workbook',
    instrument_scope: 'tipping_bucket',
    version: 1,
    source_documents: [
      { code: 'WMO-No. 8', edition: '2018' },
      { code: 'MK 06', edition: 'current' },
    ],
    rules: { calculationRule: 'RR_LEGACY_WORKBOOK' },
    is_active: true,
    adapter_id: 'tipping-bucket-v1',
  },
}

export function legacyCalibrationMethodProfile(scope: CalibrationMethodScope) {
  return LEGACY_METHOD_PROFILES[scope]
}

export async function resolveCalibrationMethodProfile(scope: CalibrationMethodScope) {
  try {
    const response = await fetch('/api/calibration-methods')
    if (!response.ok) return legacyCalibrationMethodProfile(scope)
    const payload = await response.json()
    const profiles = Array.isArray(payload.data) ? payload.data : []
    const today = new Date().toISOString().slice(0, 10)
    const active = profiles
      .filter((item: CalibrationMethodProfile) =>
        item.instrument_scope === scope &&
        item.is_active &&
        (!item.effective_from || item.effective_from <= today) &&
        (!item.effective_until || item.effective_until >= today),
      )
      .sort((a: CalibrationMethodProfile, b: CalibrationMethodProfile) => b.version - a.version)[0]
    return active || legacyCalibrationMethodProfile(scope)
  } catch {
    return legacyCalibrationMethodProfile(scope)
  }
}

export function isRegisteredAdapter(scope: CalibrationMethodScope, adapterId: string) {
  return CALIBRATION_METHOD_ADAPTERS[scope] === adapterId
}
