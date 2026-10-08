'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Loading'

type Mode = 'verify' | 'sign'

type Verification = {
  id: number
  verification_level: number
  status: string
  verified_by: string
  notes: string | null
}

type LetterRow = {
  id: number
  no_letter: string | null
  no_order: string | null
  no_identification: string | null
  status: string
  issue_date: string | null
  verifikator_1: string | null
  verifikator_2: string | null
  verifikator_3: string | null
  authorized_by: string | null
  pdf_path?: string | null
  signed_at: string | null
  verifications: Verification[]
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draf',
  sent: 'Menunggu Verifikasi',
  verified: 'Siap Ditandatangani',
  completed: 'Selesai',
  rejected: 'Ditolak',
}

const VERIFICATION_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

const LetterVerificationCRUD: React.FC<{ mode: Mode }> = ({ mode }) => {
  const { user } = useAuth()
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [letters, setLetters] = useState<LetterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [signTarget, setSignTarget] = useState<LetterRow | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [signing, setSigning] = useState(false)
  const [signSuccess, setSignSuccess] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<LetterRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/letter-verification')
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal memuat Surat Keterangan')
      setLetters(Array.isArray(json?.data) ? json.data : [])
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  // Surat Keterangan hanya punya satu langkah verifikasi: siapa pun dari
  // verifikator yang ditugaskan boleh menyetujuinya.
  const isAssignedVerifikator = useCallback(
    (letter: LetterRow): boolean => {
      if (!user?.id) return false
      return [letter.verifikator_1, letter.verifikator_2, letter.verifikator_3].includes(user.id)
    },
    [user?.id],
  )

  const verificationStatus = (letter: LetterRow) =>
    letter.verifications?.find((row) => row.verification_level === 1)?.status || 'pending'

  const visibleLetters = useMemo(() => {
    if (!user?.id) return []
    if (mode === 'verify') {
      // Surat yang sudah disetujui tetap ditampilkan (statusnya berubah jadi
      // "Disetujui"), bukan hilang — supaya verifikator bisa melihat riwayatnya.
      return letters.filter(
        (letter) =>
          ['sent', 'verified', 'completed'].includes(String(letter.status)) &&
          isAssignedVerifikator(letter),
      )
    }
    // Surat yang sudah ditandatangani tetap ditampilkan (status "Selesai"),
    // supaya penandatangan masih bisa melihat dan mengunduh dokumennya.
    return letters.filter(
      (letter) =>
        letter.authorized_by === user.id &&
        ['verified', 'completed'].includes(String(letter.status)),
    )
  }, [letters, mode, user?.id, isAssignedVerifikator])

  const approve = async (letter: LetterRow) => {
    setActingId(letter.id)
    try {
      const response = await fetch('/api/letter-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter_id: letter.id, verification_level: 1, action: 'approve' }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menyetujui')
      showSuccess(`Surat ${letter.no_letter || letter.id} disetujui`)
      await load()
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Gagal menyetujui')
    } finally {
      setActingId(null)
    }
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      showError('Alasan penolakan wajib diisi')
      return
    }
    setActingId(rejectTarget.id)
    try {
      const response = await fetch('/api/letter-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letter_id: rejectTarget.id,
          verification_level: 1,
          action: 'reject',
          reason: rejectReason,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menolak')
      showSuccess('Surat Keterangan dikembalikan untuk revisi')
      setRejectTarget(null)
      setRejectReason('')
      await load()
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Gagal menolak')
    } finally {
      setActingId(null)
    }
  }

  const sign = async () => {
    if (!signTarget) return
    if (!passphrase) {
      setSignError('Passphrase TTE wajib diisi')
      return
    }
    setSigning(true)
    setSignError(null)
    try {
      const response = await fetch('/api/letter-verification/sign-level-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter_id: signTarget.id, passphrase }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menandatangani')
      setSignSuccess(true)
      await load()
      setTimeout(() => {
        setSignTarget(null)
        setSignSuccess(false)
        setPassphrase('')
      }, 1500)
    } catch (caught) {
      setSignError(caught instanceof Error ? caught.message : 'Gagal menandatangani')
    } finally {
      setSigning(false)
    }
  }

  const closeSignModal = () => {
    if (signing) return
    setSignTarget(null)
    setPassphrase('')
    setSignError(null)
    setSignSuccess(false)
  }

  return (
    <div className="space-y-4">
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
          {mode === 'verify' ? 'Surat Keterangan untuk Verifikasi' : 'Surat Keterangan untuk Penandatanganan'}
        </div>
        {loading ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : visibleLetters.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">Tidak ada Surat Keterangan untuk Anda.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleLetters.map((letter) => {
              return (
                <div key={letter.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">{letter.no_letter || `Surat #${letter.id}`}</div>
                    <div className="text-xs text-gray-600">
                      Order {letter.no_order || '-'} • Identifikasi {letter.no_identification || '-'} •{' '}
                      {STATUS_LABEL[letter.status] || letter.status}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded border px-2 py-0.5 ${
                          verificationStatus(letter) === 'approved'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : verificationStatus(letter) === 'rejected'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        Verifikasi: {VERIFICATION_LABEL[verificationStatus(letter)] || verificationStatus(letter)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`/letters/${letter.id}/view`, '_blank')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      Lihat Surat
                    </button>

                    {mode === 'verify' && verificationStatus(letter) === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={actingId === letter.id}
                          onClick={() => approve(letter)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          disabled={actingId === letter.id}
                          onClick={() => setRejectTarget(letter)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Tolak
                        </button>
                      </>
                    )}

                    {mode === 'sign' && String(letter.status) === 'completed' ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Sudah ditandatangani
                        </span>
                        {letter.pdf_path && (
                          <a
                            href={`/api/letters/${letter.id}/pdf`}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                          >
                            Unduh PDF
                          </a>
                        )}
                      </div>
                    ) : mode === 'sign' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPassphrase('')
                          setSignError(null)
                          setSignSuccess(false)
                          setSignTarget(letter)
                        }}
                        className="rounded-lg bg-[#1e377c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162a60]"
                      >
                        Tandatangani
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-gray-900">Tolak Surat Keterangan</h3>
            <label className="mt-3 block text-xs font-semibold text-gray-700">
              Alasan
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitReject}
                disabled={actingId === rejectTarget.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
      {signTarget && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Penandatanganan Surat Keterangan</h3>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <span className="font-semibold">Surat:</span>{' '}
              {signTarget.no_letter || `Surat #${signTarget.id}`}
            </div>

            {signSuccess ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-emerald-800">Dokumen berhasil ditandatangani</p>
                  <p className="mt-1 text-xs text-slate-500">PDF lengkap telah dibuat dan disimpan. Daftar diperbarui.</p>
                </div>
              </div>
            ) : signError ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-red-800">Penandatanganan gagal</p>
                  <p className="mt-1 text-xs text-slate-600">{signError}</p>
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSignError(null)}
                    className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162a60]"
                  >
                    Coba Lagi
                  </button>
                  <button
                    type="button"
                    onClick={closeSignModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : signing ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-6">
                <Spinner size="xxl" tone="blue" label="Menyiapkan PDF" />
                <p className="text-sm font-semibold text-gray-800">Menyiapkan PDF bertanda tangan</p>
                <p className="text-xs font-medium text-amber-600">
                  Jangan menutup atau me-refresh halaman.
                </p>
              </div>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  Passphrase BSrE
                  <input
                    type="text"
                    name="bsre-signing-passphrase"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value)
                      setSignError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void sign()
                      }
                    }}
                    placeholder="Masukkan passphrase"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeSignModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={sign}
                    disabled={signing}
                    className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162a60] disabled:opacity-50"
                  >
                    Tandatangani
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LetterVerificationCRUD
