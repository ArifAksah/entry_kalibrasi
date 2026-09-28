/**
 * Kompatibilitas dual-schema untuk tabel `instrument_names`.
 *
 * Sebagian deployment memakai kolom `name` (schema baru), sebagian lagi `names`
 * (schema lama). Alih-alih mengunci satu nama kolom, helper di bawah mencoba
 * `name` terlebih dahulu dan otomatis fallback ke `names` bila kolom itu tidak
 * ada. Hasilnya selalu dinormalisasi menjadi `{ id, name, code_alat }`.
 *
 * Kesalahan "column ... does not exist" dideteksi dari error PostgREST
 * (kode 42703) sehingga fallback hanya terjadi saat perlu.
 */

export interface NormalizedInstrumentName {
  id: number
  name: string
  code_alat: string | null
  created_at?: string | null
}

// Nama kolom teks yang mungkin dipakai di berbagai deployment.
export const INSTRUMENT_NAME_TEXT_COLUMNS = ['name', 'names'] as const

/** Apakah error PostgREST menandakan kolom tidak ada (undefined_column). */
export function isMissingColumnError(error: unknown, column?: string): boolean {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  // 42703 = undefined_column (Postgres), PGRST204 = kolom tak ditemukan di
  // schema cache PostgREST (muncul saat insert/update ke kolom yang tidak ada).
  const isMissing =
    code === '42703' ||
    code === 'PGRST204' ||
    /does not exist/i.test(message) ||
    /could not find the '.*' column/i.test(message) ||
    /column .* does not exist/i.test(message)
  if (!isMissing) return false
  if (!column) return true
  return (
    new RegExp(`\\b${column}\\b`, 'i').test(message) ||
    code === '42703' ||
    code === 'PGRST204'
  )
}

/** Ambil nilai teks nama dari row apa pun bentuknya (name atau names). */
export function pickNameText(row: Record<string, unknown> | null | undefined): string {
  if (!row) return ''
  const value = row['name'] ?? row['names']
  return value == null ? '' : String(value)
}

/** Normalisasi satu row instrument_names menjadi bentuk seragam. */
export function normalizeInstrumentNameRow(
  row: Record<string, unknown>,
): NormalizedInstrumentName {
  return {
    id: Number(row.id),
    name: pickNameText(row),
    code_alat: row.code_alat == null ? null : String(row.code_alat),
    created_at: (row.created_at as string | null | undefined) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Resolver kolom teks yang di-cache per proses
// ---------------------------------------------------------------------------

let cachedTextColumn: 'name' | 'names' | null = null

/**
 * Deteksi kolom teks nama yang benar-benar ada di DB (`name` atau `names`),
 * lalu cache hasilnya. Dipakai untuk membangun SELECT dengan join embedded
 * (PostgREST nested select) yang tidak bisa fallback runtime per-query.
 *
 * `client` wajib punya `.from().select().limit()` seperti supabase-js.
 */
export async function resolveInstrumentNameTextColumn(
  client: { from: (t: string) => any },
): Promise<'name' | 'names'> {
  if (cachedTextColumn) return cachedTextColumn

  for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
    const { error } = await client
      .from('instrument_names')
      .select(`id, ${textCol}`)
      .limit(1)
    if (!error) {
      cachedTextColumn = textCol
      return textCol
    }
    if (!isMissingColumnError(error, textCol)) break
  }

  // Default aman: schema baru.
  cachedTextColumn = 'name'
  return cachedTextColumn
}

/** Reset cache (untuk test). */
export function __resetInstrumentNameTextColumnCache() {
  cachedTextColumn = null
}
