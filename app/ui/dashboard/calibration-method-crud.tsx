'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAlert } from '../../../hooks/useAlert'
import {
  normalizePyranometerRules,
  type PyranometerMethodRules,
} from '../../../lib/calibration-method-profiles'

type Scope = 'pyranometer' | 'raw_general' | 'tipping_bucket'
type Method = {
  id: number
  code: string
  name: string
  instrument_scope: Scope
  adapter_id: string
  version: number
  source_documents: Array<{ code: string; edition?: string }>
  rules: Record<string, unknown>
  effective_from: string
  effective_until: string | null
  is_active: boolean
  notes: string | null
}

const scopeLabels: Record<Scope, string> = {
  pyranometer: 'Pyranometer',
  raw_general: 'AWOS/AWS Raw Data',
  tipping_bucket: 'Tipping Bucket',
}

const emptyForm = () => ({
  code: '',
  name: '',
    instrument_scope: 'pyranometer' as Scope,
  adapter_id: 'pyranometer-v1',
  version: 1,
  source_documents: '[{"code":"","edition":""}]',
  rules: '{}',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_until: '',
  is_active: true,
  notes: '',
})

export default function CalibrationMethodCRUD() {
  const { role } = usePermissions()
  const { showError, showSuccess } = useAlert()
  const [items, setItems] = useState<Method[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Method | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const canMutate = role === 'admin'

  // Kontrak metode pyranometer (terstruktur). Untuk scope lain, editor JSON mentah.
  const pyranometerRules = useMemo<PyranometerMethodRules | null>(() => {
    if (form.instrument_scope !== 'pyranometer') return null
    try {
      return normalizePyranometerRules(JSON.parse(form.rules || '{}'))
    } catch {
      return normalizePyranometerRules(undefined)
    }
  }, [form.rules, form.instrument_scope])

  const writeRules = (next: PyranometerMethodRules) =>
    setForm((prev) => ({ ...prev, rules: JSON.stringify(next, null, 2) }))

  const updatePyranometerComponent = (
    key: string,
    patch: Partial<PyranometerMethodRules['components'][number]>,
  ) => {
    if (!pyranometerRules) return
    writeRules({
      ...pyranometerRules,
      components: pyranometerRules.components.map((c) =>
        c.key === key ? { ...c, ...patch } : c,
      ),
    })
  }

  const classBadgeTone: Record<string, string> = {
    KONSTANTA: 'bg-purple-100 text-purple-700',
    SPESIFIKASI: 'bg-amber-100 text-amber-800',
    VARIABEL: 'bg-sky-100 text-sky-700',
  }

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/calibration-methods')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat Master Metode')
      setItems(Array.isArray(payload.data) ? payload.data : [])
    } catch (error: any) {
      showError(error.message || 'Gagal memuat Master Metode')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const close = () => {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const edit = (item: Method) => {
    setEditing(item)
    setForm({
      code: item.code,
      name: item.name,
      instrument_scope: item.instrument_scope,
      adapter_id: item.adapter_id,
      version: item.version,
      source_documents: JSON.stringify(item.source_documents || [], null, 2),
      rules: JSON.stringify(item.rules || {}, null, 2),
      effective_from: item.effective_from,
      effective_until: item.effective_until || '',
      is_active: item.is_active,
      notes: item.notes || '',
    })
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canMutate) return
    let sourceDocuments: unknown
    let rules: unknown
    try {
      sourceDocuments = JSON.parse(form.source_documents)
      rules = JSON.parse(form.rules)
      if (!Array.isArray(sourceDocuments) || typeof rules !== 'object' || rules === null) throw new Error('Format JSON tidak valid')
    } catch (error: any) {
      showError(error.message || 'Dokumen acuan dan aturan harus berupa JSON valid')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/calibration-methods/${editing.id}` : '/api/calibration-methods', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source_documents: sourceDocuments, rules }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan Master Metode')
      showSuccess('Master Metode berhasil disimpan')
      close()
      await load()
    } catch (error: any) {
      showError(error.message || 'Gagal menyimpan Master Metode')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div>
          <div className="font-bold text-blue-950">Profil metode berversi</div>
          <div className="text-xs text-blue-700">Perubahan metode dibuat sebagai versi baru agar hasil lama tetap dapat diaudit.</div>
        </div>
        {canMutate && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); setOpen(true) }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Tambah Profil</button>}
      </div>

      {loading ? <div className="rounded-xl bg-white p-6 text-sm text-gray-500">Memuat...</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Versi</th><th className="px-4 py-3">Dokumen</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => <tr key={item.id}>
                <td className="px-4 py-3"><div className="font-mono font-bold">{item.code}</div><div className="text-xs text-gray-500">{item.name}</div></td>
                <td className="px-4 py-3">{scopeLabels[item.instrument_scope]}</td>
                <td className="px-4 py-3 font-mono">v{item.version}</td>
                <td className="px-4 py-3 text-xs">{(item.source_documents || []).map((doc) => `${doc.code}${doc.edition ? ` ${doc.edition}` : ''}`).join('; ') || '-'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="px-4 py-3 text-right">{canMutate && <button type="button" onClick={() => edit(item)} className="text-blue-700 hover:underline">Edit</button>}</td>
              </tr>)}
            </tbody>
          </table>
          {items.length === 0 && <div className="p-6 text-sm text-gray-500">Belum ada profil metode.</div>}
        </div>
      )}

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <form onSubmit={submit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? 'Edit Profil Metode' : 'Tambah Profil Metode'}</h2><button type="button" onClick={close} className="text-xl">x</button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold">Kode<input required disabled={Boolean(editing)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full rounded border p-2 font-mono" /></label>
            <label className="text-sm font-semibold">Nama<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
            <label className="text-sm font-semibold">Scope<select disabled={Boolean(editing)} value={form.instrument_scope} onChange={(e) => setForm({ ...form, instrument_scope: e.target.value as Scope })} className="mt-1 w-full rounded border p-2"><option value="pyranometer">Pyranometer</option><option value="raw_general">AWOS/AWS Raw Data</option><option value="tipping_bucket">Tipping Bucket</option></select></label>
            <label className="text-sm font-semibold">Versi<input type="number" min="1" disabled={Boolean(editing)} value={form.version} onChange={(e) => setForm({ ...form, version: Number(e.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
            <label className="text-sm font-semibold">Adapter formula<div className="mt-1 rounded border bg-gray-50 p-2 font-mono text-xs">{form.adapter_id}</div></label>
            <label className="text-sm font-semibold">Berlaku mulai<input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
            <label className="text-sm font-semibold">Berlaku sampai<input type="date" value={form.effective_until} onChange={(e) => setForm({ ...form, effective_until: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
          </div>
          <label className="mt-3 block text-sm font-semibold">Dokumen acuan (JSON array)<textarea rows={4} value={form.source_documents} onChange={(e) => setForm({ ...form, source_documents: e.target.value })} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
          {form.instrument_scope === 'pyranometer' && pyranometerRules && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-blue-950">Kontrak metode pyranometer</div>
                <div className="text-[11px] text-blue-700">Nilai &amp; sumber per komponen — ubah bagian yang memang konvensi.</div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold">Rumus CF
                  <select value={pyranometerRules.cfRule} onChange={(e) => writeRules({ ...pyranometerRules, cfRule: e.target.value as any })} className="mt-1 w-full rounded border p-2 text-xs">
                    <option value="MEAN_ALL_VALID">MEAN_ALL_VALID (rata-rata semua pasangan)</option>
                    <option value="EXCLUDE_OUTLIERS">EXCLUDE_OUTLIERS (keluarkan outlier)</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">Faktor cakupan (k)
                  <select value={pyranometerRules.coverageFactorRule} onChange={(e) => writeRules({ ...pyranometerRules, coverageFactorRule: e.target.value as any })} className="mt-1 w-full rounded border p-2 text-xs">
                    <option value="student_t_95">Student-t 95% (dari veff)</option>
                    <option value="k2">k = 2 (tetap)</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">Ambang outlier (× SD)
                  <input type="number" step="0.1" value={pyranometerRules.outlierThreshold} onChange={(e) => writeRules({ ...pyranometerRules, outlierThreshold: Number(e.target.value) })} className="mt-1 w-full rounded border p-2 text-xs" />
                </label>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-white text-left text-[10px] uppercase text-gray-500">
                    <tr>
                      <th className="px-2 py-1">Aktif</th>
                      <th className="px-2 py-1">Komponen</th>
                      <th className="px-2 py-1">Distribusi</th>
                      <th className="px-2 py-1">Pembagi</th>
                      <th className="px-2 py-1">vi</th>
                      <th className="px-2 py-1">Faktor</th>
                      <th className="px-2 py-1">Klasifikasi</th>
                      <th className="px-2 py-1">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pyranometerRules.components.map((c) => (
                      <tr key={c.key}>
                        <td className="px-2 py-1"><input type="checkbox" checked={c.enabled} onChange={(e) => updatePyranometerComponent(c.key, { enabled: e.target.checked })} /></td>
                        <td className="px-2 py-1 font-medium">{c.label}</td>
                        <td className="px-2 py-1">
                          <select value={c.distribution} onChange={(e) => updatePyranometerComponent(c.key, { distribution: e.target.value as any })} className="rounded border p-1 text-xs">
                            <option value="normal">Normal</option>
                            <option value="rect">Rectangular</option>
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={['sqrt_n', 'sqrt3', '2'].includes(String(c.divisor)) ? String(c.divisor) : 'other'}
                            onChange={(e) => {
                              const v = e.target.value
                              updatePyranometerComponent(c.key, {
                                divisor: v === 'other' ? (typeof c.divisor === 'number' ? c.divisor : 1) : (v as any),
                              })
                            }}
                            className="rounded border p-1 text-xs"
                          >
                            <option value="sqrt_n">√n</option>
                            <option value="sqrt3">√3</option>
                            <option value="2">2</option>
                            <option value="other">angka…</option>
                          </select>
                          {!['sqrt_n', 'sqrt3', '2'].includes(String(c.divisor)) && (
                            <input type="number" step="0.001" value={Number(c.divisor)} onChange={(e) => updatePyranometerComponent(c.key, { divisor: Number(e.target.value) })} className="mt-1 w-20 rounded border p-1 text-xs" />
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <select value={c.vi.type} onChange={(e) => updatePyranometerComponent(c.key, { vi: e.target.value === 'fixed' ? { type: 'fixed', value: c.vi.value ?? 50 } : { type: e.target.value as any } })} className="rounded border p-1 text-xs">
                            <option value="fixed">tetap</option>
                            <option value="n_minus_1">n−1</option>
                            <option value="infinite">∞</option>
                          </select>
                          {c.vi.type === 'fixed' && (
                            <input type="number" min="1" value={c.vi.value ?? 50} onChange={(e) => updatePyranometerComponent(c.key, { vi: { type: 'fixed', value: Number(e.target.value) } })} className="mt-1 w-20 rounded border p-1 text-xs" />
                          )}
                        </td>
                        <td className="px-2 py-1"><input type="number" step="1" value={c.factor} onChange={(e) => updatePyranometerComponent(c.key, { factor: Number(e.target.value) })} className="w-16 rounded border p-1 text-xs" /></td>
                        <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${classBadgeTone[c.source.classification] || 'bg-gray-100 text-gray-600'}`}>{c.source.classification}</span></td>
                        <td className="px-2 py-1 text-[10px] text-gray-500">{c.source.doc}{c.source.ref ? ` — ${c.source.ref}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-[10px] text-gray-500">KONSTANTA = definisi metode · SPESIFIKASI = dari master/sertifikat (traceable) · VARIABEL = dari data ukur.</div>
            </div>
          )}
          <label className="mt-3 block text-sm font-semibold">Aturan metode (JSON lanjutan)<textarea rows={6} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
          <label className="mt-3 block text-sm font-semibold">Catatan<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={close} className="rounded border px-4 py-2">Batal</button><button disabled={saving || !canMutate} className="rounded bg-blue-700 px-4 py-2 font-bold text-white">{saving ? 'Menyimpan...' : 'Simpan'}</button></div>
        </form>
      </div>}
    </div>
  )
}
