export type CalibratorCertificate = {
  id: number
  status?: string | null
  version?: number | null
  created_at: string
  created_by?: string | null
  sent_by?: string | null
  verifikator_1?: string | null
  verifikator_2?: string | null
  verifikator_3?: string | null
  authorized_by?: string | null
  rejection_history?: any[] | null
  instrument?: number | null
  station?: number | null
}

export type WorkflowVerification = {
  certificate_id: number
  verification_level: number
  status: string
  certificate_version?: number | null
}

export type CalibratorWorkflowStage =
  | 'revision'
  | 'draft'
  | 'ready'
  | 'verification_1'
  | 'verification_2'
  | 'verification_3'
  | 'signature'
  | 'completed'

export function isCalibratorOwnedCertificate(
  certificate: CalibratorCertificate,
  userId: string,
): boolean {
  if (certificate.created_by) return certificate.created_by === userId
  return certificate.sent_by === userId
}

export function hasLatestRejection(certificate: CalibratorCertificate): boolean {
  return Array.isArray(certificate.rejection_history) && certificate.rejection_history.length > 0
}

export function hasCompleteAssignments(certificate: CalibratorCertificate): boolean {
  return Boolean(
    certificate.verifikator_1 &&
      certificate.verifikator_2 &&
      certificate.verifikator_3 &&
      certificate.authorized_by,
  )
}

export function getCalibratorWorkflowStage(
  certificate: CalibratorCertificate,
  verifications: WorkflowVerification[],
  isReadyToSend = hasCompleteAssignments(certificate),
): CalibratorWorkflowStage {
  if (certificate.status === 'completed' || certificate.status === 'verified') {
    return 'completed'
  }

  if (certificate.status === 'draft') {
    if (hasLatestRejection(certificate)) return 'revision'
    return isReadyToSend ? 'ready' : 'draft'
  }

  if (certificate.status === 'sent') {
    const version = certificate.version ?? 1
    const statusAt = (level: number) =>
      verifications.find(
        (item) =>
          item.certificate_id === certificate.id &&
          item.verification_level === level &&
          (item.certificate_version ?? 1) === version,
      )?.status

    if (statusAt(1) !== 'approved') return 'verification_1'
    if (statusAt(2) !== 'approved') return 'verification_2'
    if (statusAt(3) !== 'approved') return 'verification_3'
    return 'signature'
  }

  return 'draft'
}

export function ageInDays(value: string, now = new Date()): number {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000))
}
