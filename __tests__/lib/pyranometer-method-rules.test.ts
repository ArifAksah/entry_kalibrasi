import {
  PYRANOMETER_DEFAULT_RULES,
  normalizePyranometerRules,
  findPyranometerAudit,
  LEGACY_METHOD_PROFILES,
} from '../../lib/calibration-method-profiles'
import {
  calculateCalibrationFactor,
  calculatePyranometerUncertainty,
} from '../../lib/uncertainty-utils'

function baseParams() {
  const cf = calculateCalibrationFactor([100, 101, 99], [100, 100, 100])
  return {
    cf_result: cf,
    certU95_percent: 2.1,
    resolutionStd: 0.01,
    resolutionUut: 0.1,
    range: 2000,
    sensorType: 'MS-802',
    stdSensorType: 'CMP3',
    stdMean: 100,
    uutMean: 100,
  }
}

describe('pyranometer method rules (kontrak metode)', () => {
  it('default lengkap & tiap komponen punya provenance', () => {
    const rules = normalizePyranometerRules(undefined)
    expect(rules.components).toHaveLength(5)
    expect(rules.components.map((c) => c.key)).toEqual([
      'repeat',
      'cert_std',
      'res_std',
      'drift_std',
      'res_uut',
    ])
    for (const c of rules.components) {
      expect(c.source.doc).toBeTruthy()
      expect(['KONSTANTA', 'SPESIFIKASI', 'VARIABEL']).toContain(c.source.classification)
    }
  })

  it('fallback ke default untuk input aneh, tapi menghormati override yang dikenal', () => {
    const rules = normalizePyranometerRules({
      coverageFactorRule: 'k2',
      components: [{ key: 'drift_std', vi: { type: 'fixed', value: 12 }, divisor: 2 }],
    })
    expect(rules.coverageFactorRule).toBe('k2')
    const drift = rules.components.find((c) => c.key === 'drift_std')!
    expect(drift.vi).toEqual({ type: 'fixed', value: 12 })
    expect(drift.divisor).toBe(2)
    // komponen lain tetap default
    expect(rules.components.find((c) => c.key === 'repeat')!.divisor).toBe('sqrt_n')
  })

  it('tidak memutasi objek default yang dibagikan', () => {
    const rules = normalizePyranometerRules(undefined)
    rules.components[0].enabled = false
    expect(PYRANOMETER_DEFAULT_RULES.components[0].enabled).toBe(true)
  })

  it('tanpa rules == memakai default (perilaku lama terjaga)', () => {
    const withDefault = calculatePyranometerUncertainty(baseParams())
    const withExplicit = calculatePyranometerUncertainty({
      ...baseParams(),
      rules: PYRANOMETER_DEFAULT_RULES,
    })
    expect(withDefault.u95_percent).toBeCloseTo(withExplicit.u95_percent, 12)
    expect(withDefault.rules_used?.components).toHaveLength(5)
  })

  it('coverageFactorRule=k2 memaksa k=2 dan mengubah U95', () => {
    const k2 = calculatePyranometerUncertainty({
      ...baseParams(),
      rules: { coverageFactorRule: 'k2' },
    })
    expect(k2.k_factor).toBe(2)
    expect(k2.u95_percent).toBeCloseTo(2 * k2.uc_percent, 12)
  })

  it('mengubah vi komponen Type-B mengubah veff/k tetapi uc tetap', () => {
    const base = calculatePyranometerUncertainty(baseParams())
    const modified = calculatePyranometerUncertainty({
      ...baseParams(),
      rules: {
        components: [
          { key: 'cert_std', vi: { type: 'fixed', value: 5 } },
          { key: 'res_std', vi: { type: 'fixed', value: 5 } },
          { key: 'drift_std', vi: { type: 'fixed', value: 5 } },
          { key: 'res_uut', vi: { type: 'fixed', value: 5 } },
        ],
      },
    })
    expect(modified.uc_percent).toBeCloseTo(base.uc_percent, 12)
    expect(modified.u95_percent).toBeGreaterThan(base.u95_percent)
  })

  it('menonaktifkan komponen mengeluarkannya dari budget', () => {
    const onlyDrift = calculatePyranometerUncertainty({
      ...baseParams(),
      rules: {
        components: [
          { key: 'repeat', enabled: false },
          { key: 'cert_std', enabled: false },
          { key: 'res_std', enabled: false },
          { key: 'res_uut', enabled: false },
        ],
      },
    })
    expect(onlyDrift.components).toHaveLength(1)
    expect(onlyDrift.components[0].name).toBe('Drift Standar')
  })

  it('isolasi: RR & raw_general tidak tersentuh', () => {
    expect(LEGACY_METHOD_PROFILES.tipping_bucket.rules).toEqual({
      calculationRule: 'RR_LEGACY_WORKBOOK',
    })
    expect(LEGACY_METHOD_PROFILES.raw_general.rules.calculationRule).toBe(
      'STD_CORRECTED_IN_UUT_UNIT_MINUS_UUT',
    )
  })

  it('findPyranometerAudit menemukan snapshot rules di results bersarang', () => {
    const results = {
      schema_version: 2,
      sensors: [
        {
          display: {
            tables: [
              {
                rows: [
                  {
                    uncertaintyMeta: {
                      reporting_rule: 'PYR_METHOD_PROFILE',
                      method_profile_code: 'PYR-LEGACY-BMKG',
                      rules_snapshot: { coverageFactorRule: 'k2' },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    }
    const audit = findPyranometerAudit(results)
    expect(audit?.method_profile_code).toBe('PYR-LEGACY-BMKG')
    expect((audit?.rules_snapshot as any).coverageFactorRule).toBe('k2')
    expect(findPyranometerAudit({})).toBeNull()
    expect(findPyranometerAudit(null)).toBeNull()
  })

  it('snapshot rules dari sertifikat dipakai untuk perhitungan (k2 -> k=2)', () => {
    const snapshot = { coverageFactorRule: 'k2' }
    const res = calculatePyranometerUncertainty({ ...baseParams(), rules: snapshot })
    expect(res.k_factor).toBe(2)
    expect(res.u95_percent).toBeCloseTo(2 * res.uc_percent, 12)
  })
})
