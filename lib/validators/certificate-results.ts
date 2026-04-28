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
})

/** Instrumen standar yang dipakai untuk traceability. */
export const StandardInstrumentRefSchema = z.object({
  /** Link ke master — Opsi C akan jadi FK ke instruments.id */
  instrument_id: z.number().int().nullable().optional(),
  sensor_id: z.number().int().nullable().optional(),
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
  calibration_kind: z.enum(['FC', 'LC']),
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
