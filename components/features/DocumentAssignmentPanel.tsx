'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import SearchableDropdown from '../ui/SearchableDropdown'

type Person = { id: string; name?: string | null; role?: string | null; is_active?: boolean }

type OrderItem = {
  id: number
  no_identification: string
  instrument_id: number | null
  status: string
}

type Assignment = {
  id: number
  verifikator_1: string | null
  verifikator_2: string | null
  verifikator_3: string | null
  authorized_by: string | null
  locked_at: string | null
  checked_by: Array<{ personel_id: string; personel?: Person | null }>
  verifikator_1_person?: Person | null
  verifikator_2_person?: Person | null
  verifikator_3_person?: Person | null
  authorized_person?: Person | null
  conflict?: unknown
}

type Props = {
  items: OrderItem[]
  team: Person[]
  people: Person[]
  instrumentName: (item: OrderItem) => string
}

const toOption = (person: Person) => ({
  id: String(person.id),
  name: person.name || person.id,
  description: person.role || '',
})

/**
 * Panel penugasan dokumen per identifikasi, ditampilkan langsung di dalam
 * detail Order Kalibrasi (satu tempat, tanpa popup terpisah).
 */
const DocumentAssignmentPanel: React.FC<Props> = ({ items, team, people, instrumentName }) => {
  const [assignments, setAssignments] = useState<Record<number, Assignment | null>>({})
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [checkedByIds, setCheckedByIds] = useState<string[]>([])
  const [v1, setV1] = useState<string | null>(null)
  const [v2, setV2] = useState<string | null>(null)
  const [v3, setV3] = useState<string | null>(null)
  const [signer, setSigner] = useState<string | null>(null)

  const activeItems = useMemo(() => items.filter((item) => item.status !== 'void'), [items])

  const loadAll = useCallback(async () => {
    if (!activeItems.length) return
    setLoading(true)
    try {
      const results = await Promise.all(
        activeItems.map(async (item) => {
          const response = await fetch(`/api/calibration-order-items/${item.id}/document-assignment`)
          const json = await response.json()
          return [item.id, response.ok ? (json.data as Assignment | null) : null] as const
        }),
      )
      setAssignments(Object.fromEntries(results))
    } catch {
      setError('Gagal memuat penugasan dokumen')
    } finally {
      setLoading(false)
    }
  }, [activeItems])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openEditor = (itemId: number) => {
    const assignment = assignments[itemId]
    setEditingId(itemId)
    setError(null)
    setNotice(null)
    setCheckedByIds(
      assignment?.checked_by?.length
        ? assignment.checked_by.map((row) => row.personel_id)
        : team.map((person) => person.id),
    )
    setV1(assignment?.verifikator_1 ?? null)
    setV2(assignment?.verifikator_2 ?? null)
    setV3(assignment?.verifikator_3 ?? null)
    setSigner(assignment?.authorized_by ?? null)
  }

  const save = async (itemId: number) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/calibration-order-items/${itemId}/document-assignment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checked_by_ids: checkedByIds,
          verifikator_1: v1,
          verifikator_2: v2,
          verifikator_3: v3,
          authorized_by: signer,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menyimpan penugasan')
      setAssignments((current) => ({ ...current, [itemId]: json.data as Assignment }))
      setNotice('Penugasan dokumen berhasil disimpan')
      setEditingId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menyimpan penugasan')
    } finally {
      setSaving(false)
    }
  }

  const verifikatorOptions = useMemo(
    () => people.filter((person) => person.role === 'verifikator' && person.is_active !== false).map(toOption),
    [people],
  )
  const signerOptions = useMemo(
    () => people.filter((person) => person.role === 'assignor' && person.is_active !== false).map(toOption),
    [people],
  )

  const summary = (assignment: Assignment | null, key: 'checked' | 'verifikator' | 'signer') => {
    if (!assignment) return '-'
    if (key === 'checked') {
      const names = (assignment.checked_by || [])
        .map((row) => row.personel?.name)
        .filter(Boolean) as string[]
      return names.length ? names.join(', ') : '-'
    }
    if (key === 'verifikator') {
      const names = [
        assignment.verifikator_1_person?.name,
        assignment.verifikator_2_person?.name,
        assignment.verifikator_3_person?.name,
      ].filter(Boolean) as string[]
      return names.length ? names.join(', ') : '-'
    }
    return assignment.authorized_person?.name || '-'
  }

  if (!activeItems.length) return null

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <div className="font-semibold text-gray-700">Penugasan Dokumen</div>
          <div className="text-xs text-gray-500">
            Dipakai bersama oleh Sertifikat dan Surat Keterangan untuk tiap identifikasi.
          </div>
        </div>
        {loading && <span className="text-xs text-gray-500">Memuat…</span>}
      </div>

      {(error || notice) && (
        <div className={`border-b px-4 py-2 text-xs ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {activeItems.map((item) => {
          const assignment = assignments[item.id]
          const locked = Boolean(assignment?.locked_at)
          const isEditing = editingId === item.id

          return (
            <div key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {item.no_identification} • {instrumentName(item)}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-gray-600 sm:grid-cols-3">
                    <div><span className="font-semibold">Diperiksa:</span> {summary(assignment ?? null, 'checked')}</div>
                    <div><span className="font-semibold">Diverifikasi:</span> {summary(assignment ?? null, 'verifikator')}</div>
                    <div><span className="font-semibold">Pengesahan:</span> {summary(assignment ?? null, 'signer')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      locked
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {locked ? 'Terkunci' : 'Belum dikunci'}
                  </span>
                  <button
                    type="button"
                    onClick={() => (isEditing ? setEditingId(null) : openEditor(item.id))}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    {isEditing ? 'Tutup' : locked ? 'Lihat' : 'Atur'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 space-y-4 rounded-lg border border-gray-200 p-3">
                  {locked && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                      Penugasan sudah dikunci pada {new Date(assignment!.locked_at as string).toLocaleString('id-ID')} dan tidak dapat diubah.
                    </div>
                  )}
                  <div>
                    <div className="mb-1 text-xs font-bold text-gray-800">Diperiksa Oleh</div>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {team.map((person) => (
                        <label key={person.id} className="flex items-center gap-2 text-xs text-black">
                          <input
                            type="checkbox"
                            checked={checkedByIds.includes(person.id)}
                            disabled={locked}
                            onChange={(event) =>
                              setCheckedByIds((current) =>
                                event.target.checked
                                  ? [...current, person.id]
                                  : current.filter((id) => id !== person.id),
                              )
                            }
                          />
                          {person.name || person.id}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['Verifikator 1', v1, setV1],
                      ['Verifikator 2', v2, setV2],
                      ['Verifikator 3', v3, setV3],
                    ] as const).map(([label, value, setter]) => (
                      <div key={label} className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700">{label}</label>
                        <SearchableDropdown
                          value={value}
                          onChange={(next) => setter((next as string) || null)}
                          options={verifikatorOptions}
                          placeholder="Pilih verifikator"
                          searchPlaceholder={`Cari ${label.toLowerCase()}...`}
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Pejabat Pengesahan / Penandatangan</label>
                      <SearchableDropdown
                        value={signer}
                        onChange={(next) => setSigner((next as string) || null)}
                        options={signerOptions}
                        placeholder="Pilih penandatangan"
                        searchPlaceholder="Cari penandatangan..."
                      />
                    </div>
                  </div>
                  {!locked && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => save(item.id)}
                        disabled={saving}
                        className="rounded-lg bg-[#1e377c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162a60] disabled:opacity-50"
                      >
                        {saving ? 'Menyimpan...' : 'Simpan Penugasan'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DocumentAssignmentPanel
