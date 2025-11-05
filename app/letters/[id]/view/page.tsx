"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

type Letter = {
  id: number
  created_at: string
  no_letter: string
  instrument: number | null
  owner: number | null
  issue_date: string | null
  inspection_result: number | null
  authorized_by: string | null
}

type Station = { id: number; name: string; station_id: string }
type Instrument = { id: number; name?: string; type?: string; manufacturer?: string; serial_number?: string }
type Personel = { id: string; name: string | null }

const ViewLetterPage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letter, setLetter] = useState<Letter | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])

  const station = useMemo(() => stations.find(s => s.id === (letter?.owner ?? -1)) || null, [stations, letter?.owner])
  const instrument = useMemo(() => instruments.find(i => i.id === (letter?.instrument ?? -1)) || null, [instruments, letter?.instrument])
  const authorized = useMemo(() => personel.find(p => p.id === (letter?.authorized_by ?? "")) || null, [personel, letter?.authorized_by])
  const verificationNames = useMemo(() => {
    const arr: string[] = Array.isArray((letter as any)?.verification) ? (letter as any).verification : []
    return arr.map((id: string) => personel.find(p => p.id === id)?.name || id)
  }, [personel, letter])
  const inspectionHeader = useMemo(() => ((letter as any)?.inspection_payload?.header) || {}, [letter])
  const inspectionItems = useMemo(() => Array.isArray((letter as any)?.inspection_payload?.items) ? (letter as any).inspection_payload.items : [], [letter])
  const approvalDate = useMemo(() => new Date().toLocaleDateString(), [])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const id = params?.id
        if (!id) throw new Error("Missing id")
        const [lRes, stRes, iRes, pRes] = await Promise.all([
          fetch(`/api/letters/${id}`),
          fetch("/api/stations"),
          fetch("/api/instruments"),
          fetch("/api/personel"),
        ])
        const [lData, stData, iData, pData] = await Promise.all([
          lRes.json(), stRes.json(), iRes.json(), pRes.json()
        ])
        if (!lRes.ok) throw new Error(lData.error || "Failed to load letter")
        setLetter(lData)
        setStations(Array.isArray(stData) ? stData : [])
        setInstruments(Array.isArray(iData) ? iData : [])
        setPersonel(Array.isArray(pData) ? pData : [])
        setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params?.id])

  if (loading) return <div className="p-6 text-gray-600">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!letter) return <div className="p-6 text-gray-600">Not found</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Letter</h1>
          <div className="space-x-2">
            <a
              href={`/letters/${letter.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Print
            </a>
            <button
              onClick={() => router.back()}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Back
            </button>
          </div>
        </div>

        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">No. Letter</div>
              <div className="text-gray-900">{letter.no_letter}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Issue Date</div>
              <div className="text-gray-900">{letter.issue_date || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Instrument</div>
              <div className="text-gray-900">{instrument ? `${instrument.manufacturer ? instrument.manufacturer + ' ' : ''}${instrument.type ?? instrument.name ?? "Instrument"}${instrument.serial_number ? ` (${instrument.serial_number})` : ""}` : "-"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Owner (Station)</div>
              <div className="text-gray-900">{station ? `${station.name} (${station.station_id})` : "-"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Authorized By</div>
              <div className="text-gray-900">{authorized?.name || authorized?.id || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Inspection Result ID</div>
              <div className="text-gray-900">{letter.inspection_result ?? "-"}</div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Inspection Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Tanggal Pemeriksaan</div>
                <div className="text-gray-900">{inspectionHeader?.tanggal_pemeriksaan || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">Tempat Pemeriksaan</div>
                <div className="text-gray-900">{station?.name || inspectionHeader?.tempat_pemeriksaan || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">Diperiksa Oleh</div>
                <div className="text-gray-900">{inspectionHeader?.diperiksa_oleh || '-'}</div>
              </div>
            </div>
            {inspectionItems?.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-3 py-2 text-left">Pemeriksaan</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionItems.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-3 py-2 align-top">{it?.pemeriksaan || '-'}</td>
                        <td className="border border-gray-300 px-3 py-2 align-top whitespace-pre-wrap">{it?.keterangan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Verifikasi</div>
            <div className="text-sm text-gray-900">{verificationNames.length ? verificationNames.join(', ') : '-'}</div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-semibold text-gray-900 mb-1">Pejabat Pengesahan</div>
            <div className="text-sm text-gray-700">Direktur Instrumentasi dan Kalibrasi BMKG</div>
            <div className="text-sm text-gray-900 mt-1">{(letter as any)?.approver_name || '-'}</div>
            <div className="text-sm text-gray-500">Tanggal Pengesahan: {approvalDate}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewLetterPage
