import { NextRequest, NextResponse } from 'next/server'
import { requireCaller, isAdminCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createLetterLog, LetterLogAction } from '@/lib/letter-log-helper'

const VERIFICATION_LEVELS = [1, 2, 3]
const levelVerifikatorField: Record<number, 'verifikator_1' | 'verifikator_2' | 'verifikator_3'> = {
  1: 'verifikator_1',
  2: 'verifikator_2',
  3: 'verifikator_3',
}

async function createNotification(userId: string | null | undefined, message: string, link: string) {
  if (!userId) return
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, message, link })
  } catch (error) {
    console.error('[letter-verification] gagal membuat notifikasi:', error)
  }
}

/** GET /api/letter-verification — daftar Surat yang ditugaskan ke pemanggil. */
export async function GET(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  let query = supabaseAdmin
    .from('letter')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdminCaller(caller)) {
    query = query.or(
      `verifikator_1.eq.${caller.user.id},verifikator_2.eq.${caller.user.id},verifikator_3.eq.${caller.user.id},authorized_by.eq.${caller.user.id}`,
    )
  }

  const { data: letters, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (letters || []).map((row: any) => row.id)
  const { data: verifications } = ids.length
    ? await supabaseAdmin.from('letter_verification').select('*').in('letter_id', ids)
    : { data: [] as any[] }

  return NextResponse.json({
    data: (letters || []).map((letter: any) => ({
      ...letter,
      verifications: (verifications || []).filter((row: any) => row.letter_id === letter.id),
    })),
  })
}

/** POST /api/letter-verification — setujui/tolak Surat pada level tertentu. */
export async function POST(request: NextRequest) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const body = await request.json()
  const letterId = Number(body?.letter_id)
  const level = Number(body?.verification_level)
  const action = String(body?.action || '')
  if (!Number.isInteger(letterId) || !VERIFICATION_LEVELS.includes(level) || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'letter_id, verification_level (1-3), dan action wajib diisi' }, { status: 400 })
  }

  const { data: letter } = await supabaseAdmin
    .from('letter')
    .select('id, status, no_letter, sent_by, verifikator_1, verifikator_2, verifikator_3, version')
    .eq('id', letterId)
    .maybeSingle()
  if (!letter) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

  // Verifikasi berjenjang: hanya Verifikator N yang ditugaskan yang boleh memproses level N.
  const assignedForLevel = (letter as any)[levelVerifikatorField[level]]
  if (assignedForLevel !== caller.user.id) {
    return NextResponse.json(
      { error: `Hanya Verifikator ${level} yang ditugaskan pada Surat Keterangan ini yang dapat memverifikasi level ini` },
      { status: 403 },
    )
  }
  if (!['sent', 'verified'].includes(String(letter.status))) {
    return NextResponse.json({ error: 'Surat Keterangan belum dikirim ke verifikator' }, { status: 400 })
  }

  const version = letter.version || 1
  const { data: verification } = await supabaseAdmin
    .from('letter_verification')
    .select('*')
    .eq('letter_id', letterId)
    .eq('verification_level', level)
    .eq('letter_version', version)
    .maybeSingle()
  if (!verification) {
    return NextResponse.json({ error: 'Data verifikasi level ini tidak ditemukan' }, { status: 404 })
  }
  if (verification.status !== 'pending') {
    return NextResponse.json({ error: 'Verifikasi level ini sudah diproses' }, { status: 400 })
  }

  // Urutan: level 2 hanya setelah level 1 disetujui, level 3 setelah level 2 disetujui.
  if (level > 1) {
    const { data: prevVerification } = await supabaseAdmin
      .from('letter_verification')
      .select('status')
      .eq('letter_id', letterId)
      .eq('verification_level', level - 1)
      .eq('letter_version', version)
      .maybeSingle()
    if (!prevVerification || prevVerification.status !== 'approved') {
      return NextResponse.json(
        { error: `Verifikator ${level} hanya dapat memverifikasi setelah Verifikator ${level - 1} menyetujui` },
        { status: 400 },
      )
    }
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    const { error } = await supabaseAdmin
      .from('letter_verification')
      .update({
        status: 'approved',
        verified_by: caller.user.id,
        notes: body?.notes || null,
        updated_at: now,
      })
      .eq('id', verification.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const isLastLevel = level === VERIFICATION_LEVELS[VERIFICATION_LEVELS.length - 1]
    const { error: letterError } = await supabaseAdmin
      .from('letter')
      .update({ status: isLastLevel ? 'verified' : 'sent' })
      .eq('id', letterId)
    if (letterError) return NextResponse.json({ error: letterError.message }, { status: 400 })

    if (isLastLevel) {
      await createNotification(
        letter.sent_by,
        `Surat Keterangan ${letter.no_letter || letterId} disetujui dan siap ditandatangani`,
        `/letters/${letterId}/view`,
      )
    } else {
      const nextVerifikator = (letter as any)[levelVerifikatorField[level + 1]]
      await createNotification(
        nextVerifikator,
        `Surat Keterangan ${letter.no_letter || letterId} menunggu verifikasi Anda`,
        '/verifikasi-surat',
      )
    }
    await createLetterLog({
      letter_id: letterId,
      action: `approved_v${level}` as LetterLogAction,
      performed_by: caller.user.id,
      verification_level: level,
      approval_notes: body?.notes || null,
      previous_status: 'sent',
      new_status: isLastLevel ? 'verified' : 'sent',
    })

    return NextResponse.json({ success: true, status: isLastLevel ? 'verified' : 'sent' })
  }

  // Reject: satu aksi, tanpa kategori — langsung kembali ke konseptor (draft).
  const reason = String(body?.reason || '').trim()
  if (!reason) return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 })

  const { error: updateVerificationError } = await supabaseAdmin
    .from('letter_verification')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      rejection_reason_detailed: reason,
      rejection_destination: 'creator',
      rejection_timestamp: now,
      updated_at: now,
    })
    .eq('id', verification.id)
  if (updateVerificationError) {
    return NextResponse.json({ error: updateVerificationError.message }, { status: 400 })
  }

  const { error: updateLetterError } = await supabaseAdmin
    .from('letter')
    .update({ status: 'draft' })
    .eq('id', letterId)
  if (updateLetterError) {
    return NextResponse.json({ error: updateLetterError.message }, { status: 400 })
  }

  await createNotification(
    letter.sent_by,
    `Surat Keterangan ${letter.no_letter || letterId} ditolak: ${reason}`,
    `/letters/${letterId}/view`,
  )

  await createLetterLog({
    letter_id: letterId,
    action: `rejected_v${level}` as LetterLogAction,
    performed_by: caller.user.id,
    verification_level: level,
    rejection_reason: reason,
    previous_status: 'sent',
    new_status: 'draft',
  })

  return NextResponse.json({ success: true, status: 'draft' })
}
