'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Loading'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'
import type {
  CalibrationOrder,
  CalibrationOrderItem,
  CalibrationOrderStatus,
} from '../../../lib/supabase'

interface StationOption {
  id: number
  name: string
}

interface PersonelOption {
  id: string
  name: string
  role?: string | null
}

interface InstrumentOption {
  id: number
  station_id: number | null
  station?: { id: number; name: string } | null
  name_alias?: string | null
  manufacturer?: string | null
  type?: string | null
  serial_number?: string | null
  instrument_code_id?: number | null
}

async function fetchAllUutInstruments(): Promise<InstrumentOption[]> {
  const rows: InstrumentOption[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `/api/instruments?type=uut&pageSize=100&page=${page}`,
    )
    if (!response.ok) throw new Error('Gagal memuat daftar alat UUT')
    const json = await response.json()
    rows.push(...(Array.isArray(json) ? json : json?.data || []))
    totalPages = Math.max(1, Number(json?.totalPages) || 1)
    page += 1
  } while (page <= totalPages)

  return Array.from(
    new Map(rows.map((instrument) => [instrument.id, instrument])).values(),
  )
}

interface OrderDetail extends CalibrationOrder {
  personnel: Array<{ id: number; personel_id: string; personel?: { name?: string; nip?: string } | null }>
  items: Array<CalibrationOrderItem & { certificate?: { id: number; no_certificate: string; status?: string } | null }>
  schedule_history: Array<{ id: number; old_planned_date: string | null; new_planned_date: string | null; old_planned_end_date: string | null; new_planned_end_date: string | null; reason: string | null; changed_at: string }>
}

const STATUS_LABEL: Record<CalibrationOrderStatus, string> = {
  draft: 'Draf',
  booked: 'Dipesan',
  postponed: 'Ditunda',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const ITEM_STATUS_LABEL: Record<string, string> = {
  identified: 'Teridentifikasi',
  certificate_draft: 'Draf Sertifikat',
  completed: 'Selesai',
  void: 'Tidak Dipakai',
}

const STATUS_COLOR: Record<CalibrationOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  booked: 'bg-blue-100 text-blue-800',
  postponed: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
}

const CalibrationOrdersCRUD: React.FC = () => {
  const router = useRouter()
  const { role } = usePermissions()
  const { alert, showSuccess, showError, hideAlert } = useAlert()

  const [orders, setOrders] = useState<CalibrationOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [stations, setStations] = useState<StationOption[]>([])
  const [personel, setPersonel] = useState<PersonelOption[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [instrumentCodes, setInstrumentCodes] = useState<Array<{ id: number; code_alat: string | null }>>([])

  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()))
  const [filterPlace, setFilterPlace] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [personnelPickerId, setPersonnelPickerId] = useState<string | number | null>(null)
  const [form, setForm] = useState({
    station_id: '',
    planned_date: '',
    planned_end_date: '',
    calibration_place: 'FC',
    notes: '',
    personnel_ids: [] as string[],
  })

  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null)

  // Modal konfirmasi in-app (menggantikan window.prompt/confirm)
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    fields: Array<{ key: string; label: string; type: 'text' | 'date'; defaultValue?: string; required?: boolean; placeholder?: string }>
    confirmLabel: string
    confirmColor: string
    onConfirm: (values: Record<string, string>) => void
  } | null>(null)
  const [confirmModalValues, setConfirmModalValues] = useState<Record<string, string>>({})

  const canManage = role === 'admin' || role === 'calibrator'
  const canCreate = role === 'calibrator'

  // ── Fetch master options ────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const [stRes, peRes, instrumentsAll, codeRes] = await Promise.all([
          fetch('/api/stations/all'),
          fetch('/api/personel'),
          fetchAllUutInstruments(),
          fetch('/api/instrument-code'),
        ])
        const stJson = await stRes.json()
        const peJson = await peRes.json()
        const codeJson = await codeRes.json()
        const stList = Array.isArray(stJson) ? stJson : stJson?.data || []
        const peList = Array.isArray(peJson) ? peJson : peJson?.data || []
        setStations(stList.map((s: any) => ({ id: s.id, name: s.name })))
        setPersonel(
          peList
            .filter((p: any) => !p.deleted_at && p.role === 'calibrator')
            .map((p: any) => ({ id: p.id, name: p.name, role: p.role })),
        )
        setInstruments(instrumentsAll)
        setInstrumentCodes(Array.isArray(codeJson) ? codeJson : codeJson?.data || [])
      } catch {
        /* ignore */
      }
    })()
  }, [])

  // ── Fetch orders ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterYear) params.set('year', filterYear)
      if (filterPlace) params.set('place', filterPlace)
      if (filterStatus) params.set('status', filterStatus)
      params.set('pageSize', '100')
      const res = await fetch(`/api/calibration-orders?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal memuat order')
      const json = await res.json()
      setOrders(json.data || [])
    } catch (e: any) {
      showError(e.message || 'Gagal memuat order')
    } finally {
      setLoading(false)
    }
  }, [filterYear, filterPlace, filterStatus, showError])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // ── Buat Draf Order ──────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({
      station_id: '',
      planned_date: '',
      planned_end_date: '',
      calibration_place: 'FC',
      notes: '',
      personnel_ids: [],
    })
    setPersonnelPickerId(null)
    setIsModalOpen(true)
  }

  const submitCreate = async () => {
    if (!form.station_id) return showError('Stasiun wajib dipilih')
    if (!form.planned_date || !form.planned_end_date) {
      return showError('Tanggal mulai dan selesai wajib diisi')
    }
    if (form.planned_end_date < form.planned_date) {
      return showError('Tanggal selesai tidak boleh sebelum tanggal mulai')
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/calibration-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: Number(form.station_id),
          planned_date: form.planned_date,
          planned_end_date: form.planned_end_date,
          calibration_place: form.calibration_place,
          notes: form.notes || null,
          personnel_ids: form.personnel_ids,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal membuat order')
      showSuccess('Draf order berhasil disimpan. Konfirmasi pemesanan untuk mendapatkan nomor order.')
      setIsModalOpen(false)
      fetchOrders()
    } catch (e: any) {
      showError(e.message || 'Gagal membuat order')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Detail ──────────────────────────────────────────────────────────────
  const openDetail = async (order: CalibrationOrder) => {
    setDetailLoading(true)
    setDetail({ ...order } as OrderDetail)
    try {
      const res = await fetch(`/api/calibration-orders/${order.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat detail')
      setDetail(json.data)
    } catch (e: any) {
      showError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async (orderId: number) => {
    const res = await fetch(`/api/calibration-orders/${orderId}`)
    const json = await res.json()
    if (res.ok) setDetail(json.data)
  }

  const runAction = async (action: string, extra: Record<string, any> = {}) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/calibration-orders/${detail.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Aksi gagal')
      showSuccess('Berhasil')
      await refreshDetail(detail.id)
      fetchOrders()
    } catch (e: any) {
      showError(e.message)
    }
  }

  const addItem = async (instrumentId: number | null, instrumentCode: string | null) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/calibration-orders/${detail.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrument_id: instrumentId, instrument_code: instrumentCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menambah item')
      showSuccess(`Identifikasi ${json.data?.no_identification} dibuat`)
      setSelectedInstrumentId(null)
      await refreshDetail(detail.id)
    } catch (e: any) {
      showError(e.message)
    }
  }

  const voidItem = (itemId: number) => {
    setConfirmModalValues({ reason: '' })
    setConfirmModal({
      title: 'Tandai Tidak Dipakai',
      message: 'Item identifikasi ini akan ditandai tidak digunakan. Nomor tetap tercatat.',
      fields: [{ key: 'reason', label: 'Alasan', type: 'text', required: true, placeholder: 'Alasan pembatalan item...' }],
      confirmLabel: 'Tandai Tidak Dipakai',
      confirmColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async (values) => {
        try {
          const res = await fetch(`/api/calibration-order-items/${itemId}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: values.reason }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Gagal membatalkan item')
          showSuccess('Item ditandai tidak dipakai')
          if (detail) await refreshDetail(detail.id)
        } catch (e: any) {
          showError(e.message)
        } finally {
          setConfirmModal(null)
        }
      },
    })
  }

  const stationName = (id: number) => stations.find((s) => s.id === id)?.name || `Station #${id}`

  return (
    <div className="space-y-4">
      {alert.show ? (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600">Tahun</label>
          <input
            type="number"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Jenis</label>
          <select
            value={filterPlace}
            onChange={(e) => setFilterPlace(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua</option>
            <option value="FC">FC</option>
            <option value="IFC">IFC</option>
            <option value="LC">LC</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchOrders}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Muat Ulang
        </button>
        {canCreate && (
          <button
            onClick={openCreate}
            className="ml-auto rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90"
          >
            + Buat Draf Order
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">No. Order</th>
              <th className="px-4 py-3">Stasiun</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Tanggal Rencana</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center"><Spinner /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Belum ada order</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold">{o.no_order || 'Belum dialokasikan'}</td>
                  <td className="px-4 py-3">{stationName(o.station_id)}</td>
                  <td className="px-4 py-3">{o.calibration_place}</td>
                  <td className="px-4 py-3">
                    {o.planned_date === o.planned_end_date
                      ? o.planned_date
                      : `${o.planned_date} s.d. ${o.planned_end_date}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetail(o)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-6 py-5 text-white">
              <h3 className="text-xl font-bold">Draf Order Kalibrasi</h3>
              <p className="mt-1 text-sm text-blue-100">
                Draf belum mengonsumsi nomor. Nomor dialokasikan permanen saat pemesanan dikonfirmasi.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Stasiun</label>
                <SearchableDropdown
                  value={form.station_id || null}
                  onChange={(value) => setForm({ ...form, station_id: value == null ? '' : String(value) })}
                  options={stations.map((station) => ({
                    id: station.id,
                    name: station.name,
                  }))}
                  placeholder="Pilih stasiun..."
                  searchPlaceholder="Cari nama stasiun..."
                  emptyLabel="Stasiun tidak ditemukan"
                />
              </div>
              <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={form.planned_date}
                    onChange={(e) => setForm({ ...form, planned_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
              </div>
              <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tanggal Selesai</label>
                  <input
                    type="date"
                    min={form.planned_date || undefined}
                    value={form.planned_end_date}
                    onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
              </div>
              <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Jenis Kegiatan</label>
                  <select
                    value={form.calibration_place}
                    onChange={(e) => setForm({ ...form, calibration_place: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="FC">FC — Lapang Eksternal (via PTSP)</option>
                    <option value="IFC">IFC — Lapang Internal BMKG</option>
                    <option value="LC">LC — Laboratorium</option>
                  </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Petugas Kalibrasi</label>
                <SearchableDropdown
                  value={personnelPickerId}
                  onChange={(value) => {
                    if (value != null) {
                      const id = String(value)
                      if (!form.personnel_ids.includes(id)) {
                        setForm((current) => ({
                          ...current,
                          personnel_ids: [...current.personnel_ids, id],
                        }))
                      }
                    }
                    setPersonnelPickerId(null)
                  }}
                  options={personel
                    .filter((person) => !form.personnel_ids.includes(person.id))
                    .map((person) => ({ id: person.id, name: person.name }))}
                  placeholder="Cari dan tambahkan petugas..."
                  searchPlaceholder="Cari nama petugas..."
                  emptyLabel="Semua petugas sudah dipilih atau data tidak ditemukan"
                />
                <div className="mt-3 flex min-h-10 flex-wrap gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2.5">
                  {form.personnel_ids.length === 0 ? (
                    <span className="text-xs text-gray-400">Belum ada petugas tambahan. Pembuat draft otomatis menjadi petugas.</span>
                  ) : (
                    form.personnel_ids.map((personId) => {
                      const person = personel.find((row) => row.id === personId)
                      return (
                        <span key={personId} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                          {person?.name || personId}
                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                personnel_ids: current.personnel_ids.filter((id) => id !== personId),
                              }))
                            }
                            className="text-blue-600 hover:text-rose-600"
                            aria-label={`Hapus ${person?.name || personId}`}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Catatan rencana kegiatan, kebutuhan khusus, atau informasi lapangan..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={submitCreate}
                disabled={submitting}
                className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Draf'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/50 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Order {detail.no_order || '(Draf)'}</h3>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[detail.status]}`}>
                  {STATUS_LABEL[detail.status]}
                </span>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-2 text-xl hover:bg-gray-100">×</button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {detailLoading && <div className="text-center"><Spinner /></div>}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Stasiun:</span> <b>{stationName(detail.station_id)}</b></div>
                <div><span className="text-gray-500">Jenis:</span> <b>{detail.calibration_place}</b></div>
                <div>
                  <span className="text-gray-500">Tanggal Rencana:</span>{' '}
                  <b>
                    {detail.planned_date === detail.planned_end_date
                      ? detail.planned_date
                      : `${detail.planned_date} s.d. ${detail.planned_end_date}`}
                  </b>
                </div>
                <div><span className="text-gray-500">Tahun:</span> <b>{detail.numbering_year}</b></div>
              </div>

              {/* Tim Order — petugas yang ditugaskan. Mereka berbagi akses
                  (lihat/edit draft) pada sertifikat milik order ini. */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tim Order
                </div>
                {detail.personnel && detail.personnel.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.personnel.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {p.personel?.name || p.personel_id}
                        {p.personel?.nip ? (
                          <span className="text-slate-400">({p.personel.nip})</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs italic text-slate-400">
                    Belum ada petugas tambahan (pembuat order otomatis menjadi petugas).
                  </div>
                )}
              </div>

              {detail.notes && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <span className="text-gray-500">Catatan:</span> {detail.notes}
                </div>
              )}

              {/* Lifecycle actions */}
              <div className="flex flex-wrap gap-2 border-y border-gray-100 py-3">
                {detail.status === 'draft' && role === 'calibrator' && (
                  <button onClick={() => runAction('confirm')} className="rounded-lg bg-[#1e377c] px-3 py-1.5 text-xs font-semibold text-white">Konfirmasi Booking</button>
                )}
                {detail.status === 'booked' && (
                  <button onClick={() => runAction('start')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Mulai Kegiatan</button>
                )}
                {['booked', 'postponed'].includes(detail.status) && (
                  <button
                    onClick={() => {
                      setConfirmModalValues({
                        start: detail.planned_date,
                        end: detail.planned_end_date,
                        reason: '',
                      })
                      setConfirmModal({
                        title: 'Tunda Kegiatan',
                        message: 'Perubahan tanggal rencana akan tercatat dalam histori.',
                        fields: [
                          { key: 'start', label: 'Tanggal Mulai', type: 'date', required: true },
                          { key: 'end', label: 'Tanggal Selesai', type: 'date', required: true },
                          { key: 'reason', label: 'Alasan', type: 'text', placeholder: 'Alasan penundaan...' },
                        ],
                        confirmLabel: 'Tunda',
                        confirmColor: 'bg-amber-500 hover:bg-amber-600',
                        onConfirm: (values) => {
                          runAction('postpone', {
                            planned_date: values.start,
                            planned_end_date: values.end,
                            reason: values.reason || 'Penundaan kegiatan',
                          })
                          setConfirmModal(null)
                        },
                      })
                    }}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Tunda
                  </button>
                )}
                {detail.status === 'postponed' && (
                  <button onClick={() => runAction('resume')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Lanjutkan</button>
                )}
                {detail.status === 'in_progress' && (
                  <button onClick={() => runAction('complete')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Selesaikan</button>
                )}
                {!['cancelled', 'completed'].includes(detail.status) && (
                  <button
                    onClick={() => {
                      setConfirmModalValues({ reason: '' })
                      setConfirmModal({
                        title: 'Batalkan Order',
                        message: 'Order akan dibatalkan permanen. Nomor tidak akan digunakan ulang.',
                        fields: [{ key: 'reason', label: 'Alasan Pembatalan', type: 'text', required: true, placeholder: 'Alasan pembatalan order...' }],
                        confirmLabel: 'Batalkan Order',
                        confirmColor: 'bg-rose-600 hover:bg-rose-700',
                        onConfirm: (values) => {
                          runAction('cancel', { reason: values.reason })
                          setConfirmModal(null)
                        },
                      })
                    }}
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Batalkan Order
                  </button>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-bold text-gray-800">Alat / Identifikasi</h4>
                </div>
                {canManage && ['booked', 'postponed', 'in_progress'].includes(detail.status) && (
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <SearchableDropdown
                        value={selectedInstrumentId}
                        onChange={(value) => setSelectedInstrumentId(value as number | null)}
                        options={instruments.map((instrument) => {
                          const instrumentStationId =
                            instrument.station_id ?? instrument.station?.id ?? null
                          const available =
                            Number(instrumentStationId) === Number(detail.station_id)
                          const serial = instrument.serial_number
                            ? `SN ${instrument.serial_number}`
                            : 'SN -'
                          const stationInfo = available
                            ? instrument.station?.name || 'Station sesuai order'
                            : instrumentStationId == null
                              ? 'Belum ditautkan ke station — tidak dapat dipilih'
                              : `${instrument.station?.name || `Station #${instrumentStationId}`} — station berbeda`

                          return {
                            id: instrument.id,
                            name: instrument.name_alias || instrument.type || `Instrumen #${instrument.id}`,
                            description: `${serial} • ${stationInfo}`,
                            disabled: !available,
                          }
                        })}
                        placeholder="Pilih Alat UUT..."
                        searchPlaceholder="Cari alat UUT..."
                        emptyLabel="Tidak ada alat UUT di stasiun ini"
                        className="w-full sm:flex-1"
                      />
                      <button
                        disabled={!selectedInstrumentId}
                        onClick={() => {
                          const instrument = instruments.find((row) => row.id === selectedInstrumentId)
                          if (!instrument) return
                          const code = instrumentCodes.find((row) => row.id === instrument.instrument_code_id)?.code_alat ?? null
                          addItem(instrument.id, code)
                        }}
                        className="w-full rounded-lg bg-[#1e377c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                      >
                        + Tambah Alat UUT
                      </button>
                  </div>
                )}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Identifikasi</th>
                        <th className="px-3 py-2">Sertifikat</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.items?.length ? (
                        detail.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-3 py-2 font-mono">{it.no_identification}</td>
                            <td className="px-3 py-2">{it.certificate?.no_certificate || '-'}</td>
                            <td className="px-3 py-2">{ITEM_STATUS_LABEL[it.status] || it.status}</td>
                            <td className="px-3 py-2 text-right">
                              {it.certificate && (
                                <button
                                  onClick={() =>
                                    router.push(
                                      it.certificate?.status === 'draft'
                                        ? `/certificates?edit=${it.certificate!.id}`
                                        : `/certificates/${it.certificate!.id}/view`,
                                    )
                                  }
                                  className="mr-2 rounded border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                  {it.certificate.status === 'draft'
                                    ? 'Buka Draf Sertifikat'
                                    : 'Lihat Sertifikat'}
                                </button>
                              )}
                              {canManage &&
                                !it.certificate &&
                                it.status === 'identified' &&
                                it.instrument_id &&
                                ['booked', 'in_progress'].includes(detail.status) && (
                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/certificates?create=true&station=${detail.station_id}&order=${detail.id}&item=${it.id}`,
                                      )
                                    }
                                    className="mr-2 rounded bg-[#1e377c] px-2 py-0.5 text-xs font-semibold text-white hover:bg-[#162a60]"
                                  >
                                    Buat Sertifikat
                                  </button>
                                )}
                              {canManage && it.status === 'identified' && (
                                <button
                                  onClick={() => voidItem(it.id)}
                                  className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
                                >
                                  Tidak Dipakai
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Belum ada alat</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Schedule history */}
              {detail.schedule_history?.length > 0 && (
                <div>
                  <h4 className="mb-2 font-bold text-gray-800">Histori Jadwal</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {detail.schedule_history.map((h) => (
                      <li key={h.id} className="rounded bg-gray-50 px-3 py-2">
                        {h.old_planned_date} s.d. {h.old_planned_end_date || h.old_planned_date}
                        {' → '}
                        {h.new_planned_date} s.d. {h.new_planned_end_date || h.new_planned_date}
                        {' — '}{h.reason || '-'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi In-App */}
      {confirmModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-6 py-4 text-white">
              <h3 className="text-lg font-bold">{confirmModal.title}</h3>
              <p className="mt-1 text-sm text-blue-100">{confirmModal.message}</p>
            </div>
            <div className="space-y-4 p-6">
              {confirmModal.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  {field.type === 'date' ? (
                    <input
                      type="date"
                      value={confirmModalValues[field.key] || ''}
                      onChange={(e) => setConfirmModalValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  ) : (
                    <textarea
                      value={confirmModalValues[field.key] || ''}
                      onChange={(e) => setConfirmModalValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      rows={3}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setConfirmModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const hasEmptyRequired = confirmModal.fields.some(
                    (f) => f.required && !confirmModalValues[f.key]?.trim(),
                  )
                  if (hasEmptyRequired) return
                  confirmModal.onConfirm(confirmModalValues)
                }}
                disabled={confirmModal.fields.some(
                  (f) => f.required && !confirmModalValues[f.key]?.trim(),
                )}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalibrationOrdersCRUD
