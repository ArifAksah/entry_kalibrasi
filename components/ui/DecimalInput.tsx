'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Input numerik desimal yang menerima koma maupun titik (mis. "200,72").
 *
 * Masalah yang diselesaikan:
 *   - `parseFloat("200,72")` mengembalikan 200 (berhenti di koma).
 *   - Input yang dikontrol oleh nilai `number` membuat karakter koma/angka
 *     sebagian menghilang saat diketik, sehingga pengguna tidak bisa menulis
 *     "200,7" (koma akan langsung lenyap pada render ulang).
 *
 * Komponen ini menahan teks mentah apa adanya selama pengguna mengetik, lalu
 * mengirim nilai `number` (hasil parsing) ke parent melalui `onChange`.
 * Buffer teks hanya "menyerah" pada nilai luar ketika nilai itu berbeda dari
 * angka terakhir yang dikirim (artinya diubah dari luar, bukan dari ketikan).
 */

export function parseDecimalInput(value: unknown, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback
  // Ganti koma dengan titik. Dukung juga koma ribuan ("1,200.5") sederhana
  // dengan menghapus spasi yang mungkin tidak disengaja.
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

interface DecimalInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'inputMode'
  > {
  /** Nilai angka terkontrol dari parent. */
  value: number | null | undefined
  /** Dipanggil dengan angka terparse (koma/titik sudah dinormalisasi). */
  onChange: (value: number) => void
}

const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onChange,
  className,
  placeholder = '0',
  ...rest
}) => {
  // Tahan teks mentah supaya koma tidak terhapus saat mengetik.
  const [text, setText] = useState(() =>
    value === null || value === undefined ? '' : String(value),
  )
  // Angka terakhir yang pernah kita kirim ke parent. Dipakai untuk membedakan
  // perubahan dari ketikan sendiri vs perubahan dari luar (edit/load data).
  const lastEmitted = useRef<number | null | undefined>(value)

  // Sinkronisasi hanya untuk nilai luar. Jangan sentuh buffer saat perubahan
  // berasal dari ketikan pengguna sendiri.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(value === null || value === undefined ? '' : String(value))
      lastEmitted.current = value
    }
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const parsed = parseDecimalInput(raw, 0)
        lastEmitted.current = parsed
        onChange(parsed)
      }}
      onBlur={() => {
        // Rapihkan tampilan saat selesai mengetik: normalisasi koma -> titik.
        const parsed = parseDecimalInput(text, 0)
        setText(text.trim() === '' ? '' : String(parsed))
        lastEmitted.current = parsed
      }}
      className={className}
      placeholder={placeholder}
      {...rest}
    />
  )
}

export default DecimalInput
