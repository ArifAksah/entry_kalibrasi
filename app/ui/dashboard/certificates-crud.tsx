'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCertificates } from '../../../hooks/useCertificates'
import { Certificate, CertificateInsert, Station, Instrument, Sensor } from '../../../lib/supabase'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import { usePermissions } from '../../../hooks/usePermissions'

const CertificatesCRUD: React.FC = () => {
  const { certificates, loading, error, addCertificate, updateCertificate, deleteCertificate } = useCertificates()
  const { user } = useAuth()
  const { can, canEndpoint } = usePermissions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [sensors, setSensors] = useState<Array<{ id: number; name?: string | null }>>([])
  const [personel, setPersonel] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState<CertificateInsert>({
    no_certificate: '',
    no_order: '',
    no_identification: '',
    authorized_by: null,
    verifikator_1: null as any,
    verifikator_2: null as any,
    issue_date: '',
    station: null,
    instrument: null,
  })

  // Derived instrument details (read-only preview)
  const [instrumentPreview, setInstrumentPreview] = useState<{ manufacturer?: string; type?: string; serial?: string; other?: string }>({})

  // Local UI state for calibration results blocks (not persisted here)
  type KV = { key: string; value: string }
  type TableRow = { key: string; unit: string; value: string }
  type TableSection = { title: string; rows: TableRow[] }
  type ResultItem = {
    sensorId: number | null
    startDate: string
    endDate: string
    place: string
    environment: KV[]
    table: TableSection[]
    notesForm: { 
      traceable_to_si_through: string; 
      reference_document: string; 
      calibration_methode: string; 
      others: string;
      standardInstruments: number[]
    }
    // auto-filled from selected sensor
    sensorDetails?: Partial<Sensor>
  }
  const [results, setResults] = useState<ResultItem[]>([
    { sensorId: null, startDate: '', endDate: '', place: '', environment: [], table: [], notesForm: { traceable_to_si_through: '', reference_document: '', calibration_methode: '', others: '', standardInstruments: [] } },
  ])
  const addResult = () => setResults(prev => [...prev, { sensorId: null, startDate: '', endDate: '', place: '', environment: [], table: [], notesForm: { traceable_to_si_through: '', reference_document: '', calibration_methode: '', others: '', standardInstruments: [] } }])
  const updateResult = (idx: number, patch: Partial<ResultItem>) => setResults(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const applySensorToResult = (idx: number, sensorId: number | null) => {
    const sensor = sensors.find((s: any) => s.id === sensorId) as unknown as Sensor | undefined
    updateResult(idx, {
      sensorId: sensorId ?? null,
      sensorDetails: sensor ? {
        id: sensor.id,
        manufacturer: sensor.manufacturer,
        type: sensor.type,
        serial_number: sensor.serial_number,
        range_capacity: sensor.range_capacity,
        range_capacity_unit: sensor.range_capacity_unit,
        graduating: sensor.graduating,
        graduating_unit: sensor.graduating_unit,
        funnel_diameter: sensor.funnel_diameter,
        funnel_diameter_unit: sensor.funnel_diameter_unit,
        funnel_area: sensor.funnel_area,
        funnel_area_unit: sensor.funnel_area_unit,
        volume_per_tip: sensor.volume_per_tip,
        volume_per_tip_unit: sensor.volume_per_tip_unit,
        name: sensor.name,
        created_at: sensor.created_at,
      } : undefined,
    })
  }

  // Picker modal
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [noteEditIndex, setNoteEditIndex] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState<{ traceable_to_si_through: string; reference_document: string; calibration_methode: string; others: string; standardInstruments: number[] }>({ traceable_to_si_through: '', reference_document: '', calibration_methode: '', others: '', standardInstruments: [] })
  const [standardPickerIndex, setStandardPickerIndex] = useState<number | null>(null)
  const [standardSearch, setStandardSearch] = useState('')
  const [envEditIndex, setEnvEditIndex] = useState<number | null>(null)
  const [envDraft, setEnvDraft] = useState<KV[]>([])
  const [tableEditIndex, setTableEditIndex] = useState<number | null>(null)
  const [tableDraft, setTableDraft] = useState<TableSection[]>([])

  // Fetch stations, instruments, sensors, personel data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stationsRes, instrumentsRes, sensorsRes, personelRes] = await Promise.all([
          fetch('/api/stations'),
          fetch('/api/instruments'),
          fetch('/api/sensors'),
          fetch('/api/personel'),
        ])
        
        if (stationsRes.ok) {
          const stationsData = await stationsRes.json()
          setStations(stationsData)
        }
        
        if (instrumentsRes.ok) {
          const instrumentsData = await instrumentsRes.json()
          setInstruments(instrumentsData)
        }

        if (sensorsRes.ok) {
          const sensorsData = await sensorsRes.json()
          setSensors(Array.isArray(sensorsData) ? sensorsData : [])
        }
        if (personelRes.ok) {
          const p = await personelRes.json()
          setPersonel(Array.isArray(p) ? p : [])
        }
        
      } catch (e) {
        console.error('Failed to fetch data:', e)
      }
    }
    fetchData()
  }, [])

  // When instrument changes, update preview fields
  useEffect(() => {
    if (!form.instrument) { setInstrumentPreview({}); return }
    const inst = instruments.find(i => i.id === form.instrument)
    if (!inst) { setInstrumentPreview({}); return }
    setInstrumentPreview({
      manufacturer: (inst as any).manufacturer || '',
      type: (inst as any).type || '',
      serial: (inst as any).serial_number || '',
    })
  }, [form.instrument, instruments])

  const openModal = (item?: Certificate) => {
    if (item) {
      setEditing(item)
      setForm({
        no_certificate: item.no_certificate,
        no_order: item.no_order,
        no_identification: item.no_identification,
        authorized_by: item.authorized_by,
        verifikator_1: (item as any).verifikator_1 ?? null,
        verifikator_2: (item as any).verifikator_2 ?? null,
        issue_date: item.issue_date,
        station: item.station,
        instrument: item.instrument,
      })
    } else {
      setEditing(null)
      setForm({
        no_certificate: '',
        no_order: '',
        no_identification: '',
        authorized_by: null,
        verifikator_1: null as any,
        verifikator_2: null as any,
        issue_date: '',
        station: null,
        instrument: null,
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.no_certificate || !form.no_order || !form.no_identification || !form.issue_date) return
    
    // Validate verifikator fields are required
    if (!(form as any).verifikator_1 || !(form as any).verifikator_2) {
      alert('Verifikator 1 dan Verifikator 2 harus dipilih')
      return
    }
    
    setIsSubmitting(true)
    try {
      const payload = { ...form, results }
      if (editing) {
        await updateCertificate(editing.id, payload as any)
      } else {
        await addCertificate(payload as any)
      }
      closeModal()
    } catch (e) {
      // handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this certificate?')) return
    try { await deleteCertificate(id) } catch {}
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Breadcrumb items={[{ label: 'Documents', href: '#' }, { label: 'Certificates' }]} />
        {can('certificate','create') && (
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add New</button>
        )}
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>)}

      <Card>
        <Table headers={[ 'Certificate No', 'Order No', 'Identification', 'Issue Date', 'Station', 'Instrument', 'Verification Status', 'Actions' ]}>
          {certificates.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.no_certificate}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.no_order}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.no_identification}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.issue_date).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.station ? stations.find(s => s.id === item.station)?.name || 'Unknown' : '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.instrument ? instruments.find(i => i.id === item.instrument)?.name || 'Unknown' : '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">V1:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      (item as any).verifikator_1_status === 'approved' ? 'bg-green-100 text-green-800' :
                      (item as any).verifikator_1_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {(item as any).verifikator_1_status || 'pending'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">V2:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      (item as any).verifikator_2_status === 'approved' ? 'bg-green-100 text-green-800' :
                      (item as any).verifikator_2_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {(item as any).verifikator_2_status || 'pending'}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <a href={`/certificates/${item.id}/print`} target="_blank" className="text-green-600 hover:text-green-800">Print</a>
                {can('certificate','update') && canEndpoint('PUT', `/api/certificates/${item.id}`) && (
                <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                )}
                {can('certificate','delete') && canEndpoint('DELETE', `/api/certificates/${item.id}`) && (
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <Card title={editing ? 'Edit Certificate' : 'Add New Certificate'}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Data Sertifikat */}
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Data Sertifikat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Sertifikat</label>
                    <input required value={form.no_certificate} onChange={e=>setForm({ ...form, no_certificate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Order</label>
                    <input required value={form.no_order} onChange={e=>setForm({ ...form, no_order: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Identifikasi</label>
                    <input required value={form.no_identification} onChange={e=>setForm({ ...form, no_identification: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Terbit</label>
                    <input required type="date" value={form.issue_date} onChange={e=>setForm({ ...form, issue_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stasiun</label>
                    <select value={form.station || ''} onChange={e=>setForm({ ...form, station: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih Stasiun</option>
                      {stations.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.station_id})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By (Personel)</label>
                    <select value={form.authorized_by ?? ''} onChange={e => setForm({ ...form, authorized_by: e.target.value || null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih personel</option>
                      {personel.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Disimpan sebagai id personel pada authorized_by</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verifikator 1 *</label>
                    <select required value={(form as any).verifikator_1 ?? ''} onChange={e => setForm({ ...form, verifikator_1: e.target.value || null } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih personel</option>
                      {personel.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verifikator 2 *</label>
                    <select required value={(form as any).verifikator_2 ?? ''} onChange={e => setForm({ ...form, verifikator_2: e.target.value || null } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih personel</option>
                      {personel.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id.slice(0,8)})</option>))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Instrumen */}
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Data Instrumen</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Instrumen</label>
                    <select value={form.instrument || ''} onChange={e=>setForm({ ...form, instrument: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih nama</option>
                      {instruments.map(i => (<option key={i.id} value={i.id}>{(i as any).name || 'Instrument'}{(i as any).type ? ` - ${(i as any).type}` : ''}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pabrikan</label>
                    <input value={instrumentPreview.manufacturer || ''} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                    <input value={instrumentPreview.type || ''} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                    <input value={instrumentPreview.serial || ''} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lainnya</label>
                    <textarea value={instrumentPreview.other || ''} onChange={e=>setInstrumentPreview(prev=>({ ...prev, other: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
                  </div>
                </div>
              </div>

              {/* Hasil Kalibrasi Sensor */}
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Hasil Kalibrasi Sensor</h3>
                  <button type="button" onClick={addResult} className="px-3 py-1 text-sm border rounded-lg">+ Tambah Result</button>
                </div>
                <div className="space-y-4">
                  {results.map((r, idx) => (
                    <div key={idx} className="border border-orange-200 bg-orange-100/60 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold">Sensor #{idx + 1}</p>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Pilih Sensor</label>
                          <select value={r.sensorId || ''} onChange={e=>applySensorToResult(idx, e.target.value ? parseInt(e.target.value) : null)} className="px-2 py-1 border rounded-lg">
                            <option value="">Pilih Sensor</option>
                            {sensors.map(s => (<option key={s.id} value={s.id}>ID {s.id}{s.name ? ` - ${s.name}` : ''}</option>))}
                          </select>
                          <button type="button" onClick={() => setPickerIndex(idx)} className="px-2 py-1 text-sm border rounded-lg">Pilih Sensor</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                          <input type="date" value={r.startDate} onChange={e=>updateResult(idx, { startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                          <input type="date" value={r.endDate} onChange={e=>updateResult(idx, { endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Kalibrasi</label>
                          <input value={r.place} onChange={e=>updateResult(idx, { place: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                      </div>

                      {r.sensorDetails && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sensor</label>
                            <input value={r.sensorDetails.name || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pabrikan</label>
                            <input value={r.sensorDetails.manufacturer || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                            <input value={r.sensorDetails.type || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                            <input value={r.sensorDetails.serial_number || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Range Capacity</label>
                              <input value={r.sensorDetails.range_capacity || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <input value={r.sensorDetails.range_capacity_unit || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Graduating</label>
                              <input value={r.sensorDetails.graduating || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <input value={r.sensorDetails.graduating_unit || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Funnel Diameter</label>
                              <input value={r.sensorDetails.funnel_diameter ?? ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <input value={r.sensorDetails.funnel_diameter_unit || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Funnel Area</label>
                              <input value={r.sensorDetails.funnel_area ?? ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <input value={r.sensorDetails.funnel_area_unit || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Volume per Tip</label>
                              <input value={r.sensorDetails.volume_per_tip || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <input value={r.sensorDetails.volume_per_tip_unit || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setEnvDraft(r.environment.length ? r.environment : [{ key: '', value: '' }]); setEnvEditIndex(idx) }} className="px-3 py-2 text-sm bg-white border rounded-lg">Isi Kondisi Lingkungan</button>
                        <button type="button" onClick={() => { setTableDraft(r.table.length ? r.table : [{ title: '', rows: [{ key: '', unit: '', value: '' }] }]); setTableEditIndex(idx) }} className="px-3 py-2 text-sm bg-white border rounded-lg">Isi Tabel Hasil</button>
                        <button type="button" onClick={() => { setNoteDraft({ ...r.notesForm, standardInstruments: r.notesForm.standardInstruments || [] }); setNoteEditIndex(idx) }} className="px-3 py-2 text-sm bg-white border rounded-lg">Buat Catatan</button>
                      </div>
                      {(r.notesForm.traceable_to_si_through || r.notesForm.reference_document || r.notesForm.calibration_methode || r.notesForm.others || (r.notesForm.standardInstruments && r.notesForm.standardInstruments.length)) && (
                        <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-white text-sm text-gray-700">
                          <div><span className="font-medium">Traceable:</span> {r.notesForm.traceable_to_si_through || '-'}</div>
                          <div><span className="font-medium">Ref Doc:</span> {r.notesForm.reference_document || '-'}</div>
                          <div><span className="font-medium">Methode:</span> {r.notesForm.calibration_methode || '-'}</div>
                          <div><span className="font-medium">Others:</span> {r.notesForm.others || '-'}</div>
                          {r.notesForm.standardInstruments && r.notesForm.standardInstruments.length > 0 && (
                            <div className="mt-1"><span className="font-medium">Instrumen Standar:</span> {r.notesForm.standardInstruments.map(id => {
                              const s = sensors.find(ss => ss.id === id) as any
                              return s ? (s.name || `Sensor ${id}`) : `ID ${id}`
                            }).join(', ')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg disabled:opacity-50">{isSubmitting ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan'}</button>
              </div>
            </form>
            </Card>
          </div>
        </div>
      )}

      {/* Environment Modal */}
      {envEditIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Kondisi Lingkungan</h3>
              <button className="p-2" onClick={() => setEnvEditIndex(null)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              {envDraft.map((row, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Key</label>
                    <input value={row.key} onChange={e=>{
                      const v=[...envDraft]; v[i]={...v[i], key:e.target.value}; setEnvDraft(v)
                    }} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Value</label>
                    <input value={row.value} onChange={e=>{
                      const v=[...envDraft]; v[i]={...v[i], value:e.target.value}; setEnvDraft(v)
                    }} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              ))}
              <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg" onClick={()=>setEnvDraft(prev=>[...prev, { key:'', value:'' }])}>+ Tambah Baris</button>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={()=>setEnvEditIndex(null)}>Batal</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={()=>{ if(envEditIndex===null) return; updateResult(envEditIndex, { environment: envDraft.filter(r=>r.key||r.value) }); setEnvEditIndex(null) }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Table Result Modal */}
      {tableEditIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Tabel Hasil</h3>
              <button className="p-2" onClick={() => setTableEditIndex(null)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              {tableDraft.map((section, si) => (
                <div key={si} className="border rounded-lg p-3">
                  <label className="block text-sm text-gray-700 mb-1">Judul Bagian</label>
                  <input value={section.title} onChange={e=>{ const v=[...tableDraft]; v[si]={...v[si], title:e.target.value}; setTableDraft(v) }} className="w-full px-3 py-2 border rounded-lg mb-3" />
                  {section.rows.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                      <input placeholder="Key" value={row.key} onChange={e=>{ const v=[...tableDraft]; v[si].rows[ri]={...row, key:e.target.value}; setTableDraft(v) }} className="px-3 py-2 border rounded-lg" />
                      <input placeholder="Unit" value={row.unit} onChange={e=>{ const v=[...tableDraft]; v[si].rows[ri]={...row, unit:e.target.value}; setTableDraft(v) }} className="px-3 py-2 border rounded-lg" />
                      <input placeholder="Value" value={row.value} onChange={e=>{ const v=[...tableDraft]; v[si].rows[ri]={...row, value:e.target.value}; setTableDraft(v) }} className="px-3 py-2 border rounded-lg" />
                    </div>
                  ))}
                  <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg" onClick={()=>{ const v=[...tableDraft]; v[si].rows=[...v[si].rows, { key:'', unit:'', value:'' }]; setTableDraft(v) }}>+ Tambah Kolom</button>
                </div>
              ))}
              <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg" onClick={()=>setTableDraft(prev=>[...prev, { title:'', rows:[{ key:'', unit:'', value:'' }] }])}>+ Tambah Bagian</button>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={()=>setTableEditIndex(null)}>Batal</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={()=>{ if(tableEditIndex===null) return; const cleaned = tableDraft.map(sec=>({ ...sec, rows: sec.rows.filter(r=>r.key||r.unit||r.value) })).filter(sec=>sec.title||sec.rows.length); updateResult(tableEditIndex, { table: cleaned }); setTableEditIndex(null) }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
      {/* Sensor Picker Modal (optional UI scaffold retained) */}

      {pickerIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama / pabrikan / tipe / serial..." className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="h-64 overflow-y-auto border rounded-lg p-2 mb-3">
              {sensors.filter(s => {
                const q = search.toLowerCase()
                return !q || `${(s as any).name||''} ${(s as any).manufacturer||''} ${(s as any).type||''} ${(s as any).serial_number||''}`.toLowerCase().includes(q)
              }).map(s => (
                <button key={s.id} onClick={() => { applySensorToResult(pickerIndex, s.id); setPickerIndex(null) }} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg border-b">
                  <div className="font-medium">{(s as any).name || 'Sensor'} — {(s as any).type || ''}</div>
                  <div className="text-xs text-gray-500">{(s as any).manufacturer || ''} • SN {(s as any).serial_number || '-'}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={() => setPickerIndex(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {noteEditIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Catatan Kalibrasi</h3>
              <p className="text-sm text-gray-500">Isi catatan untuk Sensor #{(noteEditIndex ?? 0) + 1}</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Traceable to SI Through</label>
                <input value={noteDraft.traceable_to_si_through} onChange={e=>setNoteDraft(prev=>({ ...prev, traceable_to_si_through: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Document</label>
                <input value={noteDraft.reference_document} onChange={e=>setNoteDraft(prev=>({ ...prev, reference_document: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calibration Methode</label>
                <input value={noteDraft.calibration_methode} onChange={e=>setNoteDraft(prev=>({ ...prev, calibration_methode: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Others</label>
                <textarea rows={3} value={noteDraft.others} onChange={e=>setNoteDraft(prev=>({ ...prev, others: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="sm:col-span-2 border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Instrumen Standar</h4>
                  <button type="button" className="px-3 py-1 text-sm border rounded-lg" onClick={() => setNoteDraft(prev => ({ ...prev, standardInstruments: [...(prev.standardInstruments||[]), null as any].filter(v=>true) }))}>Tambah Instrumen Standar</button>
                </div>
                <div className="space-y-2">
                  {(noteDraft.standardInstruments || []).map((sid, i) => {
                    const s = sensors.find(ss => ss.id === sid) as any
                    return (
                      <div key={i} className="flex items-center justify-between border rounded-md p-2 bg-orange-50">
                        <div className="text-sm">
                          <div className="font-medium">Standar #{i+1}</div>
                          <div className="text-gray-600">{s ? ((s.name || s.type || 'Sensor') + (s.serial_number ? ` — SN ${s.serial_number}` : '')) : 'Belum ada sensor dipilih.'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" className="px-3 py-1 text-sm border rounded-lg" onClick={() => setStandardPickerIndex(i)}>Pilih Sensor</button>
                          <button type="button" className="px-3 py-1 text-sm border rounded-lg" onClick={() => setNoteDraft(prev => ({ ...prev, standardInstruments: prev.standardInstruments.filter((_, idx) => idx !== i) }))}>Hapus</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={() => setNoteEditIndex(null)}>Batal</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => { if (noteEditIndex === null) return; updateResult(noteEditIndex, { notesForm: { ...noteDraft } }); setNoteEditIndex(null) }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Sensor Picker Modal (only show is_standard sensors) */}
      {standardPickerIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <input value={standardSearch} onChange={e=>setStandardSearch(e.target.value)} placeholder="Cari standar (nama / pabrikan / tipe / serial)" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="h-64 overflow-y-auto border rounded-lg p-2 mb-3">
              {sensors
                .filter(s => (s as any).is_standard)
                .filter(s => {
                  const q = standardSearch.toLowerCase()
                  return !q || `${(s as any).name||''} ${(s as any).manufacturer||''} ${(s as any).type||''} ${(s as any).serial_number||''}`.toLowerCase().includes(q)
                })
                .map(s => (
                  <button key={s.id} onClick={() => { 
                    if (standardPickerIndex === null) return;
                    setNoteDraft(prev => {
                      const arr = [...(prev.standardInstruments||[])]
                      arr[standardPickerIndex] = s.id as any
                      return { ...prev, standardInstruments: arr }
                    })
                    setStandardPickerIndex(null)
                  }} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg border-b">
                    <div className="font-medium">{(s as any).name || (s as any).type || 'Sensor'} — {(s as any).type || ''}</div>
                    <div className="text-xs text-gray-500">{(s as any).manufacturer || ''} • SN {(s as any).serial_number || '-'}</div>
                  </button>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={() => setStandardPickerIndex(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificatesCRUD
