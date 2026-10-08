import { NextRequest, NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { canAccessLetter } from '@/lib/letter-service'
import {
  isStoragePdfPath,
  downloadPdfFromStorage,
  tryReadLocalPdf,
  tryDownloadPdfByFileNameFromStorage,
} from '@/lib/certificate-pdf-storage'

/** GET /api/letters/[id]/pdf — unduh PDF Surat Keterangan (bertanda tangan bila ada). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const letterId = Number((await params).id)
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'ID surat tidak valid' }, { status: 400 })
  }

  const { data: letter } = await supabaseAdmin
    .from('letter')
    .select('id, no_letter, pdf_path, status, public_id, created_by, authorized_by, verifikator_1, verifikator_2, verifikator_3, sent_by, calibration_order_id')
    .eq('id', letterId)
    .maybeSingle()
  if (!letter) return NextResponse.json({ error: 'Surat Keterangan tidak ditemukan' }, { status: 404 })

  // Surat yang sudah ditandatangani bersifat publik: cukup membawa public_id
  // yang benar (tidak bisa ditebak) untuk mengunduh tanpa login.
  const requestedPublicId = request.nextUrl.searchParams.get('public_id')
  const isSigned = String(letter.status) === 'completed' && Boolean(letter.public_id)
  const publicAccess = isSigned && requestedPublicId === String(letter.public_id)

  if (!publicAccess) {
    const caller = await requireCaller(request)
    if (caller instanceof NextResponse) return caller
    if (!(await canAccessLetter(caller.user.id, caller.role, letter))) {
      return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 })
    }
  }
  if (!letter.pdf_path) {
    return NextResponse.json({ error: 'PDF Surat Keterangan belum tersedia' }, { status: 404 })
  }

  const fileName = letter.pdf_path.split('/').pop() || `surat_${letterId}.pdf`
  let buffer: Buffer | null = null

  if (isStoragePdfPath(letter.pdf_path)) {
    try {
      buffer = await downloadPdfFromStorage(supabaseAdmin as any, letter.pdf_path)
    } catch (error) {
      console.error('[letter pdf] gagal unduh dari storage:', error)
    }
  } else {
    buffer = tryReadLocalPdf(letter.pdf_path)
    if (!buffer) {
      buffer = await tryDownloadPdfByFileNameFromStorage(supabaseAdmin as any, fileName)
    }
  }

  if (!buffer) {
    return NextResponse.json({ error: 'Berkas PDF tidak ditemukan' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
    },
  })
}
