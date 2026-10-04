import {
  calculateStandardDeviation,
  getCoverageFactorFor95,
} from './uncertainty-utils'

export interface TippingBucketSensorIdentity {
  name?: string | null
  type?: string | null
  instrument_code?: string | null
  sheet_name?: string | null
}

/** Peran standar pada budget ketidakpastian RR. */
export type TippingBucketStandardRole = 'volume' | 'length'

/**
 * Satu baris sertifikat standar yang dipakai untuk kalibrasi RR.
 *
 * Peran ditentukan oleh `parameterCode` (kosakata Master CMC):
 *   'VL' (Volume)  -> slot budget Sertifikat/Drift Gelas Ukur
 *   'LN' (Length)  -> slot budget Sertifikat/Drift/Resolusi Jangka Sorong
 *
 * Nilai u95/drift/resolution berasal dari `certificate_standard` milik sensor
 * standar tersebut.
 */
export interface TippingBucketStandardRow {
  role: TippingBucketStandardRole
  parameterCode?: string | null
  certificateId?: number | null
  sensorId?: number | null
  instrumentId?: number | null
  certificateNumber?: string | null
  u95: number
  drift: number
  resolution: number
}

export interface TippingBucketInput {
  funnelDiameterReadings: number[]
  rainUutReadings: number[]
  volumePerTip: number
  resolutionUut: number
  testVolume: number
  volumeCertificateU95: number
  volumeStandardDrift: number
  caliperCertificateU95: number
  caliperDrift: number
  caliperResolution: number
  meniscusUncertainty: number
  cmcMm?: number | null
  /**
   * Daftar sertifikat standar dinamis (sumber utama peran + nilai standar).
   * Jika tersedia, slot budget di-derive dari sini via MAX per peran.
   */
  standards?: TippingBucketStandardRow[]
  /** Snapshot Master CMC yang dipakai saat perhitungan. */
  cmcProfileId?: number | null
  cmcProfileCode?: string | null
  cmcVersion?: number | null
  cmcSourceDocument?: string | null
  repeatabilityDivisor?: number
  diameterDivisor?: number
  /** Metadata metode; optional agar data RR lama tetap dapat dibaca. */
  methodVersion?: typeof TIPPING_BUCKET_METHOD_VERSION
  formulaVersion?: typeof TIPPING_BUCKET_FORMULA_VERSION
  calculationSnapshot?: TippingBucketCalculationSnapshot
}

export type TippingBucketFormData = TippingBucketInput

/** Versi metode RR yang menentukan aturan uncertainty secara eksplisit. */
export const TIPPING_BUCKET_METHOD_VERSION = 'RR-LEGACY-V1' as const
export const TIPPING_BUCKET_FORMULA_VERSION = 1 as const
export const TIPPING_BUCKET_LEGACY_DIVISOR = Math.sqrt(5)

export interface TippingBucketCalculationSnapshot {
  methodVersion: typeof TIPPING_BUCKET_METHOD_VERSION
  formulaVersion: typeof TIPPING_BUCKET_FORMULA_VERSION
  repeatabilityDivisor: number
  diameterDivisor: number
  coverageRule: 'STUDENT_T_95_EFFECTIVE_DOF'
  coverageFactor: number
  effectiveDegreesOfFreedom: number
  combinedUncertaintyMm: number
  rawU95Mm: number
  reportedU95Mm: number
  reportedU95Percent: number
  cmcApplied: boolean
  methodReferences?: Array<{ code: string; edition?: string }>
  calculationRule?: string
  validDiameterCount?: number
  validRainReadingCount?: number
  meniscusValueUsed?: number
  standardsSummary?: Array<{
    role: TippingBucketStandardRole
    certificateId?: number | null
    u95: number
    drift: number
    resolution: number
  }>
}

/**
 * Petakan `parameter_code` Master CMC ke peran budget RR.
 * Sumber tunggal: 'VL' (Volume) / 'LN' (Length). Alias literal diterima
 * secara toleran agar data lama tetap valid. Katalog `instrument_code`
 * memakai 'VN' untuk Volume, jadi 'VN' diperlakukan sama dengan 'VL'.
 */
export function roleFromParameterCode(
  code?: string | null,
): TippingBucketStandardRole | null {
  const normalized = String(code || '').trim().toUpperCase()
  if (normalized === 'VL' || normalized === 'VN' || normalized === 'VOLUME')
    return 'volume'
  if (normalized === 'LN' || normalized === 'LENGTH') return 'length'
  return null
}

/**
 * Gabungkan nilai standar per peran memakai MAX (konservatif, mengikuti
 * aturan MAX(U95, CMC) yang dipakai workbook).
 */
export function aggregateStandardRoles(standards: TippingBucketStandardRow[]) {
  const volume = standards.filter((item) => item.role === 'volume')
  const length = standards.filter((item) => item.role === 'length')
  const max = (values: number[]) =>
    values.length > 0 ? Math.max(...values.filter(Number.isFinite)) : 0

  return {
    volumeCertificateU95: max(volume.map((item) => item.u95)),
    volumeStandardDrift: max(volume.map((item) => item.drift)),
    caliperCertificateU95: max(length.map((item) => item.u95)),
    caliperDrift: max(length.map((item) => item.drift)),
    caliperResolution: max(length.map((item) => item.resolution)),
  }
}

export interface TippingBucketUncertaintyComponent {
  name: string
  unit: string
  distribution: 'Normal' | 'Rect'
  uOrA: number
  divisor: number
  degreesOfFreedom: number
  sensitivityCoefficient: number
  standardUncertainty: number
  contribution: number
  contributionSquared: number
  contributionFourthOverDf: number
}

export interface TippingBucketResult {
  averageFunnelDiameter: number
  funnelAreaMm2: number
  volumeSensitivity: number
  standardRainfall: number
  rows: Array<{
    uut: number
    correctionMm: number
    correctionPercent: number
  }>
  averageUut: number
  averageCorrectionMm: number
  averageCorrectionPercent: number
  correctionStandardDeviation: number
  components: TippingBucketUncertaintyComponent[]
  combinedUncertaintyMm: number
  effectiveDegreesOfFreedom: number
  coverageFactor: number
  rawU95Mm: number
  reportedU95Mm: number
  reportedU95Percent: number
  cmcApplied: boolean
  methodVersion: typeof TIPPING_BUCKET_METHOD_VERSION
  formulaVersion: typeof TIPPING_BUCKET_FORMULA_VERSION
  coverageRule: 'STUDENT_T_95_EFFECTIVE_DOF'
  warnings: string[]
}

export function isTippingBucketSensor(
  sensor?: TippingBucketSensorIdentity | null,
  canonicalName?: string | null,
  calibrationMethod?: string | null,
): boolean {
  const code = String(sensor?.instrument_code || '').trim().toUpperCase()
  const identity = [
    canonicalName,
    sensor?.name,
    sensor?.type,
    sensor?.sheet_name,
    calibrationMethod,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    code === 'RR' ||
    /tipping\s*bucket|penakar\s*hujan|curah\s*hujan|rain\s*(gauge|fall)|\bmk\s*0?6\b/.test(
      identity,
    )
  )
}

/**
 * Deteksi RR (Tipping Bucket / Penakar Hujan) untuk satu sensor UUT.
 *
 * Membungkus `isTippingBucketSensor` dengan bentuk argumen yang dipakai di UI,
 * sehingga kode pemanggil tidak perlu membentuk objek `instrument_code` manual.
 */
export function isRainGaugeSensor(
  sensor: Record<string, any> | null | undefined,
  instrumentCode?: string | null,
  canonicalName?: string | null,
  calibrationMethod?: string | null,
): boolean {
  return isTippingBucketSensor(
    { ...(sensor || {}), instrument_code: instrumentCode },
    canonicalName,
    calibrationMethod,
  )
}

function finitePositive(values: number[], label: string): number[] {
  if (values.length === 0) throw new Error(`${label} minimal memiliki satu nilai`)
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`${label} harus berisi angka positif yang valid`)
  }
  return values
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateTippingBucket(
  input: TippingBucketInput,
): TippingBucketResult {
  const diameters = finitePositive(
    input.funnelDiameterReadings,
    'Pengukuran diameter corong',
  )
  const uutReadings = finitePositive(
    input.rainUutReadings,
    'Pembacaan curah hujan UUT',
  )

  if (!Number.isFinite(input.volumePerTip) || input.volumePerTip <= 0) {
    throw new Error('Volume per tip harus lebih besar dari 0')
  }
  if (!Number.isFinite(input.resolutionUut) || input.resolutionUut <= 0) {
    throw new Error('Resolusi UUT harus lebih besar dari 0')
  }
  if (!Number.isFinite(input.testVolume) || input.testVolume <= 0) {
    throw new Error('Volume uji harus lebih besar dari 0')
  }

  // Slot standar di-derive dari standards[] (MAX per peran) bila tersedia;
  // jika tidak, pakai nilai flat untuk kompatibilitas data lama.
  const aggregated = aggregateStandardRoles(input.standards || [])
  const hasStandards = (input.standards || []).length > 0
  const volumeCertificateU95 = hasStandards
    ? aggregated.volumeCertificateU95
    : input.volumeCertificateU95
  const volumeStandardDrift = hasStandards
    ? aggregated.volumeStandardDrift
    : input.volumeStandardDrift
  const caliperCertificateU95 = hasStandards
    ? aggregated.caliperCertificateU95
    : input.caliperCertificateU95
  const caliperDrift = hasStandards ? aggregated.caliperDrift : input.caliperDrift
  const caliperResolution = hasStandards
    ? aggregated.caliperResolution
    : input.caliperResolution

  const averageFunnelDiameter = mean(diameters)
  const funnelAreaMm2 = (Math.PI * averageFunnelDiameter ** 2) / 4
  // Konversi workbook: luas mm2 menjadi koefisien mm per ml.
  const volumeSensitivity = funnelAreaMm2 * 1e-6
  const standardRainfall =
    (input.resolutionUut * input.testVolume) / input.volumePerTip
  const rows = uutReadings.map((uut) => {
    const correctionMm = standardRainfall - uut
    return {
      uut,
      correctionMm,
      correctionPercent: (100 * correctionMm) / uut,
    }
  })
  const corrections = rows.map((row) => row.correctionMm)
  const averageUut = mean(uutReadings)
  const averageCorrectionMm = mean(corrections)
  // Workbook mengambil rata-rata persentase per pengulangan, bukan persentase
  // dari dua nilai rata-rata.
  const averageCorrectionPercent = mean(
    rows.map((row) => row.correctionPercent),
  )
  const correctionStandardDeviation = calculateStandardDeviation(corrections)
  const components: TippingBucketUncertaintyComponent[] = []
  const addComponent = (
    name: string,
    unit: string,
    distribution: 'Normal' | 'Rect',
    uOrA: number,
    divisor: number,
    degreesOfFreedom: number,
    sensitivityCoefficient = 1,
  ) => {
    const safeValue = Number.isFinite(uOrA) ? Math.abs(uOrA) : 0
    const standardUncertainty = safeValue / divisor
    const contribution = standardUncertainty * sensitivityCoefficient
    components.push({
      name,
      unit,
      distribution,
      uOrA: safeValue,
      divisor,
      degreesOfFreedom,
      sensitivityCoefficient,
      standardUncertainty,
      contribution,
      contributionSquared: contribution ** 2,
      contributionFourthOverDf:
        degreesOfFreedom > 0 ? contribution ** 4 / degreesOfFreedom : 0,
    })
  }

  // RR-LEGACY-V1 harus deterministik dan kompatibel dengan workbook. Data baru
  // selalu membawa methodVersion; data lama tanpa versi tetap memakai pembagi
  // tersimpan agar hasil histori tidak berubah saat ditampilkan ulang.
  const isVersionedLegacy = input.methodVersion === TIPPING_BUCKET_METHOD_VERSION
  const repeatabilityDivisor =
    isVersionedLegacy
      ? TIPPING_BUCKET_LEGACY_DIVISOR
      : input.repeatabilityDivisor && input.repeatabilityDivisor > 0
        ? input.repeatabilityDivisor
        : TIPPING_BUCKET_LEGACY_DIVISOR
  const diameterDivisor =
    isVersionedLegacy
      ? TIPPING_BUCKET_LEGACY_DIVISOR
      : input.diameterDivisor && input.diameterDivisor > 0
        ? input.diameterDivisor
        : TIPPING_BUCKET_LEGACY_DIVISOR

  addComponent(
    'Repeatibilitas',
    'mm',
    'Normal',
    correctionStandardDeviation,
    repeatabilityDivisor,
    Math.max(rows.length - 1, 1),
  )
  addComponent(
    'Sertifikat Gelas Ukur',
    'ml',
    'Normal',
    volumeCertificateU95,
    2,
    50,
    volumeSensitivity,
  )
  addComponent(
    'Drift Gelas Ukur',
    'ml',
    'Normal',
    volumeStandardDrift / 2,
    Math.sqrt(3),
    50,
    volumeSensitivity,
  )
  addComponent(
    'Sertifikat Jangka Sorong',
    'mm',
    'Normal',
    caliperCertificateU95,
    2,
    50,
    0.01,
  )
  addComponent(
    'Pengukuran Jangka Sorong',
    'mm',
    'Normal',
    calculateStandardDeviation(diameters),
    diameterDivisor,
    Math.max(diameters.length - 1, 1),
    0.01,
  )
  addComponent(
    'Drift Jangka Sorong',
    'mm',
    'Rect',
    caliperDrift,
    Math.sqrt(3),
    50,
    0.01,
  )
  addComponent(
    'Resolusi Jangka Sorong',
    'mm',
    'Rect',
    caliperResolution / 2,
    Math.sqrt(3),
    50,
    0.01,
  )
  addComponent(
    'Meniskus',
    'ml',
    'Rect',
    input.meniscusUncertainty,
    Math.sqrt(3),
    50,
    volumeSensitivity,
  )

  const sumSquares = components.reduce(
    (sum, component) => sum + component.contributionSquared,
    0,
  )
  const sumFourthOverDf = components.reduce(
    (sum, component) => sum + component.contributionFourthOverDf,
    0,
  )
  const combinedUncertaintyMm = Math.sqrt(sumSquares)
  const effectiveDegreesOfFreedom =
    sumFourthOverDf > 0
      ? combinedUncertaintyMm ** 4 / sumFourthOverDf
      : Number.POSITIVE_INFINITY
  const coverageFactor = getCoverageFactorFor95(effectiveDegreesOfFreedom)
  const rawU95Mm = combinedUncertaintyMm * coverageFactor
  const cmcMm =
    input.cmcMm != null && Number.isFinite(input.cmcMm)
      ? Math.max(0, input.cmcMm)
      : 0
  const reportedU95Mm = Math.max(rawU95Mm, cmcMm)
  const warnings: string[] = []
  if (rows.length < 2) {
    warnings.push('Repeatibilitas tidak dapat dievaluasi karena pembacaan hujan kurang dari 2 data.')
  } else if (correctionStandardDeviation === 0) {
    warnings.push('Repeatibilitas bernilai 0 karena seluruh pembacaan hujan menghasilkan nilai yang sama.')
  }
  if (volumeStandardDrift === 0) {
    warnings.push('Drift gelas ukur bernilai 0 dari data standar yang tersimpan.')
  }
  if (cmcMm > rawU95Mm) {
    warnings.push(
      `U95 dilaporkan menggunakan CMC ${cmcMm.toFixed(6)} mm karena lebih besar dari U95 hasil hitung ${rawU95Mm.toFixed(6)} mm.`,
    )
  }
  if (rows.length !== 3) {
    warnings.push(
      `Metode ${TIPPING_BUCKET_METHOD_VERSION} memakai referensi workbook 3 pembacaan UUT; data saat ini berjumlah ${rows.length}.`,
    )
  }
  if (diameters.length !== 4) {
    warnings.push(
      `Metode ${TIPPING_BUCKET_METHOD_VERSION} memakai referensi workbook 4 pengukuran diameter; data saat ini berjumlah ${diameters.length}.`,
    )
  }
  if (
    isVersionedLegacy &&
    input.repeatabilityDivisor != null &&
    Math.abs(input.repeatabilityDivisor - repeatabilityDivisor) > 1e-12
  ) {
    warnings.push('Pembagi repeatability lama diabaikan; RR memakai pembagi workbook sqrt(5).')
  }
  if (
    isVersionedLegacy &&
    input.diameterDivisor != null &&
    Math.abs(input.diameterDivisor - diameterDivisor) > 1e-12
  ) {
    warnings.push('Pembagi diameter lama diabaikan; RR memakai pembagi workbook sqrt(5).')
  }

  return {
    averageFunnelDiameter,
    funnelAreaMm2,
    volumeSensitivity,
    standardRainfall,
    rows,
    averageUut,
    averageCorrectionMm,
    averageCorrectionPercent,
    correctionStandardDeviation,
    components,
    combinedUncertaintyMm,
    effectiveDegreesOfFreedom,
    coverageFactor,
    rawU95Mm,
    reportedU95Mm,
    reportedU95Percent: (100 * reportedU95Mm) / averageUut,
    cmcApplied: cmcMm > rawU95Mm,
    methodVersion: TIPPING_BUCKET_METHOD_VERSION,
    formulaVersion: TIPPING_BUCKET_FORMULA_VERSION,
    coverageRule: 'STUDENT_T_95_EFFECTIVE_DOF',
    warnings,
  }
}
