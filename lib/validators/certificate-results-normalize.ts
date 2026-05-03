/**
 * ============================================================================
 * CERTIFICATE RESULTS — WRITE-SIDE NORMALIZER
 * ============================================================================
 *
 * Dipakai di API route POST/PUT untuk menormalisasi `results` dari body
 * request menjadi bentuk V1 yang valid sebelum disimpan ke DB.
 *
 * Mode validasi dikontrol oleh env var RESULTS_VALIDATION_STRICT:
 *
 *   unset / 'false' (default, TOLERANT):
 *     - V1 valid       → simpan
 *     - V0 legacy      → auto-convert ke V1, log peringatan
 *     - truly broken   → reject 400
 *     Cocok selama fase migrasi ketika client lama masih kirim V0.
 *
 *   'true' (STRICT):
 *     - V1 valid       → simpan
 *     - V0 legacy      → reject 400 (paksa client update ke V1)
 *     - truly broken   → reject 400
 *     Flip ke mode ini setelah log menunjukkan tidak ada lagi V0 masuk.
 *
 * KODE-KODE ERROR (untuk monitoring):
 *   - ResultsValidationError dengan status 400: payload rusak.
 *   - Tidak throw untuk `results === null/undefined` (request tidak
 *     menyebutkan results sama sekali).
 * ============================================================================
 */

import {
  CertificateResultsV1,
  CertificateResultsV1Schema,
  isResultsV1Shape,
} from './certificate-results'
import {
  CalibrationKind,
  tryConvertResultsLegacyToV1,
} from './certificate-results-legacy'

// ---------------------------------------------------------------------------
// Mode & error class
// ---------------------------------------------------------------------------

/** Baca sekali saja saat modul di-load agar konsisten per cold-start. */
const STRICT_MODE =
  (process.env.RESULTS_VALIDATION_STRICT || '').toLowerCase() === 'true'

export class ResultsValidationError extends Error {
  readonly status = 400
  readonly code = 'RESULTS_VALIDATION'
  readonly details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ResultsValidationError'
    this.details = details
  }
}

// ---------------------------------------------------------------------------
// Unwrap — string JSONB → object (duplikasi kecil dari legacy-adapter
// supaya file ini self-contained)
// ---------------------------------------------------------------------------

function unwrap(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      throw new ResultsValidationError('results: string bukan JSON valid')
    }
  }
  return raw
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NormalizeContext {
  /** Kind kalibrasi yang sudah divalidasi di API route. */
  calibration_kind: CalibrationKind
  /**
   * ID sertifikat (untuk logging). Boleh 'NEW' kalau masih POST.
   */
  certificate_id?: number | string
}

export type NormalizeResult =
  /** Client tidak mengirim results → kolom tidak berubah. */
  | { kind: 'not_provided' }
  /** Normalisasi sukses, simpan `value` ke DB. */
  | { kind: 'ok'; value: CertificateResultsV1; wasLegacy: boolean }

/**
 * Normalisasi results dari request body. Throw `ResultsValidationError`
 * jika payload tidak bisa diterima di mode aktif.
 */
export function normalizeResultsOnWrite(
  raw: unknown,
  ctx: NormalizeContext
): NormalizeResult {
  if (raw == null) return { kind: 'not_provided' }

  const unwrapped = unwrap(raw)
  if (unwrapped == null) return { kind: 'not_provided' }

  const certLabel = ctx.certificate_id ?? 'NEW'

  // --- STRICT --------------------------------------------------------------
  if (STRICT_MODE) {
    if (!isResultsV1Shape(unwrapped)) {
      throw new ResultsValidationError(
        'results harus V1 (schema_version: 1). V0 legacy tidak diterima di strict mode.'
      )
    }
    const parsed = CertificateResultsV1Schema.safeParse(unwrapped)
    if (!parsed.success) {
      throw new ResultsValidationError(
        'results tidak sesuai Certificate Results V1 schema',
        parsed.error.issues
      )
    }
    return { kind: 'ok', value: parsed.data, wasLegacy: false }
  }

  // --- TOLERANT ------------------------------------------------------------
  const outcome = tryConvertResultsLegacyToV1(unwrapped, {
    calibration_kind: ctx.calibration_kind,
  })
  if (!outcome.ok) {
    throw new ResultsValidationError(
      `results payload tidak valid: ${outcome.error}`
    )
  }

  if (outcome.wasLegacy) {
    // Penanda visibilitas migrasi. Monitor log ini — ketika angkanya turun
    // ke 0 untuk periode cukup panjang, flip RESULTS_VALIDATION_STRICT=true.
    console.warn(
      `[results-normalize] certificate=${certLabel} received legacy V0 payload, converted to V1`
    )
  }
  return { kind: 'ok', value: outcome.data, wasLegacy: outcome.wasLegacy }
}

/** Getter untuk mode aktif — berguna untuk tes & health endpoint. */
export function getResultsValidationMode(): 'strict' | 'tolerant' {
  return STRICT_MODE ? 'strict' : 'tolerant'
}
