'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Loading'
import Card from '../../../components/ui/Card'
import Table from '../../../components/ui/Table'
import Breadcrumb from '../../../components/ui/Breadcrumb'

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
  sent_by?: string | null
  sent_to_verifiers_at?: string | null
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
  const [rejectLevel, setRejectLevel] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approveTarget, setApproveTarget] = useState<LetterRow | null>(null)
  const [approveLevel, setApproveLevel] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [personel, setPersonel] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/personel')
      .then((res) => res.json())
      .then((data) => setPersonel(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => {})
  }, [])

  const personName = (id?: string | null) =>
    personel.find((p) => String(p.id) === String(id))?.name || (id ? 'Pengguna' : '-')

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

  // Surat Keterangan punya tiga langkah verifikasi berurutan: Verifikator 1 → 2 → 3.
  const isAssignedVerifikator = useCallback(
    (letter: LetterRow): boolean => {
      if (!user?.id) return false
      return [letter.verifikator_1, letter.verifikator_2, letter.verifikator_3].includes(user.id)
    },
    [user?.id],
  )

  const verifikatorForLevel = (letter: LetterRow, level: number): string | null =>
    level === 1 ? letter.verifikator_1 : level === 2 ? letter.verifikator_2 : level === 3 ? letter.verifikator_3 : null

  const levelStatus = (letter: LetterRow, level: number): string =>
    letter.verifications?.find((row) => row.verification_level === level)?.status || 'pending'

  /** Level yang menjadi giliran pemanggil (dan sudah boleh diproses). */
  const actionableLevel = useCallback(
    (letter: LetterRow): number | null => {
      if (!user?.id) return null
      const mine = [1, 2, 3].find((lvl) => verifikatorForLevel(letter, lvl) === user.id)
      if (!mine) return null
      if (letter.verifications?.find((row) => row.verification_level === mine)?.status !== 'pending') return null
      if (mine > 1 && (letter.verifications?.find((row) => row.verification_level === mine - 1)?.status || 'pending') !== 'approved') {
        return null
      }
      return mine
    },
    [user?.id],
  )

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

  const filteredLetters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return visibleLetters
    return visibleLetters.filter((letter) => {
      const haystack = [letter.no_letter, letter.no_order, letter.no_identification, letter.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [visibleLetters, searchQuery])

  const lettersPerPage = 10

  // Kembali ke halaman 1 saat pencarian berubah.
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredLetters.length / lettersPerPage))
  const indexOfLast = currentPage * lettersPerPage
  const indexOfFirst = indexOfLast - lettersPerPage
  const pageLetters = useMemo(
    () => filteredLetters.slice(indexOfFirst, indexOfLast),
    [filteredLetters, indexOfFirst, indexOfLast],
  )
  const pageNumbers = useMemo(() => {
    const windowSize = 5
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2))
    const end = Math.min(totalPages, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    const nums: number[] = []
    for (let p = start; p <= end; p += 1) nums.push(p)
    return nums
  }, [currentPage, totalPages])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  const paginate = (pageNumber: number) =>
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)))

  const approve = async (letter: LetterRow, level: number) => {
    setActingId(letter.id)
    try {
      const response = await fetch('/api/letter-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter_id: letter.id, verification_level: level, action: 'approve' }),
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
          verification_level: rejectLevel,
          action: 'reject',
          reason: rejectReason,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Gagal menolak')
      showSuccess('Surat Keterangan dikembalikan untuk revisi')
      setRejectTarget(null)
      setRejectLevel(null)
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
      // Baca mentah dulu: bila server membalas non-JSON (mis. halaman error HTML),
      // jangan biarkan parse meledak — tetap tampilkan pesan yang jelas.
      const raw = await response.text()
      let json: any = {}
      try {
        json = raw ? JSON.parse(raw) : {}
      } catch {
        json = {}
      }
      if (!response.ok) {
        throw new Error(json?.error || `Gagal menandatangani (HTTP ${response.status})`)
      }
      if (json?.success === false) {
        throw new Error(json?.error || 'Gagal menandatangani')
      }
      setSignSuccess(true)
      await load()
      setTimeout(() => {
        setSignTarget(null)
        setSignSuccess(false)
        setPassphrase('')
      }, 1500)
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message
          ? caught.message
          : 'Gagal menandatangani dokumen'
      setSignError(message)
    } finally {
      setSigning(false)
      // Passphrase BSrE bersifat SEKALI PAKAI — jangan disimpan/di-cache setelah
      // satu percobaan (berhasil maupun gagal); petugas harus memasukkannya lagi.
      setPassphrase('')
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

      <div className="flex justify-between items-center">
        <Breadcrumb
          items={
            mode === 'verify'
              ? [{ label: 'Verifikasi', href: '#' }, { label: 'Verifikasi Surat' }]
              : [{ label: 'Penandatanganan', href: '#' }, { label: 'Penandatanganan Surat' }]
          }
        />
      </div>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {mode === 'verify'
              ? 'Surat Keterangan yang Ditugaskan kepada Anda'
              : 'Surat Keterangan untuk Ditandatangani'}
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Cari nomor surat, order, identifikasi, atau status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Hapus pencarian"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <Table
          headers={
            mode === 'verify'
              ? ['Nomor Surat', 'Pengirim', 'Tahap Verifikasi', 'Aksi']
              : ['Nomor Surat', 'Pengirim', 'Status', 'Aksi']
          }
        >
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center">
                <Spinner />
              </td>
            </tr>
          ) : filteredLetters.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                {searchQuery ? 'Tidak ada surat yang sesuai pencarian' : 'Tidak ada Surat Keterangan untuk Anda.'}
              </td>
            </tr>
          ) : (
            pageLetters.map((letter) => (
              <tr key={letter.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {letter.no_letter || `Surat #${letter.id}`}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-900">{personName(letter.sent_by)}</span>
                    {letter.sent_to_verifiers_at && (
                      <span className="text-xs text-gray-500">
                        Dikirim{' '}
                        {new Date(letter.sent_to_verifiers_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {mode === 'verify' ? (
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {[1, 2, 3].map((lvl) => {
                        const status = levelStatus(letter, lvl)
                        return (
                          <span
                            key={lvl}
                            className={`rounded border px-2 py-0.5 ${
                              status === 'approved'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : status === 'rejected'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}
                          >
                            V{lvl}: {VERIFICATION_LABEL[status] || status}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {STATUS_LABEL[letter.status] || letter.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`/letters/${letter.id}/view`, '_blank')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      Lihat Surat
                    </button>

                    {mode === 'verify' && actionableLevel(letter) !== null && (
                      <>
                        <button
                          type="button"
                          disabled={actingId === letter.id}
                          onClick={() => {
                            setApproveLevel(actionableLevel(letter))
                            setApproveTarget(letter)
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          disabled={actingId === letter.id}
                          onClick={() => {
                            setRejectLevel(actionableLevel(letter))
                            setRejectReason('')
                            setRejectTarget(letter)
                          }}
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
                </td>
              </tr>
            ))
          )}
        </Table>

        {!loading && filteredLetters.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Menampilkan <span className="font-medium">{indexOfFirst + 1}</span> sampai{' '}
              <span className="font-medium">{Math.min(indexOfLast, filteredLetters.length)}</span> dari{' '}
              <span className="font-medium">{filteredLetters.length}</span> hasil
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
              >
                ‹
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => paginate(p)}
                  className={`min-w-[34px] rounded-lg border px-3 py-1.5 text-sm ${
                    p === currentPage
                      ? 'border-[#1e377c] bg-[#1e377c] text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </Card>

      {approveTarget && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Konfirmasi Persetujuan</h3>
            <p className="mt-2 text-sm text-gray-700">
              Setujui{' '}
              <span className="font-semibold">
                {approveTarget.no_letter || `Surat #${approveTarget.id}`}
              </span>{' '}
              sebagai <span className="font-semibold">Verifikator {approveLevel}</span>?
            </p>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              {approveLevel === 3
                ? 'Setelah disetujui, Surat Keterangan siap ditandatangani (TTE). Perubahan hanya bisa lewat penolakan verifikator.'
                : `Setelah disetujui, surat diteruskan ke Verifikator ${(approveLevel ?? 0) + 1} untuk diverifikasi.`}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setApproveTarget(null)
                  setApproveLevel(null)
                }}
                disabled={actingId === approveTarget.id}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!approveTarget || approveLevel == null) return
                  await approve(approveTarget, approveLevel)
                  setApproveTarget(null)
                  setApproveLevel(null)
                }}
                disabled={actingId === approveTarget.id}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {actingId === approveTarget.id ? 'Memproses...' : 'Ya, Setujui'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                    // type="text" + mask via CSS: browser tidak mengira ini
                    // password akun (memicu prompt "Perbarui sandi" setelah TTE).
                    type="text"
                    name="bsre-signing-passphrase"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
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
                    disabled={signing}
                    autoFocus
                    placeholder="Masukkan passphrase"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed [-webkit-text-security:disc]"
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
