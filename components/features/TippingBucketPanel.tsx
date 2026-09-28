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

/**
 * Panel READ-ONLY untuk hasil kalibrasi Tipping Bucket / RR.
 *
 * Sumber data = `certificate.results[].setup.tipping_bucket`. Panel ini tidak
 * menyentuh `raw_data` dan tidak menghitung ulang data QC. Tujuannya agar
 * verifikator bisa memeriksa input RR beserta budget ketidakpastiannya di
 * tempat yang sama dengan QC Check, tanpa mengarang baris raw data.
 */
const numberFmt = (value: unknown, digits = 6): string => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toFixed(digits)
}

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
    <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <h3 className="text-sm font-bold text-blue-900">
            Hasil Tipping Bucket / Penakar Hujan (Read-only)
          </h3>
          <p className="mt-1 text-xs text-blue-700">
            Nilai di bawah berasal dari form Tipping Bucket pada sertifikat,
            bukan dari data mentah. Input tidak dapat diubah dari QC Check.
          </p>
        </div>

        {calculated.map(({ entry, result, error }, index) => (
          <div
            key={`${entry.sensorId ?? 'unknown'}-${index}`}
            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {entry.sensorLabel || `Sensor #${entry.sensorId ?? '?'}`}
                </div>
                {entry.standardLabel && (
                  <div className="text-xs text-gray-500">
                    Standar: {entry.standardLabel}
                  </div>
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
              <div className="p-4 space-y-5">
                {/* Ringkasan konfigurasi */}
                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Konfigurasi
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <span className="block text-[11px] text-gray-400">Volume/tip</span>
                      <span className="font-mono">{numberFmt(entry.tippingBucket.volumePerTip, 4)} ml</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Resolusi UUT</span>
                      <span className="font-mono">{numberFmt(entry.tippingBucket.resolutionUut, 4)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">Volume uji</span>
                      <span className="font-mono">{numberFmt(entry.tippingBucket.testVolume, 4)} ml</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400">CMC</span>
                      <span className="font-mono">{numberFmt(entry.tippingBucket.cmcMm ?? 0, 4)} mm</span>
                    </div>
                  </div>
                </section>

                {/* Pengukuran corong */}
                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Diameter Corong ({entry.tippingBucket.funnelDiameterReadings.length} pengukuran)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {entry.tippingBucket.funnelDiameterReadings.map((value, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-sm text-gray-700"
                      >
                        {numberFmt(value, 4)} mm
                      </span>
                    ))}
                  </div>
                </section>

                {/* Pembacaan UUT & koreksi */}
                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Pembacaan Curah Hujan UUT
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-3">UUT (mm)</th>
                          <th className="py-2 pr-3">Koreksi (mm)</th>
                          <th className="py-2">Koreksi (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(row.uut, 4)}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(row.correctionMm, 6)}</td>
                            <td className="py-1.5 font-mono">{numberFmt(row.correctionPercent, 6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Budget ketidakpastian */}
                <section>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Budget Ketidakpastian
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left uppercase text-gray-500">
                          <th className="py-1.5 pr-3">Komponen</th>
                          <th className="py-1.5 pr-3">Distribusi</th>
                          <th className="py-1.5 pr-3">Pembagi</th>
                          <th className="py-1.5 pr-3">vi</th>
                          <th className="py-1.5 pr-3">ci</th>
                          <th className="py-1.5">ci·ui</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.components.map((component) => (
                          <tr key={component.name} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3 text-gray-700">{component.name}</td>
                            <td className="py-1.5 pr-3">{component.distribution}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(component.divisor, 4)}</td>
                            <td className="py-1.5 pr-3 font-mono">{component.degreesOfFreedom}</td>
                            <td className="py-1.5 pr-3 font-mono">{numberFmt(component.sensitivityCoefficient, 4)}</td>
                            <td className="py-1.5 font-mono">{numberFmt(component.contribution, 6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Hasil akhir */}
                <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-white">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-300">
                    Hasil Perhitungan
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <span className="block text-[11px] text-slate-400">Curah hujan standar</span>
                      <span className="font-mono">{numberFmt(result.standardRainfall, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Penunjukan rata-rata</span>
                      <span className="font-mono">{numberFmt(result.averageUut, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Koreksi rata-rata</span>
                      <span className="font-mono">{numberFmt(result.averageCorrectionPercent, 6)} %</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">U95 sertifikat</span>
                      <span className="font-mono">{numberFmt(result.reportedU95Percent, 6)} %</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">U95 hasil hitung</span>
                      <span className="font-mono">{numberFmt(result.rawU95Mm, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">U95 dilaporkan</span>
                      <span className="font-mono">{numberFmt(result.reportedU95Mm, 6)} mm</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Faktor cakupan (k)</span>
                      <span className="font-mono">{numberFmt(result.coverageFactor, 4)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Aturan pelaporan</span>
                      <span>{result.cmcApplied ? 'CMC diterapkan' : 'U95 hasil hitung'}</span>
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
