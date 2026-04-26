"use client"

import React from 'react'
import { countSignificantFigures } from '../../lib/significant-figures'

/**
 * Badge kecil yang menampilkan jumlah angka penting (AP) suatu nilai,
 * sesuai aturan IKK BMKG. Hanya panduan visual — tidak memblok input.
 *
 * Pemakaian:
 *   <SigFigBadge value={row.value} />
 *   <SigFigBadge value={-0.00063} />
 *
 * Rendering:
 *   "4 AP"  — nilai valid
 *   "—"     — nilai kosong / tidak valid (bisa disembunyikan via `hideWhenInvalid`)
 */
export interface SigFigBadgeProps {
  value: unknown
  /** Sembunyikan badge bila input tidak valid / kosong. Default: true */
  hideWhenInvalid?: boolean
  /** Custom className untuk override style */
  className?: string
  /** Tampilkan tooltip dengan aturan IKK */
  showTooltip?: boolean
}

const TOOLTIP_IKK = [
  'Angka Penting (IKK BMKG):',
  '1. Semua angka bukan nol → penting',
  '2. Nol di antara angka bukan nol → penting',
  '3. Nol setelah angka bukan nol + titik desimal → penting',
  '4. Trailing nol setelah desimal → penting',
  '5. Trailing nol tanpa desimal → TIDAK penting',
  '6. Leading nol → TIDAK penting',
].join('\n')

export const SigFigBadge: React.FC<SigFigBadgeProps> = ({
  value,
  hideWhenInvalid = true,
  className = '',
  showTooltip = true,
}) => {
  const count = countSignificantFigures(value)

  if (count === null) {
    if (hideWhenInvalid) return null
    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-100 text-gray-400 border border-gray-200 ${className}`}
        title={showTooltip ? TOOLTIP_IKK : undefined}
      >
        — AP
      </span>
    )
  }

  // Warnai berbeda saat 0 (semua nol) supaya user tahu itu edge case
  const tone =
    count === 0
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-blue-50 text-blue-700 border-blue-200'

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none border ${tone} ${className}`}
      title={showTooltip ? TOOLTIP_IKK : undefined}
    >
      {count} AP
    </span>
  )
}

export default SigFigBadge
