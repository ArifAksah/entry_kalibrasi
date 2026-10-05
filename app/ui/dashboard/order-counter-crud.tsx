'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Loading'

interface CounterRow {
  numbering_year: number
  calibration_place: 'FC' | 'IFC' | 'LC'
  last_value: number
  next_order_number: string
  max_used: number
  updated_at: string
}

interface CounterLog {
  id: number
  numbering_year: number
  calibration_place: string
  previous_value: number | null
  new_value: number | null
  action: string
  reason: string | null
  performed_at: string
}

const OrderCounterCRUD: React.FC = () => {
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [counters, setCounters] = useState<CounterRow[]>([])
  const [logs, setLogs] = useState<CounterLog[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    numbering_year: String(new Date().getFullYear()),
    calibration_place: 'FC',
    mode: 'set_next_value',
    value: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, lRes] = await Promise.all([
        fetch('/api/admin/calibration-order-counter'),
        fetch('/api/admin/calibration-order-counter/logs?limit=30'),
      ])
      const cJson = await cRes.json()
      const lJson = await lRes.json()
      if (!cRes.ok) throw new Error(cJson.error || 'Gagal memuat counter')
      setCounters(cJson.data || [])
      setLogs(lJson.data || [])
    } catch (e: any) {
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const submit = async () => {
    if (form.mode !== 'reset_unused_scope' && !form.reason) {
      return showError('Alasan wajib diisi untuk mode ini')
    }
    if (form.mode === 'set_next_value' && !form.value) {
      return showError('Nilai berikutnya wajib diisi')
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/calibration-order-counter/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbering_year: Number(form.numbering_year),
          calibration_place: form.calibration_place,
          mode: form.mode,
          value: form.value ? Number(form.value) : null,
          reason: form.reason || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Reset gagal')
      showSuccess(`Counter ${form.calibration_place} ${form.numbering_year} → berikutnya ${json.data?.next_order_number}`)
      setForm({ ...form, value: '', reason: '' })
      fetchAll()
    } catch (e: any) {
      showError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {alert.show ? (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      ) : null}

      {/* Counters */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
          Counter Nomor Order
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Tahun</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Terakhir</th>
              <th className="px-4 py-3">Berikutnya</th>
              <th className="px-4 py-3">Max Terpakai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><Spinner /></td></tr>
            ) : counters.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada counter</td></tr>
            ) : (
              counters.map((c) => (
                <tr key={`${c.numbering_year}-${c.calibration_place}`}>
                  <td className="px-4 py-3">{c.numbering_year}</td>
                  <td className="px-4 py-3">{c.calibration_place}</td>
                  <td className="px-4 py-3 font-mono">{c.last_value}</td>
                  <td className="px-4 py-3 font-mono font-bold text-[#1e377c]">{c.next_order_number}</td>
                  <td className="px-4 py-3 font-mono">{c.max_used}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reset form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Hard Reset / Repair Counter</h3>
        <p className="mb-4 text-xs text-gray-500">
          Reset ke awal hanya boleh pada scope yang belum pernah memiliki nomor. Menurunkan counter
          di bawah nomor terpakai akan ditolak sistem.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600">Tahun</label>
            <input
              type="number"
              value={form.numbering_year}
              onChange={(e) => setForm({ ...form, numbering_year: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Jenis</label>
            <select
              value={form.calibration_place}
              onChange={(e) => setForm({ ...form, calibration_place: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="FC">FC</option>
              <option value="IFC">IFC</option>
              <option value="LC">LC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Mode</label>
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="set_next_value">Set Nomor Berikutnya</option>
              <option value="reset_unused_scope">Reset Scope Kosong</option>
              <option value="skip_range">Lewati Sejumlah Nomor</option>
            </select>
          </div>
          {form.mode !== 'reset_unused_scope' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600">
                {form.mode === 'set_next_value' ? 'Nomor Berikutnya' : 'Jumlah Dilewati'}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600">Alasan</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Alasan reset/repair"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {submitting ? 'Memproses...' : 'Jalankan Reset'}
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
          Riwayat Reset
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Dari</th>
              <th className="px-4 py-3">Ke</th>
              <th className="px-4 py-3">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Belum ada riwayat</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs">{new Date(l.performed_at).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3">{l.numbering_year} / {l.calibration_place}</td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3 font-mono">{l.previous_value ?? '-'}</td>
                  <td className="px-4 py-3 font-mono">{l.new_value ?? '-'}</td>
                  <td className="px-4 py-3 text-xs">{l.reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OrderCounterCRUD
