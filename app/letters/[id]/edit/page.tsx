'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SideNav from '../../../ui/dashboard/sidenav'
import Header from '../../../ui/dashboard/header'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { assignmentDisplay } from '@/lib/document-assignment-display'
import RichTextEditor from '../../../../components/ui/RichTextEditor'

const escapeHtmlText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Row = { inspection_item_id: number | null; sensor_id: number | null; parameter: string; hasil: string }

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/30'

export default function EditLetterPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const letterId = params?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [letter, setLetter] = useState<any>(null)

  const [inspectionDate, setInspectionDate] = useState('')
  const [inspectionPlace, setInspectionPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [rows, setRows] = useState<Row[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [includedSensorIds, setIncludedSensorIds] = useState<number[] | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        if (!letterId) throw new Error('Missing id')
        const lRes = await fetch(`/api/letters/${letterId}`)
        const l = await lRes.json()
        if (!lRes.ok) throw new Error(l?.error || 'Gagal memuat surat')
        setLetter(l)

        setInspectionDate(l.inspection_date || '')
        setInspectionPlace(l.inspection_place || '')
        setNotes(l.notes || '')
        setStatus(l.status || 'draft')
        setIncludedSensorIds(
          Array.isArray(l.included_sensor_ids) ? l.included_sensor_ids.map(Number) : null,
        )
        // Hasil lama tersimpan per baris (parameter + hasil); hasil baru berupa satu
        // blok rich text per sensor. Satukan jadi satu baris HTML per sensor.
        const rawResults = Array.isArray(l.results) ? l.results : []
        const bySensor = new Map<string, any[]>()
        for (const r of rawResults) {
          const key = r.sensor_id == null ? 'null' : String(r.sensor_id)
          if (!bySensor.has(key)) bySensor.set(key, [])
          bySensor.get(key)!.push(r)
        }
        setRows(
          Array.from(bySensor.entries()).map(([key, list]) => ({
            inspection_item_id: list[0]?.inspection_item_id ?? null,
            sensor_id: key === 'null' ? null : Number(key),
            parameter: '',
            hasil: list
              .map((r: any) => {
                if (r.parameter) {
                  const hasilText = r.hasil ? `: ${escapeHtmlText(String(r.hasil))}` : ''
                  return `<p><strong>${escapeHtmlText(String(r.parameter))}</strong>${hasilText}</p>`
                }
                return r.hasil || ''
              })
              .join(''),
          })),
        )
        if (l.instrument) {
          const sensorRes = await fetch(`/api/instruments/${l.instrument}/sensors`)
          if (sensorRes.ok) {
            const sensorData = await sensorRes.json()
            const list = Array.isArray(sensorData) ? sensorData : (sensorData?.data ?? [])
            setSensors(
              list.map((sensor: any) => ({
                id: Number(sensor.id),
                name: sensor.nama_sensor ?? sensor.name ?? null,
                manufacturer: sensor.merk_sensor ?? sensor.manufacturer ?? null,
                type: sensor.tipe_sensor ?? sensor.type ?? null,
                serial_number: sensor.serial_number_sensor ?? sensor.serial_number ?? null,
              })),
            )
          }
        }
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [letterId])

  const getSensorHtml = (sensorId: number | null) =>
    rows.find((row) => (row.sensor_id ?? null) === sensorId)?.hasil || ''
  const setSensorHtml = (sensorId: number | null, html: string) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => (row.sensor_id ?? null) === sensorId)
      if (index === -1) {
        return [...prev, { inspection_item_id: null, sensor_id: sensorId, parameter: '', hasil: html }]
      }
      return prev.map((row, i) => (i === index ? { ...row, hasil: html } : row))
    })
  }
  const removeSensor = (sensorId: number) => {
    setSensors((prev) => prev.filter((sensor) => Number(sensor.id) !== sensorId))
    setRows((prev) => prev.filter((row) => Number(row.sensor_id) !== sensorId))
    // Catat sensor yang dipakai agar penghapusan tetap tersimpan setelah reload.
    setIncludedSensorIds((prev) => {
      const base = prev ?? sensors.map((sensor) => Number(sensor.id))
      return base.filter((id) => Number(id) !== Number(sensorId))
    })
  }

  // Satu lembar per sensor. Sensor instrumen selalu tampil; sensor yang tidak
  // lagi ada di daftar instrumen tetap ditampilkan bila masih punya baris hasil,
  // supaya data lama tidak hilang. Baris tanpa sensor masuk grup "Tanpa Sensor".
  const sheetGroups = useMemo(() => {
    const groups: Array<{
      key: string
      sensorId: number | null
      title: string
      subtitle: string
      removable: boolean
      rows: Array<{ row: Row; index: number }>
    }> = []

    // Hanya tampilkan sensor yang tercatat dipakai (bila sudah diatur); NULL =
    // semua sensor instrumen (perilaku lama).
    const effectiveSensors = includedSensorIds
      ? sensors.filter((sensor: any) => includedSensorIds.includes(Number(sensor.id)))
      : sensors

    for (const sensor of effectiveSensors) {
      groups.push({
        key: `sensor-${sensor.id}`,
        sensorId: Number(sensor.id),
        title: sensor.name || `Sensor #${sensor.id}`,
        subtitle: [sensor.manufacturer, sensor.type, sensor.serial_number].filter(Boolean).join(' • '),
        removable: true,
        rows: [],
      })
    }

    const knownIds = new Set(effectiveSensors.map((sensor: any) => Number(sensor.id)))
    const extraIds = Array.from(
      new Set(
        rows
          .map((row) => row.sensor_id)
          .filter((value): value is number => value != null && !knownIds.has(Number(value))),
      ),
    )
    for (const id of extraIds) {
      groups.push({
        key: `sensor-${id}`,
        sensorId: Number(id),
        title: `Sensor #${id}`,
        subtitle: 'Sensor tidak lagi terdaftar pada instrumen',
        removable: true,
        rows: [],
      })
    }

    groups.push({ key: 'unassigned', sensorId: null, title: 'Tanpa Sensor', subtitle: '', removable: false, rows: [] })

    rows.forEach((row, index) => {
      const sensorId = row.sensor_id == null ? null : Number(row.sensor_id)
      const target = groups.find((group) => group.sensorId === sensorId)
      ;(target || groups[groups.length - 1]).rows.push({ row, index })
    })

    return groups.filter((group) =>
      group.sensorId === null
        ? group.rows.length > 0 || sensors.length === 0
        : group.rows.length > 0 || sensors.some((sensor: any) => Number(sensor.id) === group.sensorId),
    )
  }, [sensors, rows, includedSensorIds])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/letters/${letterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_date: inspectionDate || null,
          inspection_place: inspectionPlace || null,
          notes: notes || null,
          status,
          included_sensor_ids:
            includedSensorIds ?? sensors.map((sensor) => Number(sensor.id)),
          results: rows.map((r, i) => ({
            inspection_item_id: r.inspection_item_id,
            sensor_id: r.sensor_id,
            parameter: r.parameter,
            hasil: r.hasil || null,
            sort_order: i,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan surat')
      router.push(`/letters/${letterId}/view`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          {loading ? (
            <div className="p-6 text-gray-600">Loading...</div>
          ) : error && !letter ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : (
            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="sticky top-0 z-30 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <div>
                  <div className="text-lg font-bold text-blue-950">Edit Surat Keterangan</div>
                  <div className="text-xs text-blue-700">
                    {letter?.no_letter || '-'} • Order {letter?.no_order || '-'} • Identifikasi {letter?.no_identification || '-'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90 disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-bold text-gray-800">
                  Detail Pemeriksaan
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Tanggal Pemeriksaan
                    <input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Tempat Pemeriksaan
                    <input value={inspectionPlace} onChange={(e) => setInspectionPlace(e.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Status
                    <input readOnly value={letter?.results_frozen_at ? 'Dibekukan (terkirim ke verifikator)' : 'draft'} className={`${inputClass} bg-gray-50 text-gray-700`} />
                  </label>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-2 text-sm font-bold text-gray-800">Penugasan Dokumen</div>
                  {(() => {
                    const assignment = assignmentDisplay(letter?.document_assignment)
                    return (
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <div><span className="font-semibold">Diperiksa:</span> {assignment.checkedBy.map((p: any) => p?.name).filter(Boolean).join(', ') || '-'}</div>
                        <div><span className="font-semibold">Diverifikasi:</span> {assignment.verifiedBy.map((p: any) => p?.name).filter(Boolean).join(', ') || '-'}</div>
                        <div><span className="font-semibold">Pengesahan:</span> {assignment.authorized?.name || '-'}</div>
                      </div>
                    )
                  })()}
                  <div className="mt-2 text-xs text-gray-600">
                    Penugasan diatur satu kali dari Order Kalibrasi dan digunakan bersama oleh Surat serta Sertifikat.
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="mb-4 border-b border-gray-100 pb-2">
                  <h3 className="text-base font-bold text-gray-800">Hasil Pemeriksaan</h3>
                  <div className="text-xs text-gray-500">Satu blok rich text per sensor; sensor yang tidak diperiksa bisa dihapus.</div>
                </div>
                {sheetGroups.length === 0 ? (
                  <div className="text-sm text-gray-500">Belum ada sensor.</div>
                ) : (
                  <div className="space-y-4">
                    {sheetGroups.map((group) => (
                      <div key={group.key} className="overflow-hidden rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                          <div>
                            <div className="text-sm font-bold text-gray-800">{group.title}</div>
                            {group.subtitle ? (
                              <div className="text-xs text-gray-500">{group.subtitle}</div>
                            ) : null}
                          </div>
                          {group.removable && group.sensorId != null && (
                            <button
                              type="button"
                              onClick={() => removeSensor(group.sensorId as number)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Hapus sensor
                            </button>
                          )}
                        </div>
                        <div className="p-3">
                          <RichTextEditor
                            value={getSensorHtml(group.sensorId)}
                            onChange={(html) => setSensorHtml(group.sensorId, html)}
                            minHeightClassName="min-h-[120px]"
                            placeholder="Tulis hasil pemeriksaan sensor ini..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className="mt-4 block text-xs font-semibold text-gray-600">
                  Catatan
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
                </label>
              </div>
            </form>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
