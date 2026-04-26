/**
 * Penghitung Angka Penting (Significant Figures)
 * ================================================================
 * Sesuai aturan IKK BMKG:
 *
 *  1. Semua angka bukan nol adalah angka penting.
 *       362.4     → 4
 *  2. Nol di antara angka bukan nol adalah angka penting.
 *       390.004   → 6
 *  3. Nol di sebelah kanan angka bukan nol (setelah tanda desimal)
 *     adalah angka penting.
 *       435.0000  → 7
 *  4. Nol di sebelah kanan tanda desimal dan setelah angka bukan
 *     nol adalah angka penting.
 *       45.500    → 5
 *  5. Nol di sebelah kanan angka bukan nol terakhir TANPA tanda
 *     desimal adalah TIDAK penting.
 *       650000    → 2
 *  6. Nol di sebelah kiri angka bukan nol pertama adalah TIDAK penting.
 *       0.00063   → 2
 *
 * Notasi ilmiah (1.23e4) & angka negatif didukung.
 * Input bukan angka (NaN, string tidak valid, null, undefined, "")
 * mengembalikan `null` — caller bisa tampilkan "-" / dash di UI.
 */

export type SigFigResult = {
  count: number | null   // null = tidak bisa dihitung (input tidak valid)
  normalized: string     // string yang dibersihkan (tanpa tanda, notasi dinormalisasi)
}

/**
 * Hitung jumlah angka penting dari suatu nilai numerik.
 *
 * @param value nilai bisa `string` atau `number`. Boleh mengandung `-`, `+`,
 *              tanda desimal, dan notasi ilmiah (`1.23e4`, `1.23E-4`).
 * @returns object {count, normalized}. `count=null` bila input tidak valid.
 *
 * Contoh:
 *   significantFigures("362.4")    → {count: 4, ...}
 *   significantFigures("650000")   → {count: 2, ...}
 *   significantFigures("0.00063")  → {count: 2, ...}
 *   significantFigures("45.500")   → {count: 5, ...}
 *   significantFigures("1.23e4")   → {count: 3, ...}
 *   significantFigures("")         → {count: null, ...}
 */
export function significantFigures(value: unknown): SigFigResult {
  if (value === null || value === undefined) return { count: null, normalized: '' }

  // Normalisasi ke string
  let s = typeof value === 'number' ? String(value) : String(value ?? '').trim()

  if (s === '') return { count: null, normalized: '' }

  // Tangani tanda
  s = s.replace(/^[+-]/, '')
  if (s === '') return { count: null, normalized: '' }

  // Tangani notasi ilmiah — pisahkan mantissa dan eksponen.
  // Eksponen hanya menggeser koma, tidak mengubah jumlah angka penting.
  const expMatch = s.match(/^([^eE]+)[eE]([+-]?\d+)$/)
  let mantissa = s
  if (expMatch) {
    mantissa = expMatch[1]
  }

  // Validasi format mantissa: harus berupa "123", "123.456", ".456", atau "123."
  if (!/^(\d+\.?\d*|\.\d+)$/.test(mantissa)) {
    return { count: null, normalized: s }
  }

  const hasDecimal = mantissa.includes('.')
  const digitsOnly = mantissa.replace('.', '')

  // Bila semua nol → tidak ada angka penting yang bermakna.
  // Konvensi kami: return 0 (caller bisa memilih tampilkan "0" atau "-").
  const firstNonZero = digitsOnly.search(/[1-9]/)
  if (firstNonZero === -1) {
    return { count: 0, normalized: mantissa }
  }

  let count: number
  if (hasDecimal) {
    // Semua digit dari non-zero pertama sampai akhir adalah signifikan
    // (termasuk trailing zeros — aturan 3 & 4).
    count = digitsOnly.length - firstNonZero
  } else {
    // Tanpa desimal: strip leading zeros DAN trailing zeros (aturan 5 & 6).
    const stripped = mantissa.replace(/^0+/, '').replace(/0+$/, '')
    count = stripped.length
  }

  return { count, normalized: mantissa }
}

/**
 * Versi singkat: cukup return jumlah sebagai number, dan `null` bila invalid.
 * Cocok untuk render langsung di UI.
 */
export function countSignificantFigures(value: unknown): number | null {
  return significantFigures(value).count
}

/**
 * Format hasil angka penting sebagai label pendek untuk UI, mis:
 *   "4 AP" | "— AP" (bila tidak valid)
 */
export function formatSigFigLabel(value: unknown): string {
  const n = countSignificantFigures(value)
  return n === null ? '— AP' : `${n} AP`
}

// -----------------------------------------------------------------------
// Self-test (dipanggil manual untuk verifikasi di dev tools):
//   import { __sigFigSelfTest } from '@/lib/significant-figures'
//   __sigFigSelfTest()
// -----------------------------------------------------------------------
export function __sigFigSelfTest(): void {
  const cases: Array<[string | number, number | null]> = [
    // Contoh resmi dari tabel IKK
    ['362.4',   4],  // aturan 1
    ['390.004', 6],  // aturan 2
    ['435.0000', 7], // aturan 3
    ['45.500',  5],  // aturan 4
    ['650000',  2],  // aturan 5
    ['0.00063', 2],  // aturan 6

    // Tambahan: negatif, notasi ilmiah, bilangan bulat dengan titik
    ['-362.4',  4],
    ['1.23e4',  3],
    ['1.230E-4', 4],
    ['100.',    3],  // titik eksplisit memaksa trailing zero jadi penting
    ['100',     1],
    ['0',       0],
    ['0.000',   0],
    ['.0063',   2],
    ['1000.0',  5],

    // Invalid
    ['',        null],
    ['abc',     null],
    ['1.2.3',   null],
    [null as any, null],
    [undefined as any, null],
  ]

  const results = cases.map(([input, expected]) => {
    const actual = countSignificantFigures(input)
    return { input, expected, actual, pass: actual === expected }
  })
  // eslint-disable-next-line no-console
  console.table(results)
  const failed = results.filter(r => !r.pass)
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[sigFigSelfTest] FAILED: ${failed.length}/${results.length}`, failed)
  } else {
    // eslint-disable-next-line no-console
    console.log(`[sigFigSelfTest] PASSED: ${results.length}/${results.length}`)
  }
}
