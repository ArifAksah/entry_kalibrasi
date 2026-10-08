'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SuratKeteranganDocument } from '../../../../components/features/SuratKeteranganDocument'
import { assignmentDisplay } from '@/lib/document-assignment-display'

export default function PrintLetterPage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letter, setLetter] = useState<any>(null)
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [sensors, setSensors] = useState<any[]>([])

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
  const isPdfRender =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('pdf') === 'true'

  useEffect(() => {
    if (!loading && letter && isPdfRender && typeof document !== 'undefined') {
      document.body.dataset.printDataReady = 'true'
    }
  }, [loading, letter, isPdfRender])

  if (loading) return <div className="p-6 text-gray-600">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!letter) return <div className="p-6 text-gray-600">Not found</div>

  return (
    <div>
      {!isPdfRender && (
      <div
        className="sk-no-print"
        style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e5e7eb' }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', padding: '8px 16px' }}>
          <div className="text-sm text-gray-700">Pratinjau Surat Keterangan</div>
          <div className="space-x-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Print
            </button>
            <a
              href={`/letters/${letter.id}/view`}
              className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
            >
              Kembali
            </a>
          </div>
        </div>
      </div>
      )}

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
  )
}
