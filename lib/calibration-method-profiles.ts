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

// ═══════════════════════════════════════════════════════════════
// KONTRAK METODE PYRANOMETER (rules bertipe, bisa dikonfigurasi)
// ═══════════════════════════════════════════════════════════════
// Tiap komponen uncertainty memuat: bagaimana menghitung (distribusi,
// pembagi, derajat bebas, faktor) + provenance (dari dokumen mana nilainya),
// sehingga petugas tahu asal angka dan bisa mengubah bagian yang memang
// konvensi — tanpa menyentuh tipping bucket (RR) / raw_general (AWOS/AWS).

export type RuleClassification = 'KONSTANTA' | 'SPESIFIKASI' | 'VARIABEL'

export interface RuleSource {
  /** Dokumen sumber, mis. 'pyranometer.xlsx' atau 'ISO 9060:2018'. */
  doc: string
  /** Lokasi/rujukan, mis. 'Hit U!G15'. */
  ref: string
  /** Sifat nilai: konstanta metode, spesifikasi traceable, atau variabel data. */
  classification: RuleClassification
}

export type PyranometerComponentKey =
  | 'repeat'
  | 'cert_std'
  | 'res_std'
  | 'drift_std'
  | 'res_uut'

export interface PyranometerComponentRule {
  key: PyranometerComponentKey
  label: string
  enabled: boolean
  distribution: 'normal' | 'rect'
  /** Pembagi: angka tetap, 'sqrt_n' (√jumlah pasangan), 'sqrt3', atau '2'. */
  divisor: number | 'sqrt_n' | 'sqrt3' | '2'
  vi: { type: 'fixed' | 'n_minus_1' | 'infinite'; value?: number }
  /** Faktor pengali nilai 'a' sebelum dibagi (meniru konvensi workbook: ×1 atau ×100). */
  factor: number
  /** Basis pembagi untuk komponen resolusi. */
  basis?: 'mean_std' | 'mean_uut'
  source: RuleSource
}

export interface PyranometerMethodRules {
  schemaVersion: 1
  cfRule: 'MEAN_ALL_VALID' | 'EXCLUDE_OUTLIERS'
  outlierThreshold: number
  coverageFactorRule: 'student_t_95' | 'k2'
  components: PyranometerComponentRule[]
}

/**
 * Default kontrak metode pyranometer. Nilainya = perilaku sistem saat ini,
 * dengan provenance yang dapat dilacak (workbook / ISO / spesifikasi).
 */
export const PYRANOMETER_DEFAULT_RULES: PyranometerMethodRules = {
  schemaVersion: 1,
  cfRule: 'MEAN_ALL_VALID',
  outlierThreshold: 2,
  coverageFactorRule: 'student_t_95',
  components: [
    {
      key: 'repeat',
      label: 'Repeatability',
      enabled: true,
      distribution: 'normal',
      divisor: 'sqrt_n',
      vi: { type: 'n_minus_1' },
      factor: 1,
      source: { doc: 'pyranometer.xlsx', ref: 'Data glolbal!F169 / Hit U!G12', classification: 'VARIABEL' },
    },
    {
      key: 'cert_std',
      label: 'Sertifikat Standar',
      enabled: true,
      distribution: 'normal',
      divisor: 2,
      vi: { type: 'fixed', value: 50 },
      factor: 1,
      source: { doc: 'Sertifikat standar', ref: 'Hit U!G13 (U standar, k=2)', classification: 'SPESIFIKASI' },
    },
    {
      key: 'res_std',
      label: 'Resolusi Standar',
      enabled: true,
      distribution: 'rect',
      divisor: 'sqrt3',
      vi: { type: 'fixed', value: 50 },
      factor: 1,
      basis: 'mean_std',
      source: { doc: 'pyranometer.xlsx', ref: 'Input Data!C45 / Hit U!G14', classification: 'SPESIFIKASI' },
    },
    {
      key: 'drift_std',
      label: 'Drift Standar',
      enabled: true,
      distribution: 'rect',
      divisor: 'sqrt3',
      vi: { type: 'fixed', value: 50 },
      factor: 1,
      source: { doc: 'ISO 9060:2018', ref: 'Class A/B/C = 0.8/1.5/3.0%', classification: 'KONSTANTA' },
    },
    {
      key: 'res_uut',
      label: 'Resolusi UUT',
      enabled: true,
      distribution: 'rect',
      divisor: 'sqrt3',
      vi: { type: 'fixed', value: 50 },
      factor: 100,
      basis: 'mean_uut',
      source: { doc: 'pyranometer.xlsx', ref: 'Input Data!C31 / Hit U!G16', classification: 'SPESIFIKASI' },
    },
  ],
}

function clonePyranometerRules(rules: PyranometerMethodRules): PyranometerMethodRules {
  return {
    ...rules,
    components: rules.components.map((c) => ({ ...c, vi: { ...c.vi }, source: { ...c.source } })),
  }
}

/**
 * Normalisasi rules pyranometer dari sumber apa pun (DB JSON, form, dsb).
 * Selalu mengembalikan kontrak lengkap; field yang tak dikenal/absen
 * memakai default sehingga perilaku lama tetap terjaga.
 */
export function normalizePyranometerRules(raw: unknown): PyranometerMethodRules {
  const base = PYRANOMETER_DEFAULT_RULES
  if (!raw || typeof raw !== 'object') return clonePyranometerRules(base)
  const r = raw as Record<string, any>
  const incoming: any[] = Array.isArray(r.components) ? r.components : []

  const components = base.components.map((def) => {
    const inc = incoming.find((c) => c && c.key === def.key)
    if (!inc) return { ...def, vi: { ...def.vi }, source: { ...def.source } }
    const validDist = inc.distribution === 'rect' || inc.distribution === 'normal'
    return {
      ...def,
      enabled: inc.enabled !== undefined ? Boolean(inc.enabled) : def.enabled,
      distribution: validDist ? inc.distribution : def.distribution,
      divisor: inc.divisor ?? def.divisor,
      vi: inc.vi && typeof inc.vi === 'object' && inc.vi.type ? inc.vi : def.vi,
      factor: typeof inc.factor === 'number' ? inc.factor : def.factor,
      basis: inc.basis ?? def.basis,
      source: { ...def.source, ...(inc.source || {}) },
    } as PyranometerComponentRule
  })

  return {
    schemaVersion: 1,
    cfRule: r.cfRule === 'EXCLUDE_OUTLIERS' ? 'EXCLUDE_OUTLIERS' : base.cfRule,
    outlierThreshold: typeof r.outlierThreshold === 'number' ? r.outlierThreshold : base.outlierThreshold,
    coverageFactorRule: r.coverageFactorRule === 'k2' ? 'k2' : base.coverageFactorRule,
    components,
  }
}

/** Ambil rules pyranometer (ternormalisasi) dari sebuah profil metode. */
export function pyranometerRulesFromProfile(profile?: CalibrationMethodProfile | null): PyranometerMethodRules {
  return normalizePyranometerRules(profile?.rules)
}

/** Metadata audit pyranometer yang tersimpan di hasil sertifikat. */
export interface PyranometerAuditSnapshot {
  method_profile_code?: string
  method_profile_version?: number
  rules_snapshot?: unknown
  cf_rule?: string
  coverage_rule?: string
  resolution_rule?: string
  drift_class?: string | null
  drift_value_percent?: number
  /** Sumber nilai drift: `type` (ISO 9060 dari alat standar) | `certificate` | `missing`. */
  drift_source?: 'type' | 'certificate' | 'missing'
  valid_pair_count?: number
  outlier_count?: number
}

/**
 * Telusuri `certificate.results` (bentuk V0/V1/V2 apa pun) untuk menemukan
 * metadata audit pyranometer yang tersimpan (uncertaintyMeta dengan
 * reporting_rule 'PYR_METHOD_PROFILE' atau memuat rules_snapshot).
 */
export function findPyranometerAudit(results: unknown): PyranometerAuditSnapshot | null {
  let found: PyranometerAuditSnapshot | null = null
  const visit = (node: any) => {
    if (found || node == null) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (typeof node !== 'object') return
    const meta = node.uncertaintyMeta
    if (meta && (meta.reporting_rule === 'PYR_METHOD_PROFILE' || meta.rules_snapshot)) {
      found = meta as PyranometerAuditSnapshot
      return
    }
    for (const key of Object.keys(node)) visit(node[key])
  }
  visit(results)
  return found
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
    rules: PYRANOMETER_DEFAULT_RULES as unknown as Record<string, unknown>,
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
