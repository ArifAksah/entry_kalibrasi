import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { validateLetterSigningReadiness } from '@/lib/letter-signing-readiness'
import { fetchLetterResults } from '@/lib/letter-service'
import { createLetterLog } from '@/lib/letter-log-helper'

const signingLocks = new Map<string, boolean>()

/**
 * POST /api/letter-verification/sign-level-3
 * Penandatanganan final Surat Keterangan oleh Penandatangan (level 4).
 */
export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  let lockKey: string | undefined
  try {
    const body = await request.json()
    const letterId = Number(body?.letter_id)
    const passphrase = typeof body?.passphrase === 'string' ? body.passphrase : ''
    if (!Number.isInteger(letterId)) {
      return NextResponse.json({ error: 'letter_id wajib diisi' }, { status: 400 })
    }

    const { data: letter } = await supabaseAdmin
      .from('letter')
      .select('id, status, no_letter, public_id, authorized_by, version, pdf_path')
      .eq('id', letterId)
      .maybeSingle()
    if (!letter) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

    // TTE terikat pada sertifikat elektronik orang yang menekan tombol, jadi
    // hanya penandatangan yang ditugaskan yang boleh menandatangani.
    if (letter.authorized_by !== caller.user.id) {
      return NextResponse.json(
        { error: 'Hanya penandatangan yang ditugaskan pada Surat Keterangan ini yang dapat menandatangani' },
        { status: 403 },
      )
    }

    if (letter.status !== 'verified' && letter.status !== 'sent') {
      return NextResponse.json(
        { error: 'Surat Keterangan belum selesai diverifikasi Verifikator 1-3' },
        { status: 400 },
      )
    }

    const version = letter.version || 1
    const { data: levels } = await supabaseAdmin
      .from('letter_verification')
      .select('verification_level, status')
      .eq('letter_id', letterId)
      .eq('letter_version', version)
    const approvedLevels = new Set(
      (levels || [])
        .filter((row: any) => row.status === 'approved')
        .map((row: any) => Number(row.verification_level)),
    )
    const allVerifiersApproved = [1, 2, 3].every((lvl) => approvedLevels.has(lvl))
    if (!allVerifiersApproved) {
      return NextResponse.json(
        { error: 'Surat Keterangan belum disetujui Verifikator 1, 2, dan 3' },
        { status: 400 },
      )
    }

    const results = await fetchLetterResults(letterId)
    const readiness = validateLetterSigningReadiness(letter, results.length)
    if (!readiness.ready) {
      return NextResponse.json({ error: readiness.message, code: readiness.code }, { status: 400 })
    }

    lockKey = `letter:${letterId}`
    if (signingLocks.get(lockKey)) {
      return NextResponse.json({ error: 'Proses penandatanganan sedang berjalan' }, { status: 409 })
    }
    signingLocks.set(lockKey, true)

    const isMock = (process.env.BSRE_MOCK || '').toLowerCase() === 'true'
    let signed = false
    let pdfPath: string | undefined = letter.pdf_path ?? undefined

    // Tanggal Terbit (issue_date) diisi OTOMATIS saat TTE — tidak diinput manual,
    // sama seperti sertifikat. Diset SEBELUM PDF dibuat agar ikut ter-render, dan
    // dikembalikan ke null bila penandatanganan gagal.
    const setLetterIssueDate = async () => {
      const issueDate = new Date().toISOString().split('T')[0]
      const { error } = await supabaseAdmin
        .from('letter')
        .update({ issue_date: issueDate })
        .eq('id', letterId)
      if (error) {
        console.warn(`[letter sign] Gagal menyetel issue_date: ${error.message}`)
      }
    }
    const revertLetterIssueDate = async () => {
      await supabaseAdmin.from('letter').update({ issue_date: null }).eq('id', letterId)
    }

    if (isMock) {
      const mockPassphrase = process.env.BSRE_MOCK_PASSPHRASE || 'demo123'
      if (passphrase !== mockPassphrase) {
        signingLocks.delete(lockKey)
        return NextResponse.json(
          { error: 'Passphrase TTE salah atau tidak valid.', code: 'INVALID_PASSPHRASE' },
          { status: 400 },
        )
      }
      await setLetterIssueDate()
      const { generateAndSaveLetterPDF } = await import('@/lib/letter-pdf-helper')
      const result = await generateAndSaveLetterPDF(letterId, caller.user.id, undefined, true)
      if (!result.success) {
        await revertLetterIssueDate()
        signingLocks.delete(lockKey)
        return NextResponse.json({ error: result.error || 'Gagal menyiapkan PDF Surat Keterangan' }, { status: 500 })
      }
      pdfPath = result.pdfPath
      signed = true
    } else {
      await setLetterIssueDate()
      const { generateAndSaveLetterPDF } = await import('@/lib/letter-pdf-helper')
      const result = await generateAndSaveLetterPDF(letterId, caller.user.id, passphrase, false)
      if (!result.success || result.signed !== true) {
        await revertLetterIssueDate()
        signingLocks.delete(lockKey)
        const message =
          result.error ||
          (result.success && result.signed !== true
            ? 'Layanan TTE (BSrE) belum dikonfigurasi pada server. Hubungi administrator.'
            : 'Gagal menandatangani PDF Surat Keterangan')
        return NextResponse.json({ error: message }, { status: 500 })
      }
      pdfPath = result.pdfPath
      signed = true
    }

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('letter_verification')
      .update({
        status: 'approved',
        signed_at: now,
        updated_at: now,
      })
      .eq('letter_id', letterId)
      .eq('verification_level', 4)
      .eq('letter_version', version)

    const { error: updateError } = await supabaseAdmin
      .from('letter')
      .update({
        status: 'completed',
        completed_at: now,
        signed_at: now,
        pdf_path: pdfPath ?? null,
      })
      .eq('id', letterId)
    if (updateError) {
      signingLocks.delete(lockKey)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await createLetterLog({
      letter_id: letterId,
      action: 'signed',
      performed_by: caller.user.id,
      verification_level: 4,
      previous_status: 'verified',
      new_status: 'completed',
      notes: 'Ditandatangani secara elektronik (TTE)',
    })

    signingLocks.delete(lockKey)
    return NextResponse.json({ success: true, signed, status: 'completed', pdf_path: pdfPath })
  } catch (error: any) {
    if (lockKey) signingLocks.delete(lockKey)
    console.error('[letter sign] error:', error)
    return NextResponse.json({ error: error?.message || 'Gagal menandatangani Surat Keterangan' }, { status: 500 })
  }
}
