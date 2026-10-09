'use client'

import React, { useEffect, useState } from 'react'
import type { CertStandard, Sensor } from '../../lib/supabase'
import {
  aggregateStandardRoles,
  calculateTippingBucket,
  TIPPING_BUCKET_LEGACY_DIVISOR,
  TIPPING_BUCKET_METHOD_VERSION,
  roleFromParameterCode,
  type TippingBucketFormData,
  type TippingBucketResult,
  type TippingBucketStandardRole,
  type TippingBucketStandardRow,
} from '../../lib/tipping-bucket'
import type { CmcResult } from '../../lib/cmc-config'
import SearchableDropdown from '../ui/SearchableDropdown'

// Nilai default RR-LEGACY-V1 mengikuti workbook lapangan. Nilai ini bukan
// resolusi standar dan tidak boleh diperkecil menjadi 0,019 secara otomatis.
const WORKBOOK_MENISCUS_UNCERTAINTY = '0.1946279481'

interface TippingBucketFormProps {
  isOpen: boolean
  onClose: () => void
  sensor?: Partial<Sensor> | null
  standardCerts?: CertStandard[]
  standardSensors?: Array<Partial<Sensor>>
  cmc?: CmcResult | null
  initialData?: TippingBucketFormData
  onSubmit: (data: TippingBucketFormData, result: TippingBucketResult) => void
}

type ScalarKey =
  | 'testVolume'
  | 'meniscusUncertainty'

/**
 * Kalibrasi RR hanya punya dua peran standar tetap: Volume (gelas ukur) dan
 * Panjang (jangka sorong). Peran ditentukan oleh slot — bukan hasil filter
 * `parameter_code`. Dengan begitu dropdown tidak pernah kosong meskipun sensor
 * standar belum diberi Parameter Code. `parameter_code` tetap dipakai untuk
 * mengisi slot secara otomatis dan untuk menandai saran.
 */
const ROLE_SLOTS: Array<{
  role: TippingBucketStandardRole
  title: string
  badge: string
  parameterLabel: string
  hint: string
}> = [
  {
    role: 'volume',
    title: 'Standar Volume (Gelas Ukur)',
    badge: 'Volume',
    parameterLabel: 'VL',
    hint: 'Gelas ukur / alat ukur volume. Terisi otomatis bila sensor standar ber-Parameter Code VL.',
  },
  {
    role: 'length',
    title: 'Standar Panjang (Jangka Sorong)',
    badge: 'Panjang',
    parameterLabel: 'LN',
    hint: 'Jangka sorong / alat ukur panjang. Terisi otomatis bila sensor standar ber-Parameter Code LN.',
  },
]

const numberText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : fallback
}

const parseNumber = (value: string): number => {
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function TippingBucketForm({
  isOpen,
  onClose,
  sensor,
  standardCerts = [],
  standardSensors = [],
  cmc,
  initialData,
  onSubmit,
}: TippingBucketFormProps) {
  const [diameters, setDiameters] = useState<string[]>(['', '', '', ''])
  const [readings, setReadings] = useState<string[]>(['', '', ''])
  const [standards, setStandards] = useState<TippingBucketStandardRow[]>([])
  const [fields, setFields] = useState<Record<ScalarKey, string>>({
    testVolume: '200',
    meniscusUncertainty: WORKBOOK_MENISCUS_UNCERTAINTY,
  })
  const [preview, setPreview] = useState<TippingBucketResult | null>(null)
  const [error, setError] = useState('')

  const certificateSensor = (certificate: CertStandard) =>
    standardSensors.find((item) => Number(item.id) === Number(certificate.sensor_id))

  const certificateOptionLabel = (certificate: CertStandard) => {
    const standardSensor = certificateSensor(certificate)
    const sensorLabel =
      standardSensor?.name || standardSensor?.type || `Sensor #${certificate.sensor_id}`
    const parameter = standardSensor?.parameter_code
      ? ` [${standardSensor.parameter_code}]`
      : ''
    return `${sensorLabel}${parameter} — ${certificate.no_certificate || '-'}`
  }

  /** Bangun satu baris standar dari sertifikat terpilih (peran dari slot). */
  const rowFromCertificate = (
    certificate: CertStandard,
    role: TippingBucketStandardRole,
  ): TippingBucketStandardRow => {
    const standardSensor = certificateSensor(certificate)
    return {
      role,
      parameterCode: standardSensor?.parameter_code ?? null,
      certificateId: certificate.id,
      sensorId: certificate.sensor_id,
      instrumentId: (standardSensor as any)?.instrument_id ?? null,
      certificateNumber: certificate.no_certificate || null,
      u95: Number(certificate.u95_general) || 0,
      drift: Number(certificate.drift) || 0,
      resolution: Number(certificate.resolution) || 0,
    }
  }

  const slotRow = (role: TippingBucketStandardRole) =>
    standards.find((row) => row.role === role) || null

  /** Sertifikat yang cocok peran (parameter VL/LN) didahulukan, sisanya tetap tersedia. */
  const slotCertificates = (role: TippingBucketStandardRole) => {
    const matched: CertStandard[] = []
    const others: CertStandard[] = []
    for (const certificate of standardCerts) {
      if (
        roleFromParameterCode(certificateSensor(certificate)?.parameter_code) === role
      ) {
        matched.push(certificate)
      } else {
        others.push(certificate)
      }
    }
    return { matched, others }
  }

  const setSlotCertificate = (
    role: TippingBucketStandardRole,
    certificateId: string,
  ) => {
    if (!certificateId) {
      setStandards((current) => {
        const index = current.findIndex((row) => row.role === role)
        if (index < 0) return current
        return current.filter((_, i) => i !== index)
      })
      return
    }
    const certificate = standardCerts.find(
      (item) => Number(item.id) === Number(certificateId),
    )
    if (!certificate) return
    const built = rowFromCertificate(certificate, role)
    setError('')
    setStandards((current) => {
      const index = current.findIndex((row) => row.role === role)
      if (index < 0) return [...current, built]
      const next = [...current]
      next[index] = built
      return next
    })
  }

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

    // Muat standar tersimpan, lalu prefill slot yang masih kosong dari sensor
    // standar yang sudah ber-Parameter Code VL/LN (tanpa memaksa operator).
    const saved = Array.isArray(initialData?.standards)
      ? initialData!.standards!
      : []
    const seeded: TippingBucketStandardRow[] = [...saved]
    for (const slot of ROLE_SLOTS) {
      if (seeded.some((row) => row.role === slot.role)) continue
      const match = standardCerts.find(
        (certificate) =>
          roleFromParameterCode(
            standardSensors.find(
              (item) => Number(item.id) === Number(certificate.sensor_id),
            )?.parameter_code,
          ) === slot.role,
      )
      if (match) seeded.push(rowFromCertificate(match, slot.role))
    }
    setStandards(seeded)

    setFields({
      testVolume: numberText(initialData?.testVolume, '200'),
      meniscusUncertainty: numberText(
        initialData?.meniscusUncertainty,
        WORKBOOK_MENISCUS_UNCERTAINTY,
      ),
    })
    setPreview(null)
    setError('')
    // Prefill sengaja tidak bergantung pada identitas array turunan parent
    // (standardSensors dibentuk ulang tiap render) agar isian tidak ter-reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData, sensor])

  if (!isOpen) return null

  const buildInput = (): TippingBucketFormData => {
    if (!cmc) {
      throw new Error('Master CMC RR tidak ditemukan atau belum aktif')
    }
    const withCert = standards.filter((row) => row.certificateId != null)
    if (withCert.length === 0) {
      throw new Error('Minimal satu sertifikat standar wajib dipilih')
    }
    const hasVolume = withCert.some((row) => row.role === 'volume')
    const hasLength = withCert.some((row) => row.role === 'length')
    if (!hasVolume) {
      throw new Error('Standar Volume (gelas ukur) wajib dipilih')
    }
    if (!hasLength) {
      throw new Error('Standar Panjang (jangka sorong) wajib dipilih')
    }

    const aggregated = aggregateStandardRoles(withCert)

    // Spec UUT bersumber dari master sensor (menu Instrumen), bukan input form.
    // Saat edit, gunakan snapshot tersimpan agar hitung ulang reproduktif.
    // Master hanya menjadi fallback untuk RR baru yang belum memiliki snapshot.
    const masterVolumePerTip = parseNumber(
      String(initialData?.volumePerTip ?? sensor?.volume_per_tip ?? ''),
    )
    const masterResolution = parseNumber(
      String(
        initialData?.resolutionUut ??
          sensor?.resolution ??
          sensor?.graduating ??
          '',
      ),
    )
    if (!masterVolumePerTip) {
      throw new Error('Volume per tip belum terisi pada master sensor UUT')
    }
    if (!masterResolution) {
      throw new Error('Resolusi UUT belum terisi pada master sensor UUT')
    }

    return {
      funnelDiameterReadings: diameters
        .filter((value) => value.trim() !== '')
        .map(parseNumber),
      rainUutReadings: readings
        .filter((value) => value.trim() !== '')
        .map(parseNumber),
      volumePerTip: masterVolumePerTip,
      resolutionUut: masterResolution,
      testVolume: parseNumber(fields.testVolume),
      volumeCertificateU95: aggregated.volumeCertificateU95,
      volumeStandardDrift: aggregated.volumeStandardDrift,
      caliperCertificateU95: aggregated.caliperCertificateU95,
      caliperDrift: aggregated.caliperDrift,
      caliperResolution: aggregated.caliperResolution,
      meniscusUncertainty: parseNumber(fields.meniscusUncertainty),
      cmcMm: initialData?.cmcMm ?? cmc.cmcOutput,
      standards: withCert,
      cmcProfileId: initialData?.cmcProfileId ?? cmc.profileId ?? null,
      cmcProfileCode: initialData?.cmcProfileCode ?? cmc.profileCode ?? null,
      cmcVersion: initialData?.cmcVersion ?? cmc.version ?? null,
      cmcSourceDocument:
        initialData?.cmcSourceDocument ?? cmc.sourceDocument ?? null,
      methodVersion: TIPPING_BUCKET_METHOD_VERSION,
      formulaVersion: 1,
    }
  }

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

  const specDisplay = (label: string, value: string, unit: string) => (
    <div>
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      <div className="flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
        <span className="min-w-0 flex-1 truncate font-mono">{value || '-'}</span>
        <span className="ml-2 text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  )

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

  const updateList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => setter((current) => current.map((item, i) => (i === index ? value : item)))

  const removeListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => setter((current) => current.filter((_, i) => i !== index))

  // Curah hujan standar dihitung dari master UUT + Volume uji (mengikuti workbook):
  //   standar (mm) = resolusi UUT (mm) × Volume uji (ml) / volume per tip (ml)
  const previewResolution = parseNumber(
    String(
      initialData?.resolutionUut ??
        sensor?.resolution ??
        sensor?.graduating ??
        '',
    ),
  )
  const previewVolumePerTip = parseNumber(
    String(initialData?.volumePerTip ?? sensor?.volume_per_tip ?? ''),
  )
  const previewTestVolume = parseNumber(fields.testVolume)
  const previewStandardRainfall =
    previewVolumePerTip > 0
      ? (previewResolution * previewTestVolume) / previewVolumePerTip
      : 0

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold">Input Kalibrasi Tipping Bucket</h2>
            <p className="mt-0.5 text-xs text-blue-100">
              Khusus RR: pilih satu sertifikat standar Volume (gelas ukur) dan
              satu Panjang (jangka sorong) di sini. Bagian Alat Standar umum
              tidak digunakan.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-xl hover:bg-white/10">
            x
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-300 bg-white p-4">
              <h3 className="mb-1 font-bold text-slate-800">
                Spesifikasi UUT (Master)
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Untuk edit, nilai yang sudah tersimpan pada RR dipakai kembali
                agar hasil dapat direproduksi. Nilai master dipakai sebagai
                fallback untuk perhitungan baru.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {specDisplay(
                  'Volume per tip',
                  String(initialData?.volumePerTip ?? sensor?.volume_per_tip ?? ''),
                  sensor?.volume_per_tip_unit || 'ml',
                )}
                {specDisplay(
                  'Resolusi UUT',
                  String(
                    initialData?.resolutionUut ??
                      sensor?.resolution ??
                      sensor?.graduating ??
                      '',
                  ),
                  sensor?.graduating_unit || 'mm',
                )}
                {specDisplay(
                  'Rentang Ukur',
                  String(sensor?.range_capacity ?? ''),
                  sensor?.range_capacity_unit || 'mm',
                )}
                {specDisplay(
                  'Diameter rata-rata',
                  preview
                    ? String(preview.averageFunnelDiameter)
                    : String(sensor?.funnel_diameter ?? ''),
                  sensor?.funnel_diameter_unit || 'mm',
                )}
              </div>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <h3 className="mb-3 font-bold text-blue-950">Konfigurasi UUT</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scalarInput('testVolume', 'Volume uji', 'ml')}
                {scalarInput('meniscusUncertainty', 'Ketidakpastian meniskus', 'ml')}
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  <span>CMC dari Master</span>
                  <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm">
                    {cmc ? (
                      <>
                        <span className="font-mono font-bold text-blue-900">
                          {cmc.cmcOutput} {cmc.nativeUnit}
                        </span>
                        <span className="ml-2 text-[10px] text-slate-500">
                          {cmc.profileCode || cmc.profileName || 'Master CMC'}
                          {cmc.version ? ` v${cmc.version}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-red-600">
                        Master CMC RR tidak ditemukan
                      </span>
                    )}
                  </div>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 lg:col-span-2">
              <h3 className="mb-1 font-bold text-emerald-950">
                Sertifikat Standar
              </h3>
              <p className="mb-3 text-xs text-emerald-800">
                Wajib satu standar Volume (gelas ukur) dan satu Panjang (jangka
                sorong). Peran ditentukan oleh slot. Slot terisi otomatis bila
                sensor standar sudah diberi Parameter Code (VL/LN) di menu
                Sensors; jika belum, pilih manual dari daftar.
              </p>
              <div className="space-y-3">
                {ROLE_SLOTS.map((slot) => {
                  const row = slotRow(slot.role)
                  const { matched, others } = slotCertificates(slot.role)
                  return (
                    <div
                      key={slot.role}
                      className="rounded-lg border border-emerald-200 bg-white p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            {slot.title} *
                          </label>
                          <SearchableDropdown
                            value={row?.certificateId ?? null}
                            onChange={(value) =>
                              setSlotCertificate(
                                slot.role,
                                value == null ? '' : String(value),
                              )
                            }
                            options={[
                              ...matched.map((certificate) => ({
                                id: certificate.id,
                                name: `\u2605 ${certificateOptionLabel(certificate)}`,
                                station_id: `Disarankan (${slot.parameterLabel})`,
                              })),
                              ...others.map((certificate) => ({
                                id: certificate.id,
                                name: certificateOptionLabel(certificate),
                                station_id: 'Standar lain',
                              })),
                            ]}
                            placeholder={
                              standardCerts.length === 0
                                ? 'Belum ada sertifikat standar terdaftar'
                                : 'Pilih sertifikat standar...'
                            }
                            searchPlaceholder="Cari sertifikat standar (nomor, sensor, parameter)..."
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            {slot.hint}
                          </p>
                        </div>
                        <div className="w-28 shrink-0 text-center">
                          <span className="block text-[10px] font-semibold text-slate-400">
                            Peran
                          </span>
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-bold ${
                              slot.role === 'volume'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {slot.badge}
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {row?.parameterCode || slot.parameterLabel}
                          </span>
                        </div>
                      </div>
                      {row?.certificateId != null && (
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                          <div>
                            <span className="block text-slate-400">U95</span>
                            <span className="font-mono">
                              {numberText(row.u95, '0')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Drift</span>
                            <span className="font-mono">
                              {numberText(row.drift, '0')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Resolusi</span>
                            <span className="font-mono">
                              {numberText(row.resolution, '0')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {dynamicInputs('Pengukuran Diameter Corong', diameters, setDiameters, 'mm')}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">Simulasi Hujan</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Set Point (Volume Uji) & Curah Hujan Standar dihitung dari
                    master UUT (resolusi & volume/tip). Isi pembacaan Curah
                    Hujan UUT per pengulangan; Koreksi = Standar − UUT (otomatis).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReadings((current) => [...current, ''])}
                  className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  + Tambah Baris
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Set Point (Volume Uji) mL</th>
                      <th className="py-2 pr-3">Curah Hujan Standar mm</th>
                      <th className="py-2 pr-3">Curah Hujan UUT mm</th>
                      <th className="py-2 pr-3">Koreksi mm</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((value, index) => {
                      const uut = parseNumber(value)
                      const correction =
                        value.trim() === '' ? null : previewStandardRainfall - uut
                      return (
                        <tr
                          key={index}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="py-2 pr-3 text-slate-400">{index + 1}</td>
                          <td className="py-2 pr-3 font-mono text-slate-600">
                            {fields.testVolume || '-'}
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-600">
                            {previewStandardRainfall
                              ? previewStandardRainfall.toFixed(4)
                              : '-'}
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              inputMode="decimal"
                              value={value}
                              onChange={(event) =>
                                updateList(setReadings, index, event.target.value)
                              }
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-600">
                            {correction == null ? '-' : correction.toFixed(6)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              disabled={readings.length === 1}
                              onClick={() => removeListItem(setReadings, index)}
                              className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label={`Hapus baris ${index + 1}`}
                            >
                              x
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
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
                <div><span className="block text-xs text-slate-400">Metode</span>{preview.methodVersion}</div>
                <div><span className="block text-xs text-slate-400">Pembagi RR</span>{TIPPING_BUCKET_LEGACY_DIVISOR.toFixed(6)} (workbook)</div>
                <div><span className="block text-xs text-slate-400">Aturan pelaporan</span>{preview.cmcApplied ? 'CMC diterapkan' : 'U95 hasil hitung'}</div>
                {preview.warnings.length > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 md:col-span-4">
                    {preview.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                  </div>
                )}
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
            Hitung &amp; Isi ke Sertifikat
          </button>
        </footer>
      </div>
    </div>
  )
}
