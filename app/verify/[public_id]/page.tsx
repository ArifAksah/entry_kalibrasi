'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

type PublicPerson = {
  name: string
} | null

type PublicCertificateResponse = {
  valid: boolean
  source: {
    system: string
    name: string
    owner: string
    statement: string
  }
  certificate: {
    no_certificate: string
    no_identification?: string | null
    issue_date?: string | null
    status?: string | null
    status_label?: string | null
    station_name?: string | null
    instrument_name?: string | null
  }
  signature: {
    signed: boolean
    provider?: string | null
    signed_at?: string | null
    signer: PublicPerson
  }
}

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {})
  }).format(date)
}

const personName = (person: PublicPerson) => person?.name || '-'

const statusTone = (status?: string | null) => {
  if (status === 'approved' || status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'pending' || status === 'sent') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function PublicVerificationPage() {
  const params = useParams()
  const publicId = params.public_id as string

  const [data, setData] = useState<PublicCertificateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!publicId) return

      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/public/certificates/${encodeURIComponent(publicId)}`, { cache: 'no-store' })

        if (!response.ok) {
          if (response.status === 404) throw new Error('Sertifikat tidak ditemukan')
          throw new Error('Gagal memuat data sertifikat')
        }

        setData(await response.json())
      } catch (err: any) {
        setError(err?.message || 'Gagal memuat data sertifikat')
      } finally {
        setLoading(false)
      }
    }

    fetchCertificate()
  }, [publicId])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Memeriksa data sertifikat SIMKAL...</p>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <section className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sertifikat Tidak Ditemukan</h1>
          <p className="text-slate-600 mb-6">{error || 'Data sertifikat tidak dapat ditemukan atau URL tidak valid.'}</p>
          <p className="text-xs text-slate-500 break-all">ID QR: {publicId}</p>
        </section>
      </main>
    )
  }

  const { certificate, signature, source } = data

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 via-teal-900 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-teal-200 text-sm font-semibold tracking-wide uppercase">{source.system}</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-2">{source.name}</h1>
              <p className="text-slate-200 mt-3 max-w-2xl">{source.statement}</p>
            </div>
            <Image src="/logo_bmkg.png" alt="BMKG" width={64} height={64} className="shrink-0" />
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className={`px-5 py-4 border-b ${signature.signed ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${signature.signed ? 'bg-white text-emerald-700 border-emerald-200' : 'bg-white text-amber-700 border-amber-200'}`}>
                  {signature.signed ? 'Sertifikat sudah ditandatangani elektronik' : 'Sertifikat tercatat di SIMKAL'}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-3">{certificate.no_certificate || '-'}</h2>
                <p className="text-sm text-slate-600">Nomor Sertifikat</p>
              </div>
              <div className="text-sm text-slate-700 md:text-right">
                <p>Status dokumen</p>
                <p className={`inline-flex mt-1 px-2.5 py-1 rounded-full border font-semibold ${statusTone(certificate.status || undefined)}`}>
                  {certificate.status_label || certificate.status || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Identifikasi Alat" value={certificate.no_identification || '-'} />
              <Info label="Instrumen" value={certificate.instrument_name || '-'} />
              <Info label="Stasiun / Lokasi" value={certificate.station_name || '-'} />
              <Info label="Tanggal Terbit" value={formatDate(certificate.issue_date)} />
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Status Tanda Tangan Elektronik</h3>
              {signature.signed ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Info label="Penyedia TTE" value={signature.provider || 'BSrE'} />
                  <Info label="Penandatangan" value={personName(signature.signer)} />
                  <Info label="Tanggal Penandatanganan" value={formatDate(signature.signed_at, true)} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Sertifikat ini berasal dari SIMKAL dan sudah memiliki rekam data penerbitan/verifikasi di sistem.
                  Tanda tangan elektronik BSrE belum tercatat sebagai final pada dokumen ini.
                </p>
              )}
            </div>

            <div className="text-center border-t border-slate-200 pt-5">
              <p className="text-xs text-slate-500">
                Halaman ini adalah tautan publik dari QR code sertifikat SIMKAL. Informasi sensitif seperti NIK dan passphrase tidak ditampilkan.
              </p>
              <p className="text-xs text-slate-400 mt-1 break-all">Public ID: {publicId}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1 break-words">{value}</p>
    </div>
  )
}
