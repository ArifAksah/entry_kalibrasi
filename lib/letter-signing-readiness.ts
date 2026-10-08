export type LetterSigningReadinessResult =
  | { ready: true }
  | { ready: false; code: string; message: string }

export function validateLetterSigningReadiness(letter: {
  public_id?: unknown
  id?: number | string
}, resultCount: number): LetterSigningReadinessResult {
  if (typeof letter.public_id !== 'string' || letter.public_id.trim() === '') {
    return {
      ready: false,
      code: 'PUBLIC_ID_MISSING',
      message:
        'Surat Keterangan belum memiliki public ID untuk QR verifikasi. Hubungi administrator.',
    }
  }

  if (!resultCount || resultCount < 1) {
    return {
      ready: false,
      code: 'INSPECTION_RESULTS_MISSING',
      message: 'Hasil pemeriksaan belum tersedia dan Surat Keterangan belum dapat ditandatangani.',
    }
  }

  return { ready: true }
}
