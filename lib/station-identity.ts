/**
 * Normalisasi dan validasi identitas stasiun (WMO/station_id).
 *
 * Aturan:
 *  - station_id di DB dipakai sebagai WMO ID.
 *  - Nilai di-trim; string kosong menjadi null.
 *  - Hanya digit yang diterima (WMO 5 digit, tapi panjang dibiarkan fleksibel
 *    agar ID internal non-WMO tetap bisa disimpan bila memang diperlukan).
 */

export type NormalizedStationId =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

export function normalizeStationId(value: unknown): NormalizedStationId {
  if (value === null || value === undefined) return { ok: true, value: null }

  const raw = String(value).trim()
  if (raw === '') return { ok: true, value: null }

  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      error: 'ID Stasiun/WMO hanya boleh berisi angka.',
    }
  }

  return { ok: true, value: raw }
}
