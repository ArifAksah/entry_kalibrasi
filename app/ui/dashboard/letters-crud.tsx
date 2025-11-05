'use client'

import React, { useEffect, useState } from 'react'
import { useLetters } from '../../../hooks/useLetters'
import { Letter, LetterInsert, LetterUpdate } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

const LettersCRUD: React.FC = () => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useLetters()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Letter | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instruments, setInstruments] = useState<Array<{ id: number; name?: string; manufacturer?: string; type?: string; serial_number?: string }>>([])
  const [stations, setStations] = useState<Array<{ id: number; name: string; station_id: string }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [results, setResults] = useState<Array<{ id: number }>>([])
  const [instrumentFilter, setInstrumentFilter] = useState('')
  const [isInstrumentOpen, setIsInstrumentOpen] = useState(false)
  const [stationFilter, setStationFilter] = useState('')
  const [isStationOpen, setIsStationOpen] = useState(false)
  type LocalForm = LetterInsert & {
    approver_name?: string | null
    // Local-only helpers to build inspection_payload JSON
    inspection_date?: string
    inspected_by?: string
    inspection_items?: Array<{ pemeriksaan: string; keterangan: string }>
    verification?: string[] | null
  }
  const [form, setForm] = useState<LocalForm>({ no_letter: '', instrument: null, owner: null, issue_date: '', inspection_result: null, authorized_by: null, approver_name: '', inspection_date: '', inspected_by: '', inspection_items: [], verification: [] })

  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        const r = await fetch('/api/instruments?pageSize=1000')
        const d = await r.json()
        if (r.ok) {
          const arr = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])
          setInstruments(arr as any)
        }
      } catch {}
    }
    const fetchStations = async () => {
      try {
        const r = await fetch('/api/stations?pageSize=1000')
        const d = await r.json()
        if (r.ok) {
          const arr = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])
          setStations(arr as any)
        }
      } catch {}
    }
    const fetchPersonel = async () => {
      try { const r = await fetch('/api/personel'); const d = await r.json(); if (r.ok) setPersonel(Array.isArray(d)? d: []) } catch {}
    }
    const fetchResults = async () => {
      try { const r = await fetch('/api/inspection-results'); const d = await r.json(); if (r.ok) setResults(Array.isArray(d)? d: []) } catch {}
    }
    fetchInstruments(); fetchStations(); fetchPersonel(); fetchResults()
  }, [])

  const openModal = (item?: Letter) => {
    if (item) {
      setEditing(item)
      setForm({ 
        no_letter: item.no_letter, 
        instrument: (typeof (item as any).instrument === 'string') ? parseInt((item as any).instrument, 10) : (item.instrument as any), 
        owner: (typeof (item as any).owner === 'string') ? parseInt((item as any).owner, 10) : (item.owner as any), 
        issue_date: item.issue_date || '', 
        inspection_result: item.inspection_result, 
        authorized_by: item.authorized_by,
        approver_name: (item as any).approver_name || '',
        inspection_date: '',
        inspected_by: '',
        inspection_items: Array.isArray((item as any)?.inspection_payload?.items) ? (item as any).inspection_payload.items : [],
        verification: Array.isArray((item as any)?.verification) ? (item as any).verification : []
      })
    } else {
      setEditing(null)
      setForm({ no_letter: '', instrument: null, owner: null, issue_date: '', inspection_result: null, authorized_by: null, approver_name: '', inspection_date: '', inspected_by: '', inspection_items: [], verification: [] })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => { setIsModalOpen(false); setEditing(null) }

  // Close on Escape for better UX
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    if (isModalOpen) { window.addEventListener('keydown', onKey) }
    return () => { window.removeEventListener('keydown', onKey) }
  }, [isModalOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.no_letter) return
    setIsSubmitting(true)
    try {
      const station = stations.find(s => s.id === (form.owner ?? -1))
      const inspection_payload = {
        header: {
          tanggal_pemeriksaan: form.inspection_date || null,
          tempat_pemeriksaan: station ? station.name : null,
          diperiksa_oleh: form.inspected_by || null
        },
        items: (form.inspection_items || []).map(it => ({ pemeriksaan: it.pemeriksaan, keterangan: it.keterangan }))
      }

      const payload: LetterUpdate = {
        no_letter: form.no_letter,
        instrument: form.instrument,
        owner: form.owner,
        issue_date: form.issue_date || null,
        inspection_result: form.inspection_result,
        authorized_by: form.authorized_by,
        approver_name: form.approver_name || null,
        inspection_payload,
        verification: form.verification || []
      }

      if (editing) await updateItem(editing.id, payload)
      else await addItem(payload as any)
      closeModal()
    } catch {} finally { setIsSubmitting(false) }
  }

  const handleDelete = async (id: number) => { if (!confirm('Delete this letter?')) return; try { await deleteItem(id) } catch {} }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Documents', href: '#' }, { label: 'Letters' }]} />
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <Card>
        <Table headers={[ 'No. Letter', 'Instrument', 'Owner', 'Issue Date', 'Authorized By', 'Actions' ]}>
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.no_letter}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{
                (() => {
                  const ins = instruments.find(i => i.id === Number(item.instrument ?? -1))
                  if (!ins) return item.instrument ? `ID: ${item.instrument}` : '-'
                  const fallback = `${ins.manufacturer ?? ''} ${ins.type ?? ''} ${ins.serial_number ?? ''}`.trim()
                  const label = (ins.name && ins.name !== 'Instrument' ? ins.name : '') || fallback
                  return label || `ID: ${ins.id}`
                })()
              }</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{
                (() => {
                  const st = stations.find(s => s.id === Number(item.owner ?? -1))
                  if (!st) return item.owner ? `ID: ${item.owner}` : '-'
                  return `${st.name} (${st.station_id})`
                })()
              }</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.issue_date || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.authorized_by || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <a
                  href={`/letters/${item.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-900"
                  title="View Letter"
                >
                  View
                </a>
                <a
                  href={`/letters/${item.id}/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-800"
                  title="Print Letter"
                >
                  Print
                </a>
                <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="w-full max-w-3xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-xl shadow-xl ring-1 ring-black/5 max-h-[85vh] flex flex-col">
              <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Letter' : 'Add New Letter'}</h3>
                <button aria-label="Close" onClick={closeModal} className="p-2 rounded hover:bg-gray-100 text-gray-600">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Letter</label>
                    <input placeholder="Contoh: F.M.2025.032.002" value={form.no_letter} onChange={e => setForm({ ...form, no_letter: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approver Name</label>
                    <input placeholder="Nama pejabat pengesahan" value={form.approver_name ?? ''} onChange={e => setForm({ ...form, approver_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrument</label>
                    {/* Preview card ala Certificates */}
                    <div className="mb-2 border rounded-lg p-3 bg-gray-50">
                      {(() => {
                        const ins = instruments.find(i => i.id === (form.instrument ?? -1))
                        if (!ins) return <div className="text-sm text-gray-500">Belum ada instrument terpilih</div>
                        const title = (ins.name && ins.name !== 'Instrument') ? ins.name : `${ins.manufacturer ?? ''} ${ins.type ?? ''}`.trim()
                        const sub = `${ins.serial_number ?? ''} ${ins.manufacturer ?? ''}`.trim()
                        return (
                          <div>
                            <div className="font-medium text-gray-900">{title}</div>
                            <div className="text-xs text-gray-600">{sub || '-'}</div>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-600">{form.instrument ? 'Instrument terpilih' : 'Belum ada instrument terpilih'}</div>
                      <div className="space-x-2">
                        <button type="button" onClick={() => { setIsInstrumentOpen(true); setInstrumentFilter('') }} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Change</button>
                        {form.instrument != null && (
                          <button type="button" onClick={() => { setForm(prev => ({ ...prev, instrument: null })); setInstrumentFilter(''); }} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200">Clear</button>
                        )}
                      </div>
                    </div>

                    {isInstrumentOpen && (
                      <>
                        {/* Search input */}
                        <input
                          placeholder="Cari nama/pabrikan/tipe/serial..."
                          value={instrumentFilter}
                          onChange={e => setInstrumentFilter(e.target.value)}
                          onFocus={() => setIsInstrumentOpen(true)}
                          className="mb-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />

                        {/* Result list clickable */}
                        <div className="border rounded-lg max-h-44 overflow-auto divide-y">
                          {instruments
                            .filter(i => {
                              const q = instrumentFilter.toLowerCase()
                              if (!q) return true
                              const txt = `${i.name ?? ''} ${i.manufacturer ?? ''} ${i.type ?? ''} ${i.serial_number ?? ''}`.toLowerCase()
                              return txt.includes(q)
                            })
                            .slice(0, 50)
                            .map(i => {
                              const title = (i.name && i.name !== 'Instrument') ? i.name : `${i.manufacturer ?? ''} ${i.type ?? ''}`.trim()
                              const sub = `${i.serial_number ?? ''} ${i.manufacturer ?? ''}`.trim()
                              const selected = form.instrument === i.id
                              return (
                                <button
                                  type="button"
                                  key={i.id}
                                  onClick={() => { setForm(prev => ({ ...prev, instrument: i.id })); setIsInstrumentOpen(false) }}
                                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${selected ? 'bg-blue-50' : ''}`}
                                >
                                  <div className="text-sm font-medium text-gray-900">{title}</div>
                                  <div className="text-xs text-gray-600">{sub || '-'}</div>
                                </button>
                              )
                            })}
                          {instruments.filter(i => {
                            const q = instrumentFilter.toLowerCase(); if (!q) return true; const txt = `${i.name ?? ''} ${i.manufacturer ?? ''} ${i.type ?? ''} ${i.serial_number ?? ''}`.toLowerCase(); return txt.includes(q)
                          }).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Tidak ada hasil</div>
                          )}
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={() => setIsInstrumentOpen(false)} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Tutup</button>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner (Station)</label>
                    {/* Preview card */}
                    <div className="mb-2 border rounded-lg p-3 bg-gray-50">
                      {(() => {
                        const st = stations.find(s => s.id === (form.owner ?? -1))
                        if (!st) return <div className="text-sm text-gray-500">Belum ada station terpilih</div>
                        return (
                          <div>
                            <div className="font-medium text-gray-900">{st.name}</div>
                            <div className="text-xs text-gray-600">{st.station_id}</div>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-600">{form.owner ? 'Station terpilih' : 'Belum ada station terpilih'}</div>
                      <div className="space-x-2">
                        <button type="button" onClick={() => { setIsStationOpen(true); setStationFilter('') }} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Change</button>
                        {form.owner != null && (
                          <button type="button" onClick={() => { setForm(prev => ({ ...prev, owner: null })); setStationFilter(''); }} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200">Clear</button>
                        )}
                      </div>
                    </div>
                    {isStationOpen && (
                      <>
                        <input
                          placeholder="Cari nama/kode station..."
                          value={stationFilter}
                          onChange={e => setStationFilter(e.target.value)}
                          className="mb-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <div className="border rounded-lg max-h-44 overflow-auto divide-y">
                          {stations
                            .filter(s => {
                              const q = stationFilter.toLowerCase()
                              if (!q) return true
                              const txt = `${s.name ?? ''} ${s.station_id ?? ''}`.toLowerCase()
                              return txt.includes(q)
                            })
                            .slice(0, 50)
                            .map(s => {
                              const selected = form.owner === s.id
                              return (
                                <button
                                  type="button"
                                  key={s.id}
                                  onClick={() => { setForm(prev => ({ ...prev, owner: s.id })); setIsStationOpen(false) }}
                                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${selected ? 'bg-blue-50' : ''}`}
                                >
                                  <div className="text-sm font-medium text-gray-900">{s.name}</div>
                                  <div className="text-xs text-gray-600">{s.station_id}</div>
                                </button>
                              )
                            })}
                          {stations.filter(s => { const q = stationFilter.toLowerCase(); if (!q) return true; const txt = `${s.name ?? ''} ${s.station_id ?? ''}`.toLowerCase(); return txt.includes(q) }).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Tidak ada hasil</div>
                          )}
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={() => setIsStationOpen(false)} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Tutup</button>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                    <input type="date" value={form.issue_date || ''} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Result</label>
                    <select value={form.inspection_result ?? ''} onChange={e => setForm({ ...form, inspection_result: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select inspection result</option>
                      {results.map(r => (<option key={r.id} value={r.id}>ID: {r.id}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By (Personel)</label>
                    <select value={form.authorized_by ?? ''} onChange={e => setForm({ ...form, authorized_by: e.target.value || null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select personel</option>
                      {personel.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 mt-2 border-t pt-3">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Inspection Details (JSON)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pemeriksaan</label>
                        <input type="date" value={form.inspection_date || ''} onChange={e => setForm({ ...form, inspection_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Diperiksa Oleh</label>
                        <input placeholder="Nama pemeriksa" value={form.inspected_by || ''} onChange={e => setForm({ ...form, inspected_by: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Pemeriksaan</label>
                        <input value={(stations.find(s => s.id === (form.owner ?? -1))?.name) || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Items</div>
                      {(form.inspection_items || []).map((it, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                          <input placeholder="Pemeriksaan" value={it.pemeriksaan} onChange={e => {
                            const arr = [...(form.inspection_items || [])]
                            arr[idx] = { ...arr[idx], pemeriksaan: e.target.value }
                            setForm({ ...form, inspection_items: arr })
                          }} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <div className="flex gap-2">
                            <input placeholder="Keterangan" value={it.keterangan} onChange={e => {
                              const arr = [...(form.inspection_items || [])]
                              arr[idx] = { ...arr[idx], keterangan: e.target.value }
                              setForm({ ...form, inspection_items: arr })
                            }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button type="button" onClick={() => {
                              const arr = [...(form.inspection_items || [])]
                              arr.splice(idx, 1)
                              setForm({ ...form, inspection_items: arr })
                            }} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Hapus</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setForm({ ...form, inspection_items: [ ...(form.inspection_items || []), { pemeriksaan: '', keterangan: '' } ] })} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">Tambah Item</button>
                        <div className="text-xs text-gray-500">Anda dapat menambah beberapa item pemeriksaan.</div>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2 mt-2">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Verification (multi-select)</div>
                    <select multiple value={(form.verification || []) as any} onChange={e => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                      setForm({ ...form, verification: opts })
                    }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-28">
                      {personel.map(p => (
                        <option key={p.id} value={p.id}>{p.name || p.id}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">Tahan Ctrl/Cmd untuk memilih lebih dari satu.</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Saving...' : (editing ? 'Update' : 'Create')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LettersCRUD

