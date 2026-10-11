import { NextRequest, NextResponse } from 'next/server'
import { requireCaller, isAdminCaller, forbidden } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isUserInCalibrationOrderTeam } from '@/lib/certificate-access'
import { getDocumentAssignment } from '@/lib/document-assignment-service'
import { fetchLetterResults } from '@/lib/letter-service'
import { sendWhatsApp } from '@/lib/wa'
import { buildLetterDraftSubmissionMessage } from '@/lib/wa-messages'
import { createLetterLog } from '@/lib/letter-log-helper'

/** Surat Keterangan: tiga langkah verifikasi (Verifikator 1→2→3) + penandatanganan. */
const VERIFICATION_LEVELS = [1, 2, 3]
const SIGNING_LEVEL = 4

/** POST /api/letters/[id]/send-to-verifiers — kirim konsep Surat ke verifikator. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCaller(request)
  if (caller instanceof NextResponse) return caller

  const letterId = Number((await params).id)
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'ID surat tidak valid' }, { status: 400 })
  }

  const { data: letter } = await supabaseAdmin
    .from('letter')
    .select('*')
    .eq('id', letterId)
    .maybeSingle()
  if (!letter) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

  if (!isAdminCaller(caller)) {
    const isOwner = [letter.created_by, letter.sent_by].some(
      (value) => value != null && String(value) === caller.user.id,
    )
    const inTeam = letter.calibration_order_id
      ? await isUserInCalibrationOrderTeam(caller.user.id, letter.calibration_order_id)
      : false
    if (!isOwner && !inTeam) {
      return forbidden('Hanya admin atau petugas terkait yang dapat mengirim Surat Keterangan')
    }
  }

  if (letter.status !== 'draft') {
    return NextResponse.json({ error: 'Surat Keterangan tidak dalam status draft' }, { status: 400 })
  }
  if (!letter.calibration_order_item_id) {
    return NextResponse.json(
      { error: 'Surat Keterangan belum terhubung ke identifikasi order' },
      { status: 400 },
    )
  }

  const results = await fetchLetterResults(letterId)
  if (!results.length) {
    return NextResponse.json(
      { error: 'Hasil pemeriksaan belum diisi, Surat Keterangan belum dapat dikirim' },
      { status: 400 },
    )
  }

  const itemId = Number(letter.calibration_order_item_id)
  let assignment: any = await getDocumentAssignment(itemId)
  if (assignment) {
    const { error: lockError } = await supabaseAdmin.rpc('lock_order_item_document_assignment', {
      p_item_id: itemId,
      p_actor: caller.user.id,
      p_source: 'letter_finalization',
    })
    if (lockError) {
      return NextResponse.json(
        { error: `Penugasan Dokumen belum siap: ${lockError.message}` },
        { status: 400 },
      )
    }
    assignment = (await getDocumentAssignment(itemId)) ?? assignment
  } else {
    // Belum ada baris Penugasan Dokumen: pakai nilai pada Surat bila tersedia.
    assignment = {
      verifikator_1: letter.verifikator_1,
      verifikator_2: letter.verifikator_2,
      verifikator_3: letter.verifikator_3,
      authorized_by: letter.authorized_by,
    }
  }

  if (!assignment?.verifikator_1 || !assignment?.verifikator_2 || !assignment?.verifikator_3 || !assignment?.authorized_by) {
    return NextResponse.json(
      { error: 'Verifikator 1, 2, 3 dan Penandatangan wajib ditentukan sebelum kirim konsep' },
      { status: 400 },
    )
  }

  const assignedIds = [
    assignment.verifikator_1,
    assignment.verifikator_2,
    assignment.verifikator_3,
    assignment.authorized_by,
  ]
  const { data: assignedPersonel, error: personelError } = await supabaseAdmin
    .from('personel')
    .select('id')
    .in('id', assignedIds)
  if (personelError || (assignedPersonel || []).length !== new Set(assignedIds).size) {
    return NextResponse.json(
      { error: 'Sebagian verifikator/penandatangan tidak ditemukan' },
      { status: 400 },
    )
  }

  const currentVersion = letter.version || 1
  const now = new Date().toISOString()

  // Tiga langkah verifikasi berurutan (Verifikator 1 → 2 → 3), lalu penandatanganan.
  const verifikatorByLevel: Record<number, string | null> = {
    1: assignment.verifikator_1,
    2: assignment.verifikator_2,
    3: assignment.verifikator_3,
  }
  const records = [
    ...VERIFICATION_LEVELS.map((level) => ({
      letter_id: letterId,
      verification_level: level,
      verified_by: verifikatorByLevel[level],
      letter_version: currentVersion,
      status: 'pending',
      notes: null,
      created_at: now,
      updated_at: now,
    })),
    {
      letter_id: letterId,
      verification_level: SIGNING_LEVEL,
      verified_by: assignment.authorized_by,
      letter_version: currentVersion,
      status: 'pending',
      notes: null,
      created_at: now,
      updated_at: now,
    },
  ]

  const { error: deleteError } = await supabaseAdmin
    .from('letter_verification')
    .delete()
    .eq('letter_id', letterId)
    .eq('letter_version', currentVersion)
  if (deleteError) {
    return NextResponse.json({ error: `Gagal mereset verifikasi: ${deleteError.message}` }, { status: 500 })
  }

  const { error: insertError } = await supabaseAdmin.from('letter_verification').insert(records)
  if (insertError) {
    return NextResponse.json({ error: `Gagal membuat data verifikasi: ${insertError.message}` }, { status: 500 })
  }

  const sentAt = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('letter')
    .update({
      status: 'sent',
      sent_to_verifiers_at: sentAt,
      results_frozen_at: letter.results_frozen_at ?? sentAt,
      sent_by: caller.user.id,
      repair_status: 'none',
    })
    .eq('id', letterId)
  if (updateError) {
    return NextResponse.json({ error: 'Gagal memperbarui status Surat Keterangan' }, { status: 500 })
  }

  await createLetterLog({
    letter_id: letterId,
    action: 'sent',
    performed_by: caller.user.id,
    previous_status: 'draft',
    new_status: 'sent',
    notes: 'Dikirim ke Verifikator 1-3 & Penandatangan',
  })

  // Notifikasi bell ke verifikator tahap pertama (siapa yang harus memverifikasi
  // berikutnya). Kegagalan notifikasi tidak boleh membatalkan pengiriman.
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: assignment.verifikator_1,
      message: `Surat Keterangan ${letter.no_letter || letterId} menunggu verifikasi Anda`,
      link: '/verifikasi-surat',
    })
  } catch (notifyError) {
    console.error('[letter send] gagal membuat notifikasi:', notifyError)
  }

  // Notifikasi WhatsApp ke Verifikator 1-3 & Penandatangan (fire-and-forget,
  // mengikuti pola sertifikat). Pengirim sendiri dikecualikan.
  void (async () => {
    try {
      const { data: sender } = await supabaseAdmin
        .from('personel')
        .select('name')
        .eq('id', caller.user.id)
        .maybeSingle()
      const senderName = sender?.name || 'Petugas Kalibrasi'

      const recipientIds = [
        assignment.verifikator_1,
        assignment.verifikator_2,
        assignment.verifikator_3,
        assignment.authorized_by,
      ].filter((id): id is string => Boolean(id) && id !== caller.user.id)
      if (recipientIds.length === 0) return

      const { data: recipients } = await supabaseAdmin
        .from('personel')
        .select('id, name, phone')
        .in('id', recipientIds)

      const message = buildLetterDraftSubmissionMessage(
        letter.no_letter || `ID-${letterId}`,
        senderName,
      )
      const sentPhones = new Set<string>()
      for (const recipient of recipients || []) {
        if (!recipient.phone || sentPhones.has(recipient.phone)) continue
        sentPhones.add(recipient.phone)
        try {
          const result = await sendWhatsApp({ phone: recipient.phone, message })
          if (!result.success) {
            console.error(
              `[letter send] gagal kirim WA ke ${recipient.phone} (${recipient.name || recipient.id}): ${result.error}`,
            )
          }
        } catch (sendError) {
          console.error(`[letter send] error kirim WA ke ${recipient.phone}:`, sendError)
        }
      }
    } catch (waError) {
      console.error('[letter send] error pada blok notifikasi WA:', waError)
    }
  })()

  return NextResponse.json({
    success: true,
    letter: {
      id: letterId,
      status: 'sent',
      sent_to_verifiers_at: sentAt,
    },
  })
}
