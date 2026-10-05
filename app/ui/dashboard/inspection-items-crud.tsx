'use client'

import React, { useEffect, useState } from 'react'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'

type InspectionItem = {
  id: number
  instrument_name_id: number | null
  section: string | null
  parameter: string
  sort_order: number
  is_active: boolean
}

const emptyForm = () => ({
  instrument_name_id: '' as string | number,
  section: '',
  parameter: '',
  sort_order: 0,
  is_active: true,
})

export default function InspectionItemsCRUD() {
  const { role } = usePermissions()
  const { showError, showSuccess } = useAlert()
  const [items, setItems] = useState<InspectionItem[]>([])
  const [instrumentNames, setInstrumentNames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InspectionItem | null>(null)
  const [form, setForm] = useState(emptyForm())
  const canMutate = role === 'admin' || role === 'calibrator'

  const load = async () => {
    setLoading(true)
    try {
      const [iRes, nRes] = await Promise.all([
        fetch('/api/inspection-items'),
        fetch('/api/instrument-names'),
      ])
      const [iData, nData] = await Promise.all([iRes.json(), nRes.json()])
      if (!iRes.ok) throw new Error(iData?.error || 'Gagal memuat item pemeriksaan')
      setItems(Array.isArray(iData) ? iData : (iData?.data ?? []))
      setInstrumentNames(Array.isArray(nData) ? nData : (nData?.data ?? []))
    } catch (e: any) {
      showError(e.message || 'Gagal memuat item pemeriksaan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nameOf = (id: number | null) =>
    instrumentNames.find((n) => Number(n.id) === Number(id))?.name ||
    (id ? `#${id}` : '(umum)')

  const close = () => {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const edit = (item: InspectionItem) => {
    setEditing(item)
    setForm({
      instrument_name_id: item.instrument_name_id ?? '',
      section: item.section || '',
      parameter: item.parameter || '',
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active !== false,
    })
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate) return
    if (!form.parameter.trim()) {
      showError('Parameter wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        instrument_name_id: form.instrument_name_id ? Number(form.instrument_name_id) : null,
        section: form.section || null,
        parameter: form.parameter.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      }
      const res = await fetch(
        editing ? `/api/inspection-items/${editing.id}` : '/api/inspection-items',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan')
      showSuccess('Item pemeriksaan disimpan')
      close()
      await load()
    } catch (e: any) {
      showError(e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: InspectionItem) => {
    if (!canMutate) return
    if (!confirm(`Hapus item "${item.parameter}"?`)) return
    try {
      const res = await fetch(`/api/inspection-items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      await load()
    } catch (e: any) {
      showError(e.message || 'Gagal menghapus')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div>
          <div className="font-bold text-blue-950">Master Item Pemeriksaan</div>
          <div className="text-xs text-blue-700">
            Daftar parameter pemeriksaan per jenis alat — dipakai pada Surat Keterangan.
          </div>
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setForm(emptyForm())
              setOpen(true)
            }}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"
          >
            + Tambah Item
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-gray-500">Memuat...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Jenis Alat</th>
                <th className="px-4 py-3">Seksi</th>
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3">Urutan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3">{nameOf(it.instrument_name_id)}</td>
                  <td className="px-4 py-3 text-gray-600">{it.section || '-'}</td>
                  <td className="px-4 py-3 font-medium">{it.parameter}</td>
                  <td className="px-4 py-3">{it.sort_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        it.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {it.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {canMutate && (
                      <>
                        <button type="button" onClick={() => edit(it)} className="text-blue-700 hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => remove(it)} className="text-red-600 hover:underline">
                          Hapus
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="p-6 text-sm text-gray-500">Belum ada item pemeriksaan.</div>}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit Item Pemeriksaan' : 'Tambah Item Pemeriksaan'}</h2>
              <button type="button" onClick={close} className="text-xl">x</button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold">
                Jenis Alat
                <select
                  value={form.instrument_name_id}
                  onChange={(e) => setForm({ ...form, instrument_name_id: e.target.value })}
                  className="mt-1 w-full rounded border p-2"
                >
                  <option value="">— Umum (semua alat) —</option>
                  {instrumentNames.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Seksi (opsional)
                <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="block text-sm font-semibold">
                Parameter
                <input required value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="block text-sm font-semibold">
                Urutan
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded border px-4 py-2">Batal</button>
              <button disabled={saving || !canMutate} className="rounded bg-blue-700 px-4 py-2 font-bold text-white">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
