/**
 * Helper representasi kode alat (virtual) di atas tabel `instrument_names`.
 *
 * Schema production hanya punya `instrument_names(id, name, code_alat)`. Tidak
 * ada tabel master `instrument_code`. UI lama membutuhkan daftar kode + relasi
 * nama→kode berbasis ID. Agar kedua endpoint (`/api/instrument-code` dan
 * `/api/instrument-names`) menghasilkan ID yang KONSISTEN, ID perwakilan sebuah
 * kode ditetapkan sebagai `MIN(id)` pada kelompok `code_alat` tersebut —
 * deterministik dan tidak bergantung urutan query.
 */
export function buildRepresentativeIdByCode(
  rows: Array<{ id: number | string; code_alat: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const code = String(row.code_alat || '').trim()
    if (!code) continue
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const current = map.get(code)
    if (current === undefined || id < current) map.set(code, id)
  }
  return map
}
