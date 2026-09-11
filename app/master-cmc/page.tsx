'use client'

import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import { supabase } from '../../lib/supabase'

type CmcValue = {
  id?: number
  range_min: number | null
  range_max: number | null
  cmc_value: number
  unit: string
  sequence: number
}
type CmcProfile = {
  id: number
  code: string
  name: string
  parameter_code: string
  calibration_method: string | null
  source_document: string | null
  version: number
  effective_from: string
  effective_until: string | null
  is_active: boolean
  cmc_values: CmcValue[]
}

const emptyForm = {
  code: '',
  name: '',
  parameter_code: '',
  calibration_method: '',
  source_document: 'Workbook CMC BMKG 2026',
  version: 1,
  effective_from: new Date().toISOString().slice(0, 10),
  effective_until: '',
  is_active: true,
  range_min: '',
  range_max: '',
  cmc_value: '',
  unit: '',
}

export default function MasterCmcPage() {
  const [items, setItems] = useState<CmcProfile[]>([])
  const [form, setForm] = useState<any>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const response = await fetch('/api/cmc')
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Gagal memuat CMC')
    setItems(payload.data || [])
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message))
  }, [])

  const reset = () => {
    setForm(emptyForm)
    setEditingId(null)
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const body = editingId
        ? {
            ...form,
            values: [
              {
                id: form.value_id,
                range_min: form.range_min,
                range_max: form.range_max,
                cmc_value: form.cmc_value,
                unit: form.unit,
                sequence: 1,
              },
            ],
          }
        : form
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const response = await fetch(
        editingId ? `/api/cmc/${editingId}` : '/api/cmc',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify(body),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan CMC')
      setMessage('Data CMC berhasil disimpan')
      reset()
      await load()
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const edit = (item: CmcProfile) => {
    const value = item.cmc_values?.[0]
    setEditingId(item.id)
    setForm({
      ...item,
      value_id: value?.id,
      range_min: value?.range_min ?? '',
      range_max: value?.range_max ?? '',
      cmc_value: value?.cmc_value ?? '',
      unit: value?.unit ?? '',
    })
  }

  const deactivate = async (id: number) => {
    if (!confirm('Nonaktifkan profil CMC ini?')) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const response = await fetch(`/api/cmc/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok)
      return setMessage(payload.error || 'Gagal menonaktifkan CMC')
    setMessage('Profil CMC dinonaktifkan')
    await load()
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <main className="p-4 sm:p-6 mx-auto max-w-[1600px] space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Master CMC</h1>
              <p className="text-gray-500">
                Kelola kemampuan kalibrasi dan pengukuran untuk rule MAX(U95,
                CMC).
              </p>
            </div>
            {message && (
              <div className="rounded border bg-white px-4 py-3 text-sm">
                {message}
              </div>
            )}
            <form
              onSubmit={submit}
              className="bg-white rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              {[
                ['code', 'Kode profil'],
                ['name', 'Nama profil'],
                ['parameter_code', 'Kode parameter'],
                ['calibration_method', 'Metode kalibrasi'],
                ['range_min', 'Rentang awal'],
                ['range_max', 'Rentang akhir'],
                ['cmc_value', 'Nilai CMC'],
                ['unit', 'Satuan'],
                ['source_document', 'Dokumen acuan'],
                ['effective_from', 'Berlaku mulai'],
                ['effective_until', 'Berlaku sampai'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="text-xs font-semibold text-gray-600"
                >
                  {label}
                  <input
                    type={
                      key.includes('effective')
                        ? 'date'
                        : ['range_min', 'range_max', 'cmc_value'].includes(key)
                          ? 'number'
                          : 'text'
                    }
                    step="any"
                    value={form[key] ?? ''}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    disabled={
                      editingId != null &&
                      ['code', 'parameter_code'].includes(key)
                    }
                  />
                </label>
              ))}
              <div className="md:col-span-4 flex gap-2">
                <button
                  disabled={loading}
                  className="rounded bg-blue-600 text-white px-4 py-2 text-sm"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah CMC'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded border px-4 py-2 text-sm"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      'Kode',
                      'Nama',
                      'Parameter',
                      'Rentang',
                      'CMC',
                      'Metode',
                      'Versi',
                      'Status',
                      'Aksi',
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 text-left">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const value = item.cmc_values?.[0]
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-mono">{item.code}</td>
                        <td className="px-4 py-3">{item.name}</td>
                        <td className="px-4 py-3">{item.parameter_code}</td>
                        <td className="px-4 py-3">
                          {value?.range_min ?? '-'} – {value?.range_max ?? '-'}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {value?.cmc_value ?? '-'} {value?.unit ?? ''}
                        </td>
                        <td className="px-4 py-3">
                          {item.calibration_method || '-'}
                        </td>
                        <td className="px-4 py-3">v{item.version}</td>
                        <td className="px-4 py-3">
                          {item.is_active ? 'Aktif' : 'Nonaktif'}
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            onClick={() => edit(item)}
                            className="text-blue-600"
                          >
                            Edit
                          </button>
                          {item.is_active && (
                            <button
                              onClick={() => deactivate(item.id)}
                              className="text-red-600"
                            >
                              Nonaktifkan
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
