'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SideNav from '../../../ui/dashboard/sidenav'
import Header from '../../../ui/dashboard/header'
import ProtectedRoute from '../../../../components/ProtectedRoute'

type Row = { inspection_item_id: number | null; parameter: string; hasil: string }

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
  const [instruments, setInstruments] = useState<any[]>([])
  const [personel, setPersonel] = useState<any[]>([])

  const [inspectionDate, setInspectionDate] = useState('')
  const [inspectionPlace, setInspectionPlace] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [referenceDocument, setReferenceDocument] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [verifikator1, setVerifikator1] = useState<string>('')
  const [verifikator2, setVerifikator2] = useState<string>('')
  const [verifikator3, setVerifikator3] = useState<string>('')
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        if (!letterId) throw new Error('Missing id')
        const [lRes, iRes, pRes] = await Promise.all([
          fetch(`/api/letters/${letterId}`),
          fetch('/api/instruments?page=1&pageSize=1000'),
          fetch('/api/personel'),
        ])
        const [l, iData, pData] = await Promise.all([lRes.json(), iRes.json(), pRes.json()])
        if (!lRes.ok) throw new Error(l?.error || 'Gagal memuat surat')
        setLetter(l)
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setPersonel(Array.isArray(pData) ? pData : [])

        setInspectionDate(l.inspection_date || '')
        setInspectionPlace(l.inspection_place || '')
        setIssueDate(l.issue_date || '')
        setReferenceDocument(l.reference_document || '')
        setNotes(l.notes || '')
        setStatus(l.status || 'draft')
        setVerifikator1(l.verifikator_1 || '')
        setVerifikator2(l.verifikator_2 || '')
        setVerifikator3(l.verifikator_3 || '')
        setRows(
          (Array.isArray(l.results) ? l.results : []).map((r: any) => ({
            inspection_item_id: r.inspection_item_id ?? null,
            parameter: r.parameter || '',
            hasil: r.hasil || '',
          })),
        )
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [letterId])

  const instrumentNameId = useMemo(() => {
    const inst = instruments.find((i) => Number(i.id) === Number(letter?.instrument))
    return inst?.names ?? inst?.instrument_names_id ?? null
  }, [instruments, letter])

  const loadFromMaster = async () => {
    if (!instrumentNameId) return
    try {
      const res = await fetch(`/api/inspection-items?instrument_name_id=${instrumentNameId}`)
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data?.data ?? [])
      setRows(
        items.map((it: any) => ({
          inspection_item_id: it.id,
          parameter: it.parameter,
          hasil: '',
        })),
      )
    } catch {
      /* ignore */
    }
  }

  const setRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const addRow = () => setRows((prev) => [...prev, { inspection_item_id: null, parameter: '', hasil: '' }])
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))

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
          issue_date: issueDate || null,
          reference_document: referenceDocument || null,
          notes: notes || null,
          status,
          verifikator_1: verifikator1 || null,
          verifikator_2: verifikator2 || null,
          verifikator_3: verifikator3 || null,
          results: rows.map((r, i) => ({
            inspection_item_id: r.inspection_item_id,
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
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
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
                    Tanggal Terbit
                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Dokumen Acuan
                    <input value={referenceDocument} onChange={(e) => setReferenceDocument(e.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                      <option value="draft">draft</option>
                      <option value="final">final</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-600 md:col-span-2">
                    Catatan
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3">
                  {[
                    { label: 'Verifikator 1', value: verifikator1, set: setVerifikator1 },
                    { label: 'Verifikator 2', value: verifikator2, set: setVerifikator2 },
                    { label: 'Verifikator 3', value: verifikator3, set: setVerifikator3 },
                  ].map((v) => (
                    <label key={v.label} className="block text-xs font-semibold text-gray-600">
                      {v.label}
                      <select value={v.value} onChange={(e) => v.set(e.target.value)} className={inputClass}>
                        <option value="">— pilih —</option>
                        {personel.map((p) => (
                          <option key={p.id} value={p.id}>{p.name || p.id}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-base font-bold text-gray-800">Hasil Pemeriksaan</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadFromMaster}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      Muat dari Master
                    </button>
                    <button
                      type="button"
                      onClick={addRow}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      + Baris
                    </button>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500">Belum ada item. Tambahkan baris atau muat dari master.</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Parameter</th>
                          <th className="px-3 py-2">Hasil</th>
                          <th className="w-16 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <input value={r.parameter} onChange={(e) => setRow(idx, { parameter: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={r.hasil} onChange={(e) => setRow(idx, { hasil: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" onClick={() => removeRow(idx)} className="text-xs text-red-600 hover:underline">
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
