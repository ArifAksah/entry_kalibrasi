'use client'

import React, { useMemo } from 'react'
import {
  calculateTippingBucket,
  type TippingBucketFormData,
  type TippingBucketResult,
} from '../../lib/tipping-bucket'

export interface TippingBucketPanelEntry {
  sensorId: number | null
  sensorLabel?: string | null
  standardLabel?: string | null
  tippingBucket: TippingBucketFormData
}

interface TippingBucketPanelProps {
  entries: TippingBucketPanelEntry[]
}

const numberFmt = (value: unknown, digits = 6): string => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toFixed(digits)
}

/** Data pengukuran RR yang tampil di QC Check; budget uncertainty ada di modal uncertainty. */
const TippingBucketPanel: React.FC<TippingBucketPanelProps> = ({ entries }) => {
  const calculated = useMemo(() => {
    return entries.map((entry) => {
      let result: TippingBucketResult | null = null
      let error: string | null = null
      try {
        result = calculateTippingBucket(entry.tippingBucket)
      } catch (e) {
        error = e instanceof Error ? e.message : 'Perhitungan tidak dapat dilakukan'
      }
      return { entry, result, error }
    })
  }, [entries])

  if (entries.length === 0) return null

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <h3 className="text-sm font-bold text-blue-900">
            Data Pengukuran Tipping Bucket / Penakar Hujan
          </h3>
          <p className="mt-1 text-xs text-blue-700">
            Data di bawah berasal dari form Tipping Bucket pada sertifikat.
            Budget uncertainty ditampilkan pada tampilan Uncertainty.
          </p>
        </div>

        {calculated.map(({ entry, result, error }, index) => (
          <div
            key={`${entry.sensorId ?? 'unknown'}-${index}`}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {entry.sensorLabel || `Sensor #${entry.sensorId ?? '?'}`}
                </div>
                {entry.standardLabel && (
                  <div className="text-xs text-gray-500">Standar: {entry.standardLabel}</div>
                )}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                Tipping Bucket
              </span>
            </div>

            {error || !result ? (
              <div className="px-4 py-4 text-sm text-red-600">
                {error || 'Data tidak lengkap.'}
              </div>
            ) : (
              <div className="space-y-5 p-4">
                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Simulasi Hujan
                  </h4>
                  <div className="mb-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <span className="block text-[11px] text-gray-400">Volume uji</span>
                      <span className="font-mono">{numberFmt(entry.tippingBucket.testVolume, 4)} ml</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Curah hujan STD</span>
                      <span className="font-mono">{numberFmt(result.standardRainfall, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Rata-rata UUT</span>
                      <span className="font-mono">{numberFmt(result.averageUut, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Koreksi rata-rata</span>
                      <span className="font-mono">{numberFmt(result.averageCorrectionPercent, 6)} %</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
                          <th className="py-2 pr-3">No.</th>
                          <th className="py-2 pr-3">STD (mm)</th>
                          <th className="py-2 pr-3">UUT (mm)</th>
                          <th className="py-2 pr-3">Koreksi (mm)</th>
                          <th className="py-2">Koreksi (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3 text-gray-400">{rowIndex + 1}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(result.standardRainfall, 6)}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(row.uut, 6)}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(row.correctionMm, 6)}</td>
                            <td className="py-1.5 font-mono">{numberFmt(row.correctionPercent, 6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Pengukuran Jangka Sorong
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
                          <th className="py-2 pr-3">No.</th>
                          <th className="py-2 pr-3">Diameter Corong (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.tippingBucket.funnelDiameterReadings.map((value, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3 text-gray-400">{rowIndex + 1}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(value, 6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <span className="block text-[11px] text-gray-400">Rata-rata diameter</span>
                      <span className="font-mono">{numberFmt(result.averageFunnelDiameter, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Jumlah pengukuran</span>
                      <span className="font-mono">{entry.tippingBucket.funnelDiameterReadings.length}</span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TippingBucketPanel
