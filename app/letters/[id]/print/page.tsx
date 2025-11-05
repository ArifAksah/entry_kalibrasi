'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import bmkgLogo from '../../../bmkg.png'

// Basic types (aligned with lib/supabase.ts and existing APIs)
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

type Station = { id: number; name: string; station_id: string; address?: string | null }
type Instrument = { id: number; name?: string; type?: string; manufacturer?: string; serial_number?: string }
type Personel = { id: string; name: string | null }

const PrintLetterPage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [letter, setLetter] = useState<Letter | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [personel, setPersonel] = useState<Personel[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const id = params?.id
        if (!id) throw new Error('Missing id')
        const [lRes, stRes, iRes, pRes] = await Promise.all([
          fetch(`/api/letters/${id}`),
          fetch('/api/stations'),
          fetch('/api/instruments'),
          fetch('/api/personel'),
        ])
        const [lData, stData, iData, pData] = await Promise.all([
          lRes.json(), stRes.json(), iRes.json(), pRes.json()
        ])
        if (!lRes.ok) throw new Error(lData.error || 'Failed to load letter')
        setLetter(lData)
        setStations(Array.isArray(stData) ? stData : [])
        setInstruments(Array.isArray(iData) ? iData : [])
        setPersonel(Array.isArray(pData) ? pData : [])
        setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params?.id])

  const station = useMemo(() => stations.find(s => s.id === (letter?.owner ?? -1)) || null, [stations, letter?.owner])
  const instrument = useMemo(() => instruments.find(i => i.id === (letter?.instrument ?? -1)) || null, [instruments, letter?.instrument])
  const authorized = useMemo(() => personel.find(p => p.id === (letter?.authorized_by ?? '')) || null, [personel, letter?.authorized_by])
  const verificationNames = useMemo(() => {
    const arr: string[] = Array.isArray((letter as any)?.verification) ? (letter as any).verification : []
    return arr.map((id: string) => personel.find(p => p.id === id)?.name || id)
  }, [personel, letter])
  const inspectionHeader = useMemo(() => ((letter as any)?.inspection_payload?.header) || {}, [letter])
  const inspectionItems = useMemo(() => Array.isArray((letter as any)?.inspection_payload?.items) ? (letter as any).inspection_payload.items : [], [letter])
  const approvalDate = useMemo(() => new Date().toLocaleDateString(), [])

  const formattedIssueDate = useMemo(() => {
    if (!letter?.issue_date) return '-'
    try { return new Date(letter.issue_date).toLocaleDateString() } catch { return letter.issue_date }
  }, [letter?.issue_date])

  if (loading) return <div className="p-6 text-gray-600">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!letter) return <div className="p-6 text-gray-600">Not found</div>

  return (
    <div className="print-wrapper">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { box-shadow: none !important; margin: 0 !important; }
        }
        body { background: #f5f6f8; }
        .toolbar { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #e5e7eb; }
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 16px auto;
          background: #fff;
          color: #000;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          position: relative;
        }
        .page-inner {
          padding: 18mm 20mm 28mm 20mm; /* top right bottom left */
          box-sizing: border-box;
        }
        .header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 8mm;
          border-bottom: 2px solid #222; padding-bottom: 6mm;
        }
        .header-title { font-weight: 700; font-size: 18px; letter-spacing: 0.5px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 8mm; font-size: 12px; }
        .label { color: #374151; }
        .value { color: #111827; font-weight: 600; }
        .section-title { font-weight: 700; font-size: 13px; margin: 14px 0 8px; }
        .table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .table th, .table td { border: 1px solid #111; padding: 6px 8px; vertical-align: top; }
        .sign-block { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 18mm; }
        .sign-card { border: 1px solid #111; padding: 12px; min-height: 42mm; }
        .sign-label { font-size: 12px; color: #374151; }
        .sign-name { margin-top: 18mm; font-weight: 700; text-decoration: underline; }
        .footer { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; font-size: 11px; color: #374151; }
      `}</style>

      <div className="toolbar no-print">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
          <div className="text-sm text-gray-700">Letter Preview</div>
          <div className="space-x-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">Print</button>
            <a href={`/letters/${letter.id}/view`} className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200">Back to View</a>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="page-inner">
          {/* Header */}
          <div className="header">
            <Image src={bmkgLogo} alt="Logo" width={56} height={56} />
            <div>
              <div className="header-title">SURAT KETERANGAN</div>
              <div style={{ fontSize: 12, color: '#374151' }}>Badan Meteorologi, Klimatologi, dan Geofisika</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12 }}>
              <div className="label">No. Letter</div>
              <div className="value">{letter.no_letter}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="meta-grid">
            <div>
              <div className="label">Tanggal Terbit</div>
              <div className="value">{formattedIssueDate}</div>
            </div>
            <div>
              <div className="label">Pemilik (Stasiun)</div>
              <div className="value">{station ? `${station.name} (${station.station_id})` : '-'}</div>
            </div>
            <div>
              <div className="label">Instrumen</div>
              <div className="value">{instrument ? `${instrument.type ?? instrument.name ?? 'Instrument'}${instrument.serial_number ? ` (${instrument.serial_number})` : ''}` : '-'}</div>
            </div>
            <div>
              <div className="label">Hasil Pemeriksaan (ID)</div>
              <div className="value">{letter.inspection_result ?? '-'}</div>
            </div>
          </div>

          {/* Inspection Header */}
          <div>
            <div className="section-title">Detail Pemeriksaan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
              <div>
                <div className="label">Tanggal Pemeriksaan</div>
                <div className="value">{(inspectionHeader as any)?.tanggal_pemeriksaan || '-'}</div>
              </div>
              <div>
                <div className="label">Tempat Pemeriksaan</div>
                <div className="value">{station?.name || (inspectionHeader as any)?.tempat_pemeriksaan || '-'}</div>
              </div>
              <div>
                <div className="label">Diperiksa Oleh</div>
                <div className="value">{(inspectionHeader as any)?.diperiksa_oleh || '-'}</div>
              </div>
            </div>
          </div>

          {/* Inspection Items */}
          {inspectionItems?.length ? (
            <div style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Pemeriksaan</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionItems.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td>{it?.pemeriksaan || '-'}</td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{it?.keterangan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Verification list */}
          <div style={{ marginTop: 12 }}>
            <div className="section-title">Verifikasi</div>
            <div style={{ fontSize: 12 }}>{verificationNames.length ? verificationNames.join(', ') : '-'}</div>
          </div>

          {/* Statement */}
          <div>
            <div className="section-title">Pernyataan</div>
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              Dengan ini menyatakan bahwa peralatan sebagaimana tersebut di atas telah diperiksa/ditinjau
              dan memenuhi persyaratan sesuai ketentuan yang berlaku. Surat keterangan ini diterbitkan sebagai
              referensi administrasi internal.
            </p>
          </div>

          {/* Signature block */}
          <div className="sign-block">
            <div className="sign-card">
              <div className="sign-label">Dibuat oleh</div>
              <div className="sign-name">&nbsp;</div>
            </div>
            <div className="sign-card">
              <div className="sign-label">Pengesahan</div>
              <div style={{ fontSize: 12, color: '#374151' }}>Direktur Instrumentasi dan Kalibrasi BMKG</div>
              <div className="sign-name">{(letter as any)?.approver_name || '-'}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>Tanggal: {approvalDate}</div>
            </div>
          </div>

          <div className="footer">
            <div>Dokumen ini dicetak secara otomatis dari sistem. Valid tanpa tanda tangan basah.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrintLetterPage
