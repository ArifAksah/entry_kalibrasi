'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import bmkgLogo from '../../../bmkg.png'
import { SuratKeteranganDocument } from '../../../../components/features/SuratKeteranganDocument'
import { assignmentDisplay } from '@/lib/document-assignment-display'

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draf', cls: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Menunggu Verifikasi', cls: 'bg-blue-100 text-blue-700' },
  verified: { label: 'Siap Ditandatangani', cls: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-700' },
}

const LETTER_ACTION_LABEL: Record<string, string> = {
  created: 'Dibuat',
  sent: 'Dikirim Ke Verifikator',
  approved_v1: 'Disetujui Verifikator 1',
  approved_v2: 'Disetujui Verifikator 2',
  approved_v3: 'Disetujui Verifikator 3',
  rejected_v1: 'Ditolak Verifikator 1',
  rejected_v2: 'Ditolak Verifikator 2',
  rejected_v3: 'Ditolak Verifikator 3',
  signed: 'Ditandatangani Penandatangan',
  completed: 'Selesai',
}

type TimelineEvent = {
  id: string
  action: string
  created_at: string
  performed_by_name: string
  notes?: string | null
}

export default function ViewLetterPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letter, setLetter] = useState<any>(null)
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [showTimeline, setShowTimeline] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const id = params?.id
        if (!id) throw new Error('Missing id')
        const lRes = await fetch(`/api/letters/${id}`)
        const l = await lRes.json()
        if (!lRes.ok) throw new Error(l.error || 'Failed to load letter')
        setLetter(l)

        const [iRes, sRes] = await Promise.all([
          fetch('/api/instruments?page=1&pageSize=1000'),
          fetch('/api/stations?page=1&pageSize=1000'),
        ])
        const [iData, sData] = await Promise.all([iRes.json(), sRes.json()])
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setStations(Array.isArray(sData) ? sData : (sData?.data ?? []))

        if (l.instrument) {
          const sensorRes = await fetch(`/api/instruments/${l.instrument}/sensors`)
          if (sensorRes.ok) {
            const sensorData = await sensorRes.json()
            const list = Array.isArray(sensorData) ? sensorData : (sensorData?.data ?? [])
            setSensors(
              list.map((sensor: any) => ({
                id: Number(sensor.id),
                name: sensor.nama_sensor ?? sensor.name ?? null,
                manufacturer: sensor.merk_sensor ?? sensor.manufacturer ?? null,
                type: sensor.tipe_sensor ?? sensor.type ?? null,
                serial_number: sensor.serial_number_sensor ?? sensor.serial_number ?? null,
              })),
            )
          }
        }
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params?.id])

  const instrument = useMemo(() => {
    const source =
      letter?.instrument_data ?? instruments.find((i) => Number(i.id) === Number(letter?.instrument))
    if (!source) return null
    return {
      name: source.name_alias || source.name || source.type || null,
      manufacturer: source.manufacturer || null,
      type: source.type || null,
      serial_number: source.serial_number || null,
      others: source.others || null,
    }
  }, [instruments, letter])
  const owner = useMemo(
    () => letter?.owner_data ?? stations.find((s) => Number(s.id) === Number(letter?.owner)) ?? null,
    [stations, letter],
  )
  const assignment = assignmentDisplay(letter?.document_assignment)
  const sensorSheets = useMemo(() => {
    const allResults = Array.isArray(letter?.results) ? letter.results : []
    const sensorList =
      Array.isArray(letter?.sensor_data_list) && letter.sensor_data_list.length
        ? letter.sensor_data_list
        : sensors
    const grouped = new Map<number, any[]>()
    for (const row of allResults) {
      if (row?.sensor_id == null) continue
      const sensorId = Number(row.sensor_id)
      if (!grouped.has(sensorId)) grouped.set(sensorId, [])
      grouped.get(sensorId)!.push(row)
    }
    return Array.from(grouped.entries()).map(([sensorId, sheetRows]) => ({
      sensor:
        sensorList.find((sensor: any) => Number(sensor.id) === sensorId) || {
          id: sensorId,
          name: `Sensor #${sensorId}`,
        },
      rows: sheetRows,
    }))
  }, [letter, sensors])
  const authorizedPerson = assignment.authorized || letter?.authorized_data || null
  const verifiedBy = assignment.verifiedBy.map((person: any) => person?.name).filter(Boolean) as string[]
  const checkedBy = assignment.checkedBy.map((person: any) => person?.name).filter(Boolean) as string[]
  const verifyUrl = useMemo(() => {
    if (!letter?.public_id) return null
    const base = (typeof window !== 'undefined' ? window.location.origin : '') || ''
    return `${base}/verify-surat/${letter.public_id}`
  }, [letter?.public_id])
  const signed = Boolean(letter?.signed_at)

  // Linimasa dibaca dari tabel letter_logs (sama seperti sertifikat).
  const [timelineLogs, setTimelineLogs] = useState<TimelineEvent[]>([])
  useEffect(() => {
    if (!letter?.id) return
    fetch(`/api/letter-logs?letter_id=${letter.id}&pageSize=100`)
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.data) ? data.data : []
        setTimelineLogs(
          rows
            .map((log: any): TimelineEvent => ({
              id: String(log.id),
              action: String(log.action),
              created_at: log.created_at,
              performed_by_name: log.performed_by_name || 'Pengguna',
              notes: log.notes || log.approval_notes || log.rejection_reason || null,
            }))
            .sort(
              (a: TimelineEvent, b: TimelineEvent) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            ),
        )
      })
      .catch((err) => console.error('Failed to load letter logs', err))
  }, [letter?.id])

  if (loading) return <div className="p-6 text-gray-600">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!letter) return <div className="p-6 text-gray-600">Not found</div>

  const statusInfo = STATUS_INFO[String(letter.status || 'draft').toLowerCase()] || {
    label: letter.status || 'Draf',
    cls: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-12 pt-16 print:bg-white print:pb-0 print:pt-0 print:m-0 print:block">
      {/* Header */}
      <div className="w-full bg-white shadow-sm border-b absolute top-0 left-0 right-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center min-w-0">
              <Image src={bmkgLogo} alt="BMKG" width={40} height={40} className="mr-3" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Surat Keterangan</h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500 truncate">
                    {letter.no_letter || '-'} • Order {letter.no_order || '-'}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowTimeline((value) => !value)}
                className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                {showTimeline ? 'Sembunyikan Linimasa' : 'Tampilkan Linimasa'}
              </button>
              {String(letter.status || 'draft').toLowerCase() === 'draft' && (
                <a
                  href={`/letters/${letter.id}/edit`}
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Edit
                </a>
              )}
              <a
                href={`/letters/${letter.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Print
              </a>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 px-4 sm:px-6 lg:px-8 items-start print:block print:m-0 print:p-0 print:px-0 print:mt-0">
        {/* Sidebar Linimasa (tidak ikut tercetak) */}
        {showTimeline && (
        <div className="w-full md:w-80 flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-6 self-start sticky top-20 print:hidden">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6 border-b pb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Linimasa Surat Keterangan
          </h3>
          {timelineLogs.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-semibold text-gray-700">Belum Ada History / Linimasa</p>
              <p className="text-xs mt-1">Surat ini belum memiliki catatan aktivitas.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
              {timelineLogs.map((log) => {
                const isRejected = log.action.includes('reject')
                const color = isRejected ? 'bg-red-500' : 'bg-green-500'
                const dateObj = new Date(log.created_at)
                const time =
                  dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                const date = dateObj.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
                return (
                  <div key={log.id} className="relative mb-6 last:mb-0 ml-4">
                    <div
                      className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white ${color} shadow-sm z-10`}
                    ></div>
                    <div className="text-[10px] font-bold text-gray-500 mb-0.5">{date}</div>
                    <div className="text-xs font-bold text-gray-900 mb-1">
                      {LETTER_ACTION_LABEL[log.action] || log.action}
                    </div>
                    <div className="text-[10px] bg-gray-100/50 text-gray-500 px-2 py-0.5 rounded inline-block mb-1">
                      {time}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1 leading-relaxed capitalize">
                      {log.performed_by_name}
                    </div>
                    {log.notes && (
                      <div className="text-[10px] italic text-gray-500 mt-1 border-l-2 border-gray-200 pl-2">
                        "{log.notes}"
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* Dokumen surat */}
        <div className="flex-1 w-full flex justify-center print:block print:w-full">
          <SuratKeteranganDocument
            letter={letter}
            results={Array.isArray(letter.results) ? letter.results : []}
            instrument={instrument}
            sensor={instrument}
            owner={owner}
            authorized={{ name: authorizedPerson?.name || null, title: authorizedPerson?.signer_title || null }}
            checkedBy={checkedBy}
            verifiedBy={verifiedBy}
            totalPages={2}
            verifyUrl={verifyUrl}
            signed={signed}
            sensorSheets={sensorSheets}
          />
        </div>
      </div>
    </div>
  )
}
