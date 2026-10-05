'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SideNav from '../../ui/dashboard/sidenav'
import Header from '../../ui/dashboard/header'
import ProtectedRoute from '../../../components/ProtectedRoute'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'

type Row = { inspection_item_id: number | null; parameter: string; hasil: string }

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/30'

export default function NewLetterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [certificates, setCertificates] = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])

  const [certificateId, setCertificateId] = useState<number | null>(null)
  const [issueDate, setIssueDate] = useState('')
  const [inspectionDate, setInspectionDate] = useState('')
  const [inspectionPlace, setInspectionPlace] = useState('')
  const [referenceDocument, setReferenceDocument] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const [cRes, iRes] = await Promise.all([
          fetch('/api/certificates'),
          fetch('/api/instruments?page=1&pageSize=1000'),
        ])
        const [cData, iData] = await Promise.all([cRes.json(), iRes.json()])
        if (!cRes.ok) throw new Error(cData?.error || 'Gagal memuat sertifikat')
        setCertificates(Array.isArray(cData) ? cData : (cData?.data ?? []))
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const selectedCert = useMemo(
    () => certificates.find((c) => Number(c.id) === Number(certificateId)) || null,
    [certificates, certificateId],
  )

  // Hanya sertifikat yang memang bisa dikerjakan user (pihak terkait / tim order).
  const selectableCertificates = useMemo(
    () => certificates.filter((c) => c.can_reference),
    [certificates],
  )

  const instrumentLabel = useMemo(() => {
    if (!selectedCert) return '-'
    const inst = instruments.find((i) => Number(i.id) === Number(selectedCert.instrument))
    return inst?.name_alias || inst?.type || inst?.name || `Instrumen #${selectedCert.instrument}`
  }, [instruments, selectedCert])

  const handleSelectCertificate = async (id: number) => {
    setCertificateId(id)
    const cert = certificates.find((c) => Number(c.id) === id)
    if (!cert) return
    setIssueDate(cert.issue_date || '')
    setInspectionDate((prev) => prev || cert.issue_date || '')
    try {
      const inst = instruments.find((i) => Number(i.id) === Number(cert.instrument))
      const nameId = inst?.names ?? inst?.instrument_names_id ?? null
      if (nameId) {
        const res = await fetch(`/api/inspection-items?instrument_name_id=${nameId}`)
        const data = await res.json()
        const items = Array.isArray(data) ? data : (data?.data ?? [])
        setRows(
          items.map((it: any) => ({
            inspection_item_id: it.id,
            parameter: it.parameter,
            hasil: '',
          })),
        )
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    }
  }

  const setRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const addRow = () => setRows((prev) => [...prev, { inspection_item_id: null, parameter: '', hasil: '' }])
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certificateId) {
      setError('Pilih sertifikat terlebih dahulu')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate_id: certificateId,
          issue_date: issueDate || null,
          inspection_date: inspectionDate || null,
          inspection_place: inspectionPlace || null,
          reference_document: referenceDocument || null,
          notes: notes || null,
          status: 'draft',
          results: rows.map((r, i) => ({
            inspection_item_id: r.inspection_item_id,
            parameter: r.parameter,
            hasil: r.hasil || null,
            sort_order: i,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan surat keterangan')
      router.push(`/letters/${data.id}/view`)
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
          <form onSubmit={submit} className="p-6 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div>
                <div className="text-lg font-bold text-blue-950">Buat Surat Keterangan</div>
                <div className="text-xs text-blue-700">
                  Nomor surat mengikuti nomor sertifikat; order &amp; identifikasi diambil otomatis.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/letters')}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !certificateId}
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
                Sumber &amp; Identitas
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-xs font-semibold text-gray-600 md:col-span-3">
                  Sertifikat
                  <SearchableDropdown
                    value={certificateId}
                    onChange={(val) => {
                      if (val != null && val !== '') handleSelectCertificate(Number(val))
                    }}
                    options={selectableCertificates.map((c) => ({
                      id: c.id,
                      name: c.no_certificate,
                    }))}
                    placeholder="— pilih sertifikat —"
                    searchPlaceholder="Cari no. sertifikat / order / identifikasi..."
                    emptyLabel="Tidak ada sertifikat milik tim Anda"
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  No. Order
                  <input value={selectedCert?.no_order || '-'} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  No. Identifikasi
                  <input value={selectedCert?.no_identification || '-'} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Instrumen
                  <input value={instrumentLabel} readOnly className={`${inputClass} bg-gray-50 text-gray-700`} />
                </label>
              </div>
            </div>

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
                  <input value={inspectionPlace} onChange={(e) => setInspectionPlace(e.target.value)} placeholder="Stasiun / lokasi" className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Tanggal Terbit
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Dokumen Acuan
                  <input value={referenceDocument} onChange={(e) => setReferenceDocument(e.target.value)} placeholder="SOP ..." className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-gray-600 md:col-span-2">
                  Catatan
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-base font-bold text-gray-800">Hasil Pemeriksaan</h3>
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                >
                  + Baris
                </button>
              </div>
              {rows.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Belum ada master item pemeriksaan untuk jenis alat ini. Tambahkan di Master Item Pemeriksaan.
                </div>
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
                            <input
                              value={r.parameter}
                              onChange={(e) => setRow(idx, { parameter: e.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={r.hasil}
                              onChange={(e) => setRow(idx, { hasil: e.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                            />
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
        </div>
      </div>
    </ProtectedRoute>
  )
}
