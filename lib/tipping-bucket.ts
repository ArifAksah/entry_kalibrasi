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
  repeatabilityDivisor?: number
  diameterDivisor?: number
}

export type TippingBucketFormData = TippingBucketInput

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

function finitePositive(values: number[], label: string): number[] {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  if (valid.length === 0) throw new Error(`${label} minimal memiliki satu nilai positif`)
  return valid
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

  const repeatabilityDivisor =
    input.repeatabilityDivisor && input.repeatabilityDivisor > 0
      ? input.repeatabilityDivisor
      : Math.sqrt(5)
  const diameterDivisor =
    input.diameterDivisor && input.diameterDivisor > 0
      ? input.diameterDivisor
      : Math.sqrt(5)

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
    input.volumeCertificateU95,
    2,
    50,
    volumeSensitivity,
  )
  addComponent(
    'Drift Gelas Ukur',
    'ml',
    'Normal',
    input.volumeStandardDrift / 2,
    Math.sqrt(3),
    50,
    volumeSensitivity,
  )
  addComponent(
    'Sertifikat Jangka Sorong',
    'mm',
    'Normal',
    input.caliperCertificateU95,
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
    input.caliperDrift,
    Math.sqrt(3),
    50,
    0.01,
  )
  addComponent(
    'Resolusi Jangka Sorong',
    'mm',
    'Rect',
    input.caliperResolution / 2,
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
  }
}
