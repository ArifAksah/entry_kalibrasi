'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SideNav from '../../ui/dashboard/sidenav'
import Header from '../../ui/dashboard/header'
import ProtectedRoute from '../../../components/ProtectedRoute'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'

type Row = { inspection_item_id: number | null; sensor_id: number | null; parameter: string; hasil: string }

type SensorOption = {
  id: number
  name?: string | null
  manufacturer?: string | null
  type?: string | null
  serial_number?: string | null
}

type OrderItemOption = {
  id: number
  order_id: number
  no_order: string
  no_identification: string
  calibration_place: 'FC' | 'IFC' | 'LC'
  instrument_id: number
  instrument_code: string
  instrument_name_id: number | null
  instrument_name: string
  manufacturer: string | null
  serial_number: string | null
  station_name: string | null
  letter: { id: number; no_letter: string | null; status: string } | null
}

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/30'

export default function NewLetterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItemOption[]>([])
  const [orderItemId, setOrderItemId] = useState<number | null>(null)
  const [issueDate, setIssueDate] = useState('')
  const [inspectionDate, setInspectionDate] = useState('')
  const [inspectionPlace, setInspectionPlace] = useState('')
  const [referenceDocument, setReferenceDocument] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [sensors, setSensors] = useState<SensorOption[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/letter-order-items')
        const json = await response.json()
        if (!response.ok) throw new Error(json?.error || 'Gagal memuat order kalibrasi')
        const items = Array.isArray(json?.data) ? json.data : []
        setOrderItems(items)

        const itemFromUrl = Number(new URLSearchParams(window.location.search).get('item'))
        if (Number.isInteger(itemFromUrl) && items.some((item: OrderItemOption) => item.id === itemFromUrl)) {
          await selectOrderItem(itemFromUrl, items)
        }
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const selectedItem = useMemo(
    () => orderItems.find((item) => item.id === orderItemId) || null,
    [orderItems, orderItemId],
  )

  const selectableItems = useMemo(
    () => orderItems.filter((item) => !item.letter),
    [orderItems],
  )

  const selectOrderItem = async (id: number, source = orderItems) => {
    setOrderItemId(id)
    const item = source.find((row) => row.id === id)
    if (!item) return
    setInspectionPlace((current) => current || item.station_name || '')
    setRows([])
    // Satu lembar pemeriksaan per sensor instrumen (mis. AWOS punya banyak sensor).
    setSensors([])
    if (!item.instrument_id) return
    try {
      const response = await fetch(`/api/instruments/${item.instrument_id}/sensors`)
      const json = await response.json()
      const list = Array.isArray(json) ? json : (json?.data ?? [])
      setSensors(
        list.map((sensor: any) => ({
          id: Number(sensor.id),
          name: sensor.nama_sensor ?? sensor.name ?? null,
          manufacturer: sensor.merk_sensor ?? sensor.manufacturer ?? null,
          type: sensor.tipe_sensor ?? sensor.type ?? null,
          serial_number: sensor.serial_number_sensor ?? sensor.serial_number ?? null,
        })),
      )
    } catch {
      setSensors([])
    }
  }

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  const addRow = (sensorId: number | null = null) =>
    setRows((current) => [...current, { inspection_item_id: null, sensor_id: sensorId, parameter: '', hasil: '' }])
  const removeRow = (index: number) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
  const removeSensor = (sensorId: number) => {
    setSensors((current) => current.filter((sensor) => sensor.id !== sensorId))
    setRows((current) => current.filter((row) => row.sensor_id !== sensorId))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!orderItemId) {
      setError('Pilih nomor order dan identifikasi terlebih dahulu')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calibration_order_item_id: orderItemId,
          issue_date: issueDate || null,
          inspection_date: inspectionDate || null,
          inspection_place: inspectionPlace || null,
          reference_document: referenceDocument || null,
          notes: notes || null,
          results: rows.map((row, index) => ({
            inspection_item_id: row.inspection_item_id,
            sensor_id: row.sensor_id,
            parameter: row.parameter,
            hasil: row.hasil || null,
            sort_order: index,
          })),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menyimpan Surat Keterangan')
      router.push(`/letters/${json.id}/view`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menyimpan Surat Keterangan')
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <form onSubmit={submit} className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div>
                <div className="text-lg font-bold text-blue-950">Buat Surat Keterangan</div>
                <div className="text-xs text-blue-700">
                  Surat dapat dibuat setelah nomor order dan identifikasi tersedia.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => router.push('/letters')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={saving || !orderItemId} className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-bold text-gray-800">Sumber &amp; Identitas</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-xs font-semibold text-gray-600 md:col-span-3">
                  Order / Identifikasi
                  <SearchableDropdown
                    value={orderItemId}
                    onChange={(value) => {
                      if (value != null && value !== '') selectOrderItem(Number(value))
                    }}
                    options={selectableItems.map((item) => ({
                      id: item.id,
                      name: `${item.no_identification} • ${item.instrument_name}`,
                      description: `${item.calibration_place} • ${item.station_name || '-'} • ${item.instrument_code}`,
                    }))}
                    placeholder={loading ? 'Memuat order...' : '— pilih order / identifikasi —'}
                    searchPlaceholder="Cari order, identifikasi, alat, atau stasiun..."
                    emptyLabel="Tidak ada identifikasi yang dapat dibuatkan Surat"
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  No. Order
                  <input value={selectedItem?.no_order || '-'} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  No. Identifikasi
                  <input value={selectedItem?.no_identification || '-'} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Instrumen
                  <input value={selectedItem?.instrument_name || '-'} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-bold text-gray-800">Detail Pemeriksaan</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-600">
                  Tanggal Pemeriksaan
                  <input type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Tempat Pemeriksaan
                  <input value={inspectionPlace} onChange={(event) => setInspectionPlace(event.target.value)} placeholder="Stasiun / lokasi" className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Tanggal Terbit
                  <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Dokumen Acuan
                  <input value={referenceDocument} onChange={(event) => setReferenceDocument(event.target.value)} placeholder="SOP ..." className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600 md:col-span-2">
                  Catatan
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={inputClass} />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-base font-bold text-gray-800">Hasil Pemeriksaan</h3>
                {sensors.length === 0 && (
                  <button type="button" onClick={() => addRow(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">+ Baris</button>
                )}
              </div>

              {sensors.length > 0 ? (
                <div className="space-y-4">
                  {sensors.map((sensor) => {
                    const indexed = rows
                      .map((row, index) => ({ row, index }))
                      .filter(({ row }) => row.sensor_id === sensor.id)
                    return (
                      <div key={sensor.id} className="overflow-hidden rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                          <div>
                            <div className="text-sm font-bold text-gray-800">{sensor.name || `Sensor #${sensor.id}`}</div>
                            <div className="text-xs text-gray-500">
                              {sensor.manufacturer || '-'} • {sensor.type || '-'} / {sensor.serial_number || '-'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => addRow(sensor.id)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-gray-50">+ Baris</button>
                            <button type="button" onClick={() => removeSensor(sensor.id)} className="text-xs text-red-600 hover:underline">Hapus sensor</button>
                          </div>
                        </div>
                        {indexed.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-gray-500">Belum ada parameter untuk sensor ini.</div>
                        ) : (
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                              <tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Hasil</th><th className="w-16 px-3 py-2" /></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {indexed.map(({ row, index }) => (
                                <tr key={index}>
                                  <td className="px-3 py-2"><input value={row.parameter} onChange={(event) => setRow(index, { parameter: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></td>
                                  <td className="px-3 py-2"><input value={row.hasil} onChange={(event) => setRow(index, { hasil: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></td>
                                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeRow(index)} className="text-xs text-red-600 hover:underline">Hapus</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-gray-500">Belum ada baris pemeriksaan. Tambahkan dengan tombol + Baris.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Hasil</th><th className="w-16 px-3 py-2" /></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2"><input value={row.parameter} onChange={(event) => setRow(index, { parameter: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></td>
                          <td className="px-3 py-2"><input value={row.hasil} onChange={(event) => setRow(index, { hasil: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></td>
                          <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeRow(index)} className="text-xs text-red-600 hover:underline">Hapus</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
