import { resultsToLegacyView } from './validators/certificate-results-render-adapter'

export type SigningReadinessResult =
  | { ready: true }
  | { ready: false; code: string; message: string }

export function validateCertificateSigningReadiness(certificate: {
  public_id?: unknown
  results?: unknown
}): SigningReadinessResult {
  if (
    typeof certificate.public_id !== 'string' ||
    certificate.public_id.trim() === ''
  ) {
    return {
      ready: false,
      code: 'PUBLIC_ID_MISSING',
      message:
        'Sertifikat belum memiliki public ID untuk QR verifikasi. Hubungi administrator.',
    }
  }

  const results = resultsToLegacyView(certificate.results)
  if (results.length === 0) {
    return {
      ready: false,
      code: 'CALIBRATION_RESULTS_MISSING',
      message: 'Hasil kalibrasi belum tersedia dan sertifikat belum dapat ditandatangani.',
    }
  }

  const incompleteIndex = results.findIndex((result) => {
    if (!Array.isArray(result.table) || result.table.length === 0) return true
    return result.table.some(
      (section) => !Array.isArray(section.rows) || section.rows.length === 0,
    )
  })

  if (incompleteIndex !== -1) {
    return {
      ready: false,
      code: 'CALIBRATION_TABLE_INCOMPLETE',
      message: `Tabel hasil kalibrasi sensor ${incompleteIndex + 1} belum memiliki data. Lengkapi hasil sebelum menandatangani.`,
    }
  }

  return { ready: true }
}
