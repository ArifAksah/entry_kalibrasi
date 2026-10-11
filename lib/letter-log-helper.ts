import { supabaseAdmin } from './supabase'

export type LetterLogAction =
  | 'created'
  | 'sent'
  | 'approved_v1'
  | 'approved_v2'
  | 'approved_v3'
  | 'rejected_v1'
  | 'rejected_v2'
  | 'rejected_v3'
  | 'signed'
  | 'updated'
  | 'deleted'

export interface CreateLetterLogParams {
  letter_id: number
  action: LetterLogAction
  performed_by?: string | null
  notes?: string | null
  rejection_reason?: string | null
  approval_notes?: string | null
  verification_level?: number | null
  previous_status?: string | null
  new_status?: string | null
  metadata?: Record<string, any> | null
}

/**
 * Helper untuk menulis log Surat Keterangan. Mengikuti pola
 * `createCertificateLog` — kegagalan logging TIDAK boleh menggagalkan alur utama.
 */
export async function createLetterLog(params: CreateLetterLogParams): Promise<void> {
  try {
    let performed_by_name: string | null = null
    if (params.performed_by) {
      try {
        const { data: personel } = await supabaseAdmin
          .from('personel')
          .select('name')
          .eq('id', params.performed_by)
          .single()
        if (personel) performed_by_name = personel.name
      } catch (e) {
        console.warn('Could not fetch personel name for letter log:', e)
      }
    }

    const { error } = await supabaseAdmin.from('letter_logs').insert({
      letter_id: params.letter_id,
      action: params.action,
      performed_by: params.performed_by || null,
      performed_by_name,
      notes: params.notes || null,
      rejection_reason: params.rejection_reason || null,
      approval_notes: params.approval_notes || null,
      verification_level: params.verification_level || null,
      previous_status: params.previous_status || null,
      new_status: params.new_status || null,
      metadata: params.metadata || null,
    })

    if (error) {
      console.error('Error creating letter log:', error)
    }
  } catch (e) {
    console.error('Unexpected error creating letter log:', e)
  }
}
