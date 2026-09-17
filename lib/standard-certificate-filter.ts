import type { CertStandard, Instrument } from './supabase'

const numericId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function getInstrumentSensorIds(
  instruments: Instrument[],
  instrumentId: unknown,
): Set<number> {
  const normalizedInstrumentId = numericId(instrumentId)
  if (normalizedInstrumentId === null) return new Set()

  const instrument = instruments.find(
    (item) => numericId(item.id) === normalizedInstrumentId,
  )

  return new Set(
    (instrument?.sensor ?? [])
      .map((sensor) => numericId(sensor.id))
      .filter((id): id is number => id !== null),
  )
}

export function filterStandardCertificates(
  certificates: CertStandard[],
  instruments: Instrument[],
  instrumentId: unknown,
  certificateNumber?: string | null,
): CertStandard[] {
  const sensorIds = getInstrumentSensorIds(instruments, instrumentId)
  const normalizedCertificateNumber = certificateNumber?.trim()

  return certificates.filter((certificate) => {
    const sensorId = numericId(certificate.sensor_id)
    if (sensorId === null || !sensorIds.has(sensorId)) return false

    return normalizedCertificateNumber
      ? certificate.no_certificate.trim() === normalizedCertificateNumber
      : true
  })
}

export function isStandardCertificateSelectionValid(
  certificates: CertStandard[],
  instruments: Instrument[],
  instrumentId: unknown,
  certificateNumber: string | null | undefined,
  certificateId: unknown,
): boolean {
  const normalizedCertificateId = numericId(certificateId)
  if (normalizedCertificateId === null || !certificateNumber?.trim()) return false

  return filterStandardCertificates(
    certificates,
    instruments,
    instrumentId,
    certificateNumber,
  ).some((certificate) => numericId(certificate.id) === normalizedCertificateId)
}

type StandardSelectionPayload = {
  name?: string | null
  sensor_id_std?: unknown
  standard_certificate_id?: unknown
}

type StandardCertificateLink = {
  id: unknown
  sensor_id: unknown
}

export function findInvalidStandardSelection(
  sheets: StandardSelectionPayload[],
  certificateLinks: StandardCertificateLink[],
): StandardSelectionPayload | undefined {
  const sensorByCertificate = new Map(
    certificateLinks
      .map((link) => [numericId(link.id), numericId(link.sensor_id)] as const)
      .filter(
        (link): link is readonly [number, number] =>
          link[0] !== null && link[1] !== null,
      ),
  )

  return sheets.find((sheet) => {
    const certificateId = numericId(sheet.standard_certificate_id)
    if (certificateId === null) return false

    const sensorId = numericId(sheet.sensor_id_std)
    return sensorId === null || sensorByCertificate.get(certificateId) !== sensorId
  })
}
