import { canConvertUnit, convertDeltaUnit } from './unitConversion'

export interface CmcLookupInput {
  uutSensor?: any
  calibrationMethod?: string | null
  sheetName?: string | null
  unitStd?: string | null
  unitUut?: string | null
  measurementPoint?: number | null
}

export interface CmcResult {
  profileId?: number
  profileCode?: string
  profileName?: string
  version?: number
  sourceDocument?: string | null
  cmcNative: number
  nativeUnit: string
  cmcOutput: number
}

export interface FinalCertificateUncertainty {
  rawU95: number
  cmc: CmcResult | null
  finalU95: number
}

/**
 * Menentukan batas CMC (capability) mengikuti master CMC workbook BMKG.
 * Aturan workbook: nilai yang masuk sertifikat = MAX(U95, CMC).
 *
 * Untuk beberapa varian MK 01 suhu, default dipakai nilai "Termometer Udara"
 * (0.3 °C) sesuai contoh standar TT/HMP155D yang dipakai.
 */
export function resolveCmc(input: CmcLookupInput): CmcResult | null {
  const unitStd = (input.unitStd || '').trim().toLowerCase()
  const unitUut = (input.unitUut || '').trim().toLowerCase()
  if (!unitStd && !unitUut) return null

  const text = [
    input.uutSensor?.name,
    input.uutSensor?.type,
    input.sheetName,
    input.calibrationMethod,
  ].filter(Boolean).join(' ').toLowerCase()

  let nativeUnit = ''
  let cmcNative = 0

  if (/arah angin|wind direction|wind vane|mk\s*0?5/.test(text)) {
    nativeUnit = '°'
    cmcNative = 1
  } else if (/kecepatan angin|wind speed|mk\s*0?4/.test(text)) {
    nativeUnit = 'm/s'
    cmcNative = 0.48
  } else if (/tekanan|pressure|barometer|mk\s*0?2/.test(text)) {
    nativeUnit = 'hPa'
    cmcNative = 0.026
  } else if (/curah hujan|penakar hujan|rain|tipping bucket|mk\s*0?6/.test(text)) {
    nativeUnit = 'mm'
    cmcNative = /analog|konvensional/.test(text) ? 0.29 : 0.19
  } else if (/suhu|temperature|termometer|temp|mk\s*0?1/.test(text)) {
    // Diletakkan sebelum kelembapan agar "Termometer HygroClip2" terdeteksi
    // sebagai Suhu, bukan Hygrometer.
    nativeUnit = '°C'
    cmcNative = 0.3
  } else if (/kelembapan|kelembaban|humidity|hygro|rh|mk\s*0?3/.test(text)) {
    nativeUnit = '%'
    cmcNative = 1.1
  } else {
    return null
  }

  // CMC dinyatakan dalam satuan UUT bila berbeda (contoh: hPa → inHg, m/s → knot)
  const targetUnit = unitUut || unitStd
  const cmcOutput =
    targetUnit && nativeUnit && targetUnit !== nativeUnit && canConvertUnit(nativeUnit, targetUnit)
      ? convertDeltaUnit(cmcNative, nativeUnit, targetUnit)
      : cmcNative

  return { cmcNative, nativeUnit, cmcOutput }
}

/** Workbook workflow: certificate uncertainty is the greater of U95 and CMC. */
export function finalizeCertificateUncertainty(
  rawU95: number,
  input: CmcLookupInput
): FinalCertificateUncertainty {
  const cmc = resolveCmc(input)
  const finalU95 = cmc && Number.isFinite(cmc.cmcOutput)
    ? Math.max(rawU95, cmc.cmcOutput)
    : rawU95
  return { rawU95, cmc, finalU95 }
}

export async function fetchCmc(input: CmcLookupInput): Promise<CmcResult | null> {
  try {
    const params = new URLSearchParams()
    params.set('resolve', 'true')
    if (input.uutSensor?.name) params.set('sensorName', String(input.uutSensor.name))
    if (input.uutSensor?.type) params.set('sensorType', String(input.uutSensor.type))
    if (input.sheetName) params.set('sheetName', input.sheetName)
    if (input.calibrationMethod) params.set('calibrationMethod', input.calibrationMethod)
    if (input.unitStd) params.set('unitStd', input.unitStd)
    if (input.unitUut) params.set('unitUut', input.unitUut)
    if (input.measurementPoint != null && Number.isFinite(input.measurementPoint)) {
      params.set('measurementPoint', String(input.measurementPoint))
    }

    const response = await fetch(`/api/cmc?${params.toString()}`)
    if (response.ok) {
      const payload = await response.json()
      if (payload?.data) return payload.data as CmcResult
    }
  } catch {
    // Use workbook fallback below when the master table is not migrated yet.
  }
  return resolveCmc(input)
}

export async function finalizeCertificateUncertaintyWithMaster(
  rawU95: number,
  input: CmcLookupInput
): Promise<FinalCertificateUncertainty> {
  const cmc = await fetchCmc(input)
  const finalU95 = cmc && Number.isFinite(cmc.cmcOutput)
    ? Math.max(rawU95, cmc.cmcOutput)
    : rawU95
  return { rawU95, cmc, finalU95 }
}
