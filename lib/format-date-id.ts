/**
 * Format tanggal Indonesia yang DETERMINISTIK: "02 Agustus 2026".
 *
 * Sengaja tidak memakai Intl / toLocaleDateString agar hasilnya identik antara
 * render server (SSR) dan klien (CSR) — locale/timezone mesin tidak boleh
 * mengubah tanggal pada dokumen.
 *
 * Menerima 'YYYY-MM-DD', string ISO datetime, Date, atau timestamp. Bagian
 * tanggal diambil apa adanya (tanpa konversi timezone) sehingga tanggal tidak
 * bergeser satu hari. Nilai kosong/invalid dikembalikan sebagai '-' atau apa adanya.
 */
const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export function formatTanggalIndonesia(
  value: string | Date | number | null | undefined,
): string {
  if (value == null || value === '') return '-'

  let ymd: string
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '-'
    ymd = value.toISOString().slice(0, 10)
  } else if (typeof value === 'number') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    ymd = d.toISOString().slice(0, 10)
  } else {
    const s = String(value).trim()
    if (s === '') return '-'
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      ymd = `${match[1]}-${match[2]}-${match[3]}`
    } else {
      const parsed = new Date(s)
      if (Number.isNaN(parsed.getTime())) return s
      ymd = parsed.toISOString().slice(0, 10)
    }
  }

  const [y, m, d] = ymd.split('-')
  const monthIndex = Number(m) - 1
  if (monthIndex < 0 || monthIndex > 11) return String(value)
  return `${d.padStart(2, '0')} ${MONTHS_ID[monthIndex]} ${y}`
}
