'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SuratKeteranganDocument } from '../../../../components/features/SuratKeteranganDocument'

export default function PrintLetterPage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letter, setLetter] = useState<any>(null)
  const [instruments, setInstruments] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [personel, setPersonel] = useState<any[]>([])
  const [orderPersonnel, setOrderPersonnel] = useState<any[]>([])

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

        const [iRes, sRes, pRes] = await Promise.all([
          fetch('/api/instruments?page=1&pageSize=1000'),
          fetch('/api/stations?page=1&pageSize=1000'),
          fetch('/api/personel'),
        ])
        const [iData, sData, pData] = await Promise.all([
          iRes.json(),
          sRes.json(),
          pRes.json(),
        ])
        setInstruments(Array.isArray(iData) ? iData : (iData?.data ?? []))
        setStations(Array.isArray(sData) ? sData : (sData?.data ?? []))
        setPersonel(Array.isArray(pData) ? pData : [])

        if (l.calibration_order_id) {
          const oRes = await fetch(`/api/calibration-orders/${l.calibration_order_id}`)
          if (oRes.ok) {
            const o = await oRes.json()
            const team = o?.data?.personnel || o?.personnel || []
            setOrderPersonnel(Array.isArray(team) ? team : [])
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

  const instrument = useMemo(
    () => instruments.find((i) => Number(i.id) === Number(letter?.instrument)) || null,
    [instruments, letter],
  )
  const owner = useMemo(
    () => stations.find((s) => Number(s.id) === Number(letter?.owner)) || null,
    [stations, letter],
  )
  const findPerson = (uid?: string | null) => personel.find((p) => p.id === uid) || null
  const authorizedPerson = findPerson(letter?.authorized_by)
  const verifiedBy = [letter?.verifikator_1, letter?.verifikator_2, letter?.verifikator_3]
    .map((uid) => findPerson(uid)?.name)
    .filter(Boolean) as string[]
  const checkedBy = (orderPersonnel.length
    ? orderPersonnel.map((r: any) => r.personel?.name || r.name).filter(Boolean)
    : [authorizedPerson?.name].filter(Boolean)) as string[]

  if (loading) return <div className="p-6 text-gray-600">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!letter) return <div className="p-6 text-gray-600">Not found</div>

  return (
    <div>
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

      <SuratKeteranganDocument
        letter={letter}
        results={Array.isArray(letter.results) ? letter.results : []}
        instrument={instrument}
        owner={owner}
        authorized={{ name: authorizedPerson?.name || null, title: authorizedPerson?.signer_title || null }}
        checkedBy={checkedBy}
        verifiedBy={verifiedBy}
        totalPages={2}
      />
    </div>
  )
}
