/**
 * ============================================================================
 * CERTIFICATE RESULTS — SCHEMA V1 (IKK BMKG)
 * ============================================================================
 *
 * Single Source of Truth untuk kontrak data `certificate.results` (JSONB).
 *
 * Dirancang agar transisi bertahap berikut tetap mulus tanpa rewrite:
 *   Opsi A (sekarang)  → Zod validator + JSONB V1 namespaced
 *   Opsi B (berikutnya)→ Tambah results_schema_version & results_frozen_at
 *   Opsi C (masa dpn.) → Normalisasi tiap namespace → tabel relational
 *
 * PRINSIP DESIGN
 * --------------
 * 1. Namespace eksplisit (`links`, `snapshot`, `setup`, `display`).
 *    Setiap namespace 1:1 dengan calon tabel di Opsi C. Tidak boleh ada
 *    field lepas di level sensor.
 *
 * 2. Separation of reference vs snapshot:
 *    - `links.*`    → pointer ke tabel lain (sensor_id, session_id, dst).
 *                     Saat C: dipromote jadi kolom FK riil.
 *    - `snapshot.*` → freeze state saat sertifikat dibekukan.
 *                     Saat C: tetap disimpan di tabel *_snapshot (immutable).
 *
 * 3. Discriminator `calibration_kind: 'FC' | 'LC'` di level dokumen
 *    supaya renderer & integrator tidak perlu parsing `no_certificate`.
 *
 * 4. `schema_version: 1` wajib di setiap dokumen. Renderer memilih strategi
 *    berdasarkan field ini. Ketika V2 lahir nanti, dual-read tetap bekerja.
 *
 * 5. Semua field opsional defaultnya `undefined`, BUKAN empty string / 0.
 *    "Belum diisi" ≠ "sengaja nol".
 *
 * 6. `z.infer<typeof ...>` adalah satu-satunya sumber TypeScript types.
 *    Tidak ada interface manual di file ini supaya tidak drift.
 *
 * ============================================================================
 */

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

// ---------------------------------------------------------------------------
// 0. Konstanta & helpers
// ---------------------------------------------------------------------------

/** Versi schema dokumen results. Naikkan saat shape breaking. */
export const RESULTS_SCHEMA_VERSION = 1 as const

/** Regex ISO-8601 longgar (tanggal atau datetime). Kosong diperbolehkan. */
const isoDateOrEmpty = z
  .string()
  .refine(
    (s) => s === '' || !Number.isNaN(Date.parse(s)),
    { message: 'Tanggal harus ISO-8601 atau string kosong' }
  )

/** Number yang boleh dikirim sebagai string numerik (legacy). */
const numberOrNumericString = z.union([
  z.number(),
  z.string().regex(/^-?\d+(\.\d+)?$/, 'Bukan string numerik valid'),
])

// ---------------------------------------------------------------------------
// 1. Primitives (reusable building blocks)
// ---------------------------------------------------------------------------

/** Satu baris tabel hasil kalibrasi / kondisi lingkungan. */
export const ResultTableRowSchema = z.object({
  key: z.string(),
  value: z.string(),
  unit: z.string().default(''),
  /** Nilai tambahan untuk tabel multi-kolom (mis. pengulangan). */
  extraValues: z.array(z.string()).optional(),
  uncertaintyMeta: z.object({
    raw_u95: z.number(),
    reported_u95: z.number(),
    reporting_rule: z.string(),
    cmc_profile_id: z.number().nullable().optional(),
    cmc_profile_code: z.string().nullable().optional(),
    cmc_version: z.number().nullable().optional(),
    cmc_value_native: z.number().nullable().optional(),
    cmc_unit_native: z.string().nullable().optional(),
    cmc_value_output: z.number().nullable().optional(),
    method_profile_code: z.string().optional(),
    method_profile_version: z.number().optional(),
    standard_references: z.array(z.object({
      code: z.string(),
      edition: z.string().optional(),
    })).optional(),
    cf_rule: z.string().optional(),
    outlier_rule: z.string().optional(),
    valid_pair_count: z.number().optional(),
    outlier_count: z.number().optional(),
    outlier_indices: z.array(z.number()).optional(),
    drift_class: z.enum(['A', 'B', 'C']).nullable().optional(),
    drift_value_percent: z.number().optional(),
    coverage_rule: z.string().optional(),
    resolution_rule: z.string().optional(),
    calibration_method: z.string().nullable().optional(),
    reference_document: z.string().nullable().optional(),
    raw_row_count: z.number().optional(),
    ignored_row_count: z.number().optional(),
    unit_std: z.string().nullable().optional(),
    unit_uut: z.string().nullable().optional(),
    is_analog: z.boolean().optional(),
    is_wind_direction: z.boolean().optional(),
    calculation_rule: z.string().optional(),
    uncertainty_rule: z.string().optional(),
    /** Sensitivitas alat yang dipakai saat kalibrasi (Slama), µV/Wm-2. */
    sensitivity_old: z.number().nullable().optional(),
    /** Faktor kalibrasi final (CF) hasil hitung saat itu. */
    cf_final: z.number().nullable().optional(),
    /** Sensitivitas baru (Sbaru = Slama × CF final) — pyranometer analog. */
    sensitivity_new: z.number().nullable().optional(),
    sensitivity_unit: z.string().optional(),
    /** True bila Sbaru sudah diterapkan ke master sensor. */
    sensitivity_applied_to_master: z.boolean().optional(),
  }).optional(),
})

/** Satu tabel (punya judul + list baris). */
export const ResultTableSchema = z.object({
  title: z.string(),
  headers: z.array(z.string()).optional(),
  rows: z.array(ResultTableRowSchema),
})

/** Lampiran gambar di halaman sensor. */
export const ResultImageSchema = z.object({
  url: z.string().url().or(z.literal('')),
  caption: z.string().default(''),
})

/** Kondisi lingkungan (suhu, RH, tekanan, dll.). */
export const EnvironmentConditionSchema = z.object({
  key: z.string(),
  value: z.string(),
  unit: z.string().default(''),
  /** Tipe parameter: suhu | kelembaban | tekanan | suhu_air. */
  type: z.string().default(''),
  /** Pembacaan Awal yang diisi operator (cara workbook). */
  awal: z.string().default(''),
  /** Pembacaan Akhir yang diisi operator (cara workbook). */
  akhir: z.string().default(''),
  /** U95 kondisi ruang (khusus sertifikat Tipping Bucket — input tersendiri). */
  u95: z.string().default(''),
  /** Toggle apakah baris ditampilkan di sertifikat. */
  enabled: z.boolean().optional(),
})

/** Instrumen standar yang dipakai untuk traceability. */
export const StandardInstrumentRefSchema = z.object({
  /** Link ke master — Opsi C akan jadi FK ke instruments.id */
  instrument_id: z.number().int().nullable().optional(),
  sensor_id: z.number().int().nullable().optional(),
  certificate_id: z.number().int().nullable().optional(),
  name: z.string(),
  serial_number: z.string().default(''),
  certificate_no: z.string().default(''),
  traceable_to: z.string().default(''),
})

// ---------------------------------------------------------------------------
// 2. Namespace: LINKS (reference — live pointers)
// ---------------------------------------------------------------------------

/**
 * Pointer ke data yang hidup di tabel lain.
 * Di Opsi C akan dipromote jadi kolom FK pada tabel certificate_sensor_result.
 */
export const SensorLinksSchema = z.object({
  /** FK ke tabel instruments / sensor. Wajib ada. */
  sensor_id: z.number().int().positive(),
  /** UUID session raw-data kalibrasi (null = belum ada session). */
  session_id: z.string().uuid().nullable().optional(),
  /** FK ke tabel stations (kalau pengukuran terjadi di station). */
  station_id: z.number().int().positive().nullable().optional(),
})

// ---------------------------------------------------------------------------
// 3. Namespace: SNAPSHOT (immutable freeze)
// ---------------------------------------------------------------------------

/**
 * Freeze state sensor pada saat sertifikat di-issue. Tidak berubah meskipun
 * master data di tabel `instruments` di-update kemudian.
 *
 * Di Opsi C → tabel `certificate_sensor_snapshot` dengan PK
 * (certificate_id, sensor_id, version).
 */
export const SensorSnapshotSchema = z.object({
  /** Nama sensor saat sertifikat dibekukan. */
  name: z.string(),
  manufacturer: z.string().default(''),
  type: z.string().default(''),
  serial_number: z.string().default(''),

  range_capacity: z.string().default(''),
  range_capacity_unit: z.string().default(''),

  graduating: z.string().default(''),
  graduating_unit: z.string().default(''),

  resolution: z.number().nullable().optional(),

  /** Field khusus sensor curah hujan (code_alat = 'TT'). */
  funnel_diameter: numberOrNumericString.nullable().optional(),
  funnel_diameter_unit: z.string().default(''),
  volume_per_tip: numberOrNumericString.nullable().optional(),
  volume_per_tip_unit: z.string().default(''),
  funnel_area: numberOrNumericString.nullable().optional(),
  funnel_area_unit: z.string().default(''),
})

// ---------------------------------------------------------------------------
// 4. Namespace: SETUP (kondisi & konfigurasi kalibrasi)
// ---------------------------------------------------------------------------

/**
 * Konfigurasi kalibrasi — metode, referensi, kondisi lingkungan, standar.
 * Di Opsi C → tabel `certificate_calibration_setup` + join table untuk
 * environment & standard_instruments.
 */
export const CalibrationSetupSchema = z.object({
  /** Metode kalibrasi (mis. "IKK BMKG 2024 rev.3"). */
  calibration_method: z.string().default(''),
  /** Dokumen referensi metode. */
  reference_document: z.string().default(''),
  /** Keterangan traceability SI. */
  traceable_to_si_through: z.string().default(''),
  /** Catatan bebas yang tampil di field "Lain-lain / Others". */
  others: z.string().default(''),
  /**
   * Toggle apakah field `others` ditampilkan di render. Di V0 ini disimpan
   * sebagai `notesForm.others_enabled`. Default `undefined` supaya renderer
   * bisa fallback ke `Boolean(others)` (pola `isOthersEnabled`).
   */
  others_enabled: z.boolean().optional(),

  /** Rentang waktu pengukuran. */
  start_date: isoDateOrEmpty.default(''),
  end_date: isoDateOrEmpty.default(''),

  /** Kondisi lingkungan selama kalibrasi. */
  environment: z.array(EnvironmentConditionSchema).default([]),

  /** Standar yang dipakai. */
  standard_instruments: z.array(StandardInstrumentRefSchema).default([]),

  /** Unit eksplisit untuk kolom raw data agar tidak hilang saat edit/reload. */
  measurement_units: z.object({
    uut: z.string().default(''),
    std: z.string().default(''),
  }).optional(),
  /** Input form RR/Tipping Bucket. Disimpan agar dapat diedit tanpa raw-data. */
  tipping_bucket: z.object({
    funnelDiameterReadings: z.array(z.number()),
    rainUutReadings: z.array(z.number()),
    volumePerTip: z.number(),
    resolutionUut: z.number(),
    testVolume: z.number(),
    volumeCertificateU95: z.number(),
    volumeStandardDrift: z.number(),
    caliperCertificateU95: z.number(),
    caliperDrift: z.number(),
    caliperResolution: z.number(),
    meniscusUncertainty: z.number(),
    cmcMm: z.number().nullable().optional(),
    /** Daftar sertifikat standar dinamis (peran dari parameter_code VL/LN). */
    standards: z
      .array(
        z.object({
          role: z.enum(['volume', 'length']),
          parameterCode: z.string().nullable().optional(),
          certificateId: z.number().int().nullable().optional(),
          sensorId: z.number().int().nullable().optional(),
          instrumentId: z.number().int().nullable().optional(),
          certificateNumber: z.string().nullable().optional(),
          u95: z.number(),
          drift: z.number(),
          resolution: z.number(),
        }),
      )
      .optional(),
    cmcProfileId: z.number().int().nullable().optional(),
    cmcProfileCode: z.string().nullable().optional(),
    cmcVersion: z.number().int().nullable().optional(),
    cmcSourceDocument: z.string().nullable().optional(),
    repeatabilityDivisor: z.number().optional(),
    diameterDivisor: z.number().optional(),
    methodVersion: z.literal('RR-LEGACY-V1').optional(),
    formulaVersion: z.literal(1).optional(),
    calculationSnapshot: z
      .object({
        methodVersion: z.literal('RR-LEGACY-V1'),
        formulaVersion: z.literal(1),
        repeatabilityDivisor: z.number(),
        diameterDivisor: z.number(),
        coverageRule: z.literal('STUDENT_T_95_EFFECTIVE_DOF'),
        coverageFactor: z.number(),
        effectiveDegreesOfFreedom: z.number(),
        combinedUncertaintyMm: z.number(),
        rawU95Mm: z.number(),
        reportedU95Mm: z.number(),
        reportedU95Percent: z.number(),
        cmcApplied: z.boolean(),
      })
      .optional(),
  }).optional(),
})

// ---------------------------------------------------------------------------
// 5. Namespace: DISPLAY (presentation payload untuk PDF/LHKS)
// ---------------------------------------------------------------------------

/**
 * Data yang murni untuk rendering. Di Opsi C → tabel
 *   `certificate_result_page`    (place, sensor_id)
 *   `certificate_result_table`   (page_id, title, order)
 *   `certificate_result_row`     (table_id, key, value, unit, extras)
 *   `certificate_result_image`   (page_id, url, caption)
 */
export const SensorDisplaySchema = z.object({
  /** Lokasi / label halaman (mis. "Lab Kal. BMKG – Sensor T/RH 10m"). */
  place: z.string(),
  /** Satu atau lebih tabel hasil (Hasil Pengukuran, Kondisi Kalibrasi, dst). */
  tables: z.array(ResultTableSchema).default([]),
  /** Lampiran gambar di halaman sensor. */
  images: z.array(ResultImageSchema).default([]),
})

// ---------------------------------------------------------------------------
// 6. Sensor Result (aggregate per sensor — satu halaman PDF)
// ---------------------------------------------------------------------------

export const SensorResultV1Schema = z.object({
  links: SensorLinksSchema,
  snapshot: SensorSnapshotSchema,
  setup: CalibrationSetupSchema,
  display: SensorDisplaySchema,
})

// ---------------------------------------------------------------------------
// 7. Certificate Results Document (root)
// ---------------------------------------------------------------------------

export const CertificateResultsV1Schema = z.object({
  schema_version: z.literal(RESULTS_SCHEMA_VERSION),
  /** Discriminator FC (Field) vs LC (Laboratory). */
  calibration_kind: z.enum(['FC', 'IFC', 'LC']),
  /** Daftar sensor yang dikalibrasi — satu entri = satu halaman PDF. */
  sensors: z.array(SensorResultV1Schema).min(1, 'Minimal satu sensor'),
})

// ---------------------------------------------------------------------------
// 8. TypeScript types — SSOT, DO NOT redeclare manually
// ---------------------------------------------------------------------------

export type ResultTableRow            = z.infer<typeof ResultTableRowSchema>
export type ResultTable               = z.infer<typeof ResultTableSchema>
export type ResultImage               = z.infer<typeof ResultImageSchema>
export type EnvironmentCondition      = z.infer<typeof EnvironmentConditionSchema>
export type StandardInstrumentRef     = z.infer<typeof StandardInstrumentRefSchema>
export type SensorLinks               = z.infer<typeof SensorLinksSchema>
export type SensorSnapshot            = z.infer<typeof SensorSnapshotSchema>
export type CalibrationSetup          = z.infer<typeof CalibrationSetupSchema>
export type SensorDisplay             = z.infer<typeof SensorDisplaySchema>
export type SensorResultV1            = z.infer<typeof SensorResultV1Schema>
export type CertificateResultsV1      = z.infer<typeof CertificateResultsV1Schema>

// ---------------------------------------------------------------------------
// 9. Version discrimination helper
// ---------------------------------------------------------------------------

/**
 * Cek apakah suatu payload sudah V1 yang valid (cek murah — hanya field
 * kunci, tanpa traversal penuh). Pakai ini sebelum memutuskan parse penuh.
 */
export function isResultsV1Shape(raw: unknown): raw is { schema_version: 1 } {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    (raw as { schema_version?: unknown }).schema_version === 1
  )
}

/**
 * Parse + validate strict. Throw `z.ZodError` jika tidak valid.
 * Dipakai di API POST/PUT (validasi client input).
 */
export function parseResultsV1Strict(raw: unknown): CertificateResultsV1 {
  return CertificateResultsV1Schema.parse(raw)
}

/**
 * Parse lunak — kembalikan `{ success, data | error }` tanpa throw.
 * Dipakai di renderer / backfill script yang butuh fallback.
 */
export function parseResultsV1Safe(raw: unknown) {
  return CertificateResultsV1Schema.safeParse(raw)
}
