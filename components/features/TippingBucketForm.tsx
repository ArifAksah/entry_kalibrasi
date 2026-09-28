'use client'

import React, { useEffect, useState } from 'react'
import type { CertStandard, Sensor } from '../../lib/supabase'
import {
  calculateTippingBucket,
  type TippingBucketFormData,
  type TippingBucketResult,
} from '../../lib/tipping-bucket'

interface TippingBucketFormProps {
  isOpen: boolean
  onClose: () => void
  sensor?: Partial<Sensor> | null
  standardCertificate?: Partial<CertStandard> | null
  initialData?: TippingBucketFormData
  defaultCmcMm?: number
  onSubmit: (data: TippingBucketFormData, result: TippingBucketResult) => void
}

type ScalarKey = Exclude<
  keyof TippingBucketFormData,
  'funnelDiameterReadings' | 'rainUutReadings'
>

const numberText = (value: unknown, fallback = '') => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed !== 0 ? String(parsed) : fallback
}

const parseNumber = (value: string): number => {
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function TippingBucketForm({
  isOpen,
  onClose,
  sensor,
  standardCertificate,
  initialData,
  defaultCmcMm = 0.19,
  onSubmit,
}: TippingBucketFormProps) {
  const [diameters, setDiameters] = useState<string[]>(['', '', '', ''])
  const [readings, setReadings] = useState<string[]>(['', '', ''])
  const [fields, setFields] = useState<Record<ScalarKey, string>>({
    volumePerTip: '',
    resolutionUut: '',
    testVolume: '200',
    volumeCertificateU95: '',
    volumeStandardDrift: '',
    caliperCertificateU95: '',
    caliperDrift: '',
    caliperResolution: '',
    meniscusUncertainty: '',
    cmcMm: String(defaultCmcMm),
    repeatabilityDivisor: String(Math.sqrt(5)),
    diameterDivisor: String(Math.sqrt(5)),
  })
  const [preview, setPreview] = useState<TippingBucketResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setDiameters(
      initialData?.funnelDiameterReadings?.length
        ? initialData.funnelDiameterReadings.map(String)
        : ['', '', '', ''],
    )
    setReadings(
      initialData?.rainUutReadings?.length
        ? initialData.rainUutReadings.map(String)
        : ['', '', ''],
    )
    setFields({
      volumePerTip: numberText(
        initialData?.volumePerTip ?? sensor?.volume_per_tip,
      ),
      resolutionUut: numberText(
        initialData?.resolutionUut ?? sensor?.resolution ?? sensor?.graduating,
      ),
      testVolume: numberText(initialData?.testVolume, '200'),
      volumeCertificateU95: numberText(
        initialData?.volumeCertificateU95 ?? standardCertificate?.u95_general,
      ),
      volumeStandardDrift: numberText(
        initialData?.volumeStandardDrift ?? standardCertificate?.drift,
      ),
      caliperCertificateU95: numberText(initialData?.caliperCertificateU95),
      caliperDrift: numberText(initialData?.caliperDrift),
      caliperResolution: numberText(initialData?.caliperResolution),
      meniscusUncertainty: numberText(initialData?.meniscusUncertainty),
      cmcMm: numberText(initialData?.cmcMm ?? defaultCmcMm),
      repeatabilityDivisor: numberText(
        initialData?.repeatabilityDivisor,
        String(Math.sqrt(5)),
      ),
      diameterDivisor: numberText(
        initialData?.diameterDivisor,
        String(Math.sqrt(5)),
      ),
    })
    setPreview(null)
    setError('')
  }, [isOpen, initialData, sensor, standardCertificate, defaultCmcMm])

  if (!isOpen) return null

  const updateList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => setter((current) => current.map((item, i) => (i === index ? value : item)))

  const removeListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => setter((current) => current.filter((_, i) => i !== index))

  const buildInput = (): TippingBucketFormData => ({
    funnelDiameterReadings: diameters
      .filter((value) => value.trim() !== '')
      .map(parseNumber),
    rainUutReadings: readings
      .filter((value) => value.trim() !== '')
      .map(parseNumber),
    volumePerTip: parseNumber(fields.volumePerTip),
    resolutionUut: parseNumber(fields.resolutionUut),
    testVolume: parseNumber(fields.testVolume),
    volumeCertificateU95: parseNumber(fields.volumeCertificateU95),
    volumeStandardDrift: parseNumber(fields.volumeStandardDrift),
    caliperCertificateU95: parseNumber(fields.caliperCertificateU95),
    caliperDrift: parseNumber(fields.caliperDrift),
    caliperResolution: parseNumber(fields.caliperResolution),
    meniscusUncertainty: parseNumber(fields.meniscusUncertainty),
    cmcMm: parseNumber(fields.cmcMm),
    repeatabilityDivisor: parseNumber(fields.repeatabilityDivisor),
    diameterDivisor: parseNumber(fields.diameterDivisor),
  })

  const calculate = () => {
    try {
      const data = buildInput()
      const result = calculateTippingBucket(data)
      setPreview(result)
      setError('')
      return { data, result }
    } catch (calculationError) {
      setPreview(null)
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : 'Perhitungan tidak dapat dilakukan',
      )
      return null
    }
  }

  const scalarInput = (key: ScalarKey, label: string, unit: string) => (
    <label className="space-y-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <div className="flex rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500/30">
        <input
          inputMode="decimal"
          value={fields[key]}
          onChange={(event) =>
            setFields((current) => ({ ...current, [key]: event.target.value }))
          }
          className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-sm outline-none"
        />
        <span className="flex min-w-12 items-center justify-center border-l border-slate-200 bg-slate-50 px-2 text-slate-500">
          {unit}
        </span>
      </div>
    </label>
  )

  const dynamicInputs = (
    title: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    unit: string,
  ) => (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => setter((current) => [...current, ''])}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
        >
          + Tambah Baris
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs font-semibold text-slate-400">
              {index + 1}.
            </span>
            <div className="flex min-w-0 flex-1 rounded-lg border border-slate-300">
              <input
                inputMode="decimal"
                value={value}
                onChange={(event) => updateList(setter, index, event.target.value)}
                className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <span className="flex items-center border-l border-slate-200 bg-slate-50 px-2 text-xs text-slate-500">
                {unit}
              </span>
            </div>
            <button
              type="button"
              disabled={values.length === 1}
              onClick={() => removeListItem(setter, index)}
              className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Hapus baris ${index + 1}`}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold">Input Kalibrasi Tipping Bucket</h2>
            <p className="mt-0.5 text-xs text-blue-100">
              Jumlah pengulangan fleksibel. Gunakan titik atau koma untuk desimal.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-xl hover:bg-white/10">
            x
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <h3 className="mb-3 font-bold text-blue-950">Konfigurasi UUT</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scalarInput('volumePerTip', 'Volume per tip', 'ml')}
                {scalarInput('resolutionUut', 'Resolusi UUT', 'mm')}
                {scalarInput('testVolume', 'Volume uji', 'ml')}
                {scalarInput('cmcMm', 'CMC', 'mm')}
              </div>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="mb-1 font-bold text-emerald-950">Parameter Alat Standar</h3>
              <p className="mb-3 text-xs text-emerald-800">
                U95 dan drift awal diambil dari sertifikat standar terpilih. Lengkapi parameter standar lain sesuai sertifikatnya.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scalarInput('volumeCertificateU95', 'U95 gelas ukur', 'ml')}
                {scalarInput('volumeStandardDrift', 'Drift gelas ukur', 'ml')}
                {scalarInput('caliperCertificateU95', 'U95 jangka sorong', 'mm')}
                {scalarInput('caliperDrift', 'Drift jangka sorong', 'mm')}
                {scalarInput('caliperResolution', 'Resolusi jangka sorong', 'mm')}
                {scalarInput('meniscusUncertainty', 'Ketidakpastian meniskus', 'ml')}
              </div>
            </section>

            {dynamicInputs('Pengukuran Diameter Corong', diameters, setDiameters, 'mm')}
            {dynamicInputs('Pembacaan Curah Hujan UUT', readings, setReadings, 'mm')}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {preview && (
            <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-white">
              <h3 className="mb-3 font-bold">Preview Hasil</h3>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><span className="block text-xs text-slate-400">Diameter rata-rata</span>{preview.averageFunnelDiameter.toFixed(4)} mm</div>
                <div><span className="block text-xs text-slate-400">Curah hujan standar</span>{preview.standardRainfall.toFixed(6)} mm</div>
                <div><span className="block text-xs text-slate-400">Penunjukan rata-rata</span>{preview.averageUut.toFixed(6)} mm</div>
                <div><span className="block text-xs text-slate-400">Koreksi rata-rata</span>{preview.averageCorrectionPercent.toFixed(6)} %</div>
                <div><span className="block text-xs text-slate-400">U95 hasil hitung</span>{preview.rawU95Mm.toFixed(6)} mm</div>
                <div><span className="block text-xs text-slate-400">U95 dilaporkan</span>{preview.reportedU95Mm.toFixed(6)} mm</div>
                <div><span className="block text-xs text-slate-400">U95 sertifikat</span>{preview.reportedU95Percent.toFixed(6)} %</div>
                <div><span className="block text-xs text-slate-400">Aturan pelaporan</span>{preview.cmcApplied ? 'CMC diterapkan' : 'U95 hasil hitung'}</div>
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button type="button" onClick={calculate} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Hitung Preview
          </button>
          <button
            type="button"
            onClick={() => {
              const calculated = calculate()
              if (calculated) onSubmit(calculated.data, calculated.result)
            }}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            Hitung & Isi ke Sertifikat
          </button>
        </footer>
      </div>
    </div>
  )
}
