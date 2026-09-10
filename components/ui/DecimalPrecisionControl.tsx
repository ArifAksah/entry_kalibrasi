'use client'

import React from 'react'

const PRECISION_OPTIONS = [2, 3, 4, 5, 6, 8, 10]

export interface DecimalPrecisionControlProps {
  value: number
  onChange: (digits: number) => void
  className?: string
}

/**
 * Small control for choosing how many decimals are shown in calibration
 * uncertainty/result tables. Only affects presentation, never stored data.
 */
export const DecimalPrecisionControl: React.FC<DecimalPrecisionControlProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      <span className="text-gray-500 font-medium">Presisi desimal</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="px-1.5 py-0.5 rounded border border-gray-300 text-gray-700 bg-white text-xs"
      >
        {PRECISION_OPTIONS.map((digits) => (
          <option key={digits} value={digits}>
            {digits}
          </option>
        ))}
      </select>
    </label>
  )
}

export default DecimalPrecisionControl
