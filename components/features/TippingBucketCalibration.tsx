'use client'

import React, { useEffect, useState } from 'react'
import type { CertStandard, Sensor } from '../../lib/supabase'
import {
  isRainGaugeSensor,
  type TippingBucketFormData,
  type TippingBucketResult,
} from '../../lib/tipping-bucket'
import {
  fetchMasterCmc,
  type CmcResult,
} from '../../lib/cmc-config'
import TippingBucketForm from './TippingBucketForm'

/**
 * Aksi tunggal kalibrasi Tipping Bucket / Penakar Hujan (RR).
 *
 * Tanggung jawab SATU komponen ini:
 *   1. Mendeteksi apakah sensor UUT adalah sensor RR.
 *   2. Merender SATU tombol aksi (hanya untuk sensor RR).
 *   3. Membuka form input kalibrasi RR.
 *   4. Menghitung hasil dan memancarkannya ke parent lewat `onCalculated`.
 *
 * Komponen ini TIDAK menyimpan data ke certificate — parent yang menyimpan.
 * Hasil perhitungan kemudian ditampilkan di QC Check lewat panel read-only
 * (`TippingBucketPanel`), sehingga tanggung jawab tampilan terpisah.
 */
interface TippingBucketCalibrationProps {
  /** Sensor UUT terpilih pada blok hasil ini. */
  sensor?: Partial<Sensor> | null
  /** Kode alat dari form sertifikat (mis. 'RR', 'AWS'). */
  instrumentCode?: string | null
  /** Nama kanonik sensor (lookup instrument_names). */
  canonicalName?: string | null
  /** Metode kalibrasi (mis. 'MK 06 - Penakar Hujan'). */
  calibrationMethod?: string | null
  /** Data RR yang sudah tersimpan (untuk mode edit). */
  initialData?: TippingBucketFormData
  standardCerts?: CertStandard[]
  standardSensors?: Array<Partial<Sensor>>
  /** Dipanggil setelah perhitungan berhasil. */
  onCalculated: (
    data: TippingBucketFormData,
    result: TippingBucketResult,
  ) => void
}

const TippingBucketCalibration: React.FC<TippingBucketCalibrationProps> = ({
  sensor,
  instrumentCode,
  canonicalName,
  calibrationMethod,
  initialData,
  standardCerts = [],
  standardSensors = [],
  onCalculated,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [cmc, setCmc] = useState<CmcResult | null>(null)
  const [cmcError, setCmcError] = useState<string | null>(null)
  const [cmcLoading, setCmcLoading] = useState(false)

  const isRainGauge = isRainGaugeSensor(
    sensor as Record<string, any> | null,
    instrumentCode,
    canonicalName,
    calibrationMethod,
  )

  useEffect(() => {
    if (!isRainGauge || !sensor) {
      setCmc(null)
      setCmcError(null)
      return
    }
    let cancelled = false
    setCmcLoading(true)
    setCmcError(null)
    fetchMasterCmc({
      uutSensor: sensor,
      calibrationMethod,
      sheetName: canonicalName || sensor.name || 'Tipping Bucket',
      unitStd: 'mm',
      unitUut: 'mm',
    })
      .then((resolved) => {
        if (cancelled) return
        setCmc(resolved)
        if (!resolved) setCmcError('Profil Master CMC RR tidak ditemukan')
      })
      .catch((error) => {
        if (cancelled) return
        setCmc(null)
        setCmcError(error instanceof Error ? error.message : 'Gagal memuat Master CMC')
      })
      .finally(() => {
        if (!cancelled) setCmcLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    isRainGauge,
    sensor?.id,
    sensor?.name,
    sensor?.type,
    canonicalName,
    calibrationMethod,
  ])

  // Sensor non-RR: tidak merender apa pun (single responsibility).
  if (!isRainGauge) return null

  const savedStandards = initialData?.standards || []
  const volumeCount = savedStandards.filter((row) => row.role === 'volume').length
  const lengthCount = savedStandards.filter((row) => row.role === 'length').length
  const standardsComplete = volumeCount > 0 && lengthCount > 0

  return (
    <>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-blue-950">
              Kalibrasi Tipping Bucket / RR
            </p>
            <p className="text-xs text-blue-700">
              Khusus Tipping Bucket/RR: pilih semua sertifikat standar VL/LN,
              isi data pengukuran, dan hitung hasil hanya melalui form ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            disabled={cmcLoading || !cmc}
            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {cmcLoading
              ? 'Memuat Master CMC...'
              : initialData
                ? 'Edit Kalibrasi RR'
                : 'Hitung Kalibrasi Tipping Bucket'}
          </button>
        </div>
        {initialData && standardsComplete && (
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            Hasil RR sudah dihitung • {volumeCount} standar Volume (VL) •{' '}
            {lengthCount} standar Panjang (LN). Klik tombol untuk mengubah.
          </p>
        )}
        {initialData && !standardsComplete && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Data RR lama belum lengkap: pilih minimal satu standar VL dan satu LN.
          </p>
        )}
        {cmcError && (
          <p className="mt-2 text-xs font-semibold text-red-700">{cmcError}</p>
        )}
      </div>

      <TippingBucketForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        sensor={sensor}
        standardCerts={standardCerts}
        standardSensors={standardSensors}
        cmc={cmc}
        initialData={initialData}
        onSubmit={(data, calculation) => {
          onCalculated(data, calculation)
          setIsFormOpen(false)
        }}
      />
    </>
  )
}

export default TippingBucketCalibration
