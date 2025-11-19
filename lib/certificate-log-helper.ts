import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface CreateLogParams {
  certificate_id: number
  action: 'created' | 'sent' | 'approved_v1' | 'approved_v2' | 'approved_assignor' | 'rejected_v1' | 'rejected_v2' | 'rejected_assignor' | 'updated' | 'deleted'
  performed_by: string
  notes?: string | null
  rejection_reason?: string | null
  approval_notes?: string | null
  verification_level?: number | null
  previous_status?: string | null
  new_status?: string | null
  metadata?: Record<string, any> | null
}

/**
 * Helper function to create certificate log entries
 */
export async function createCertificateLog(params: CreateLogParams): Promise<void> {
  try {
    // Get user name from personel table
    let performed_by_name = null
    try {
      const { data: personel } = await supabaseAdmin
        .from('personel')
        .select('name')
        .eq('id', params.performed_by)
        .single()
      
      if (personel) {
        performed_by_name = personel.name
      }
    } catch (e) {
      console.warn('Could not fetch personel name for log:', e)
    }

    // Insert log
    const { error } = await supabaseAdmin
      .from('certificate_logs')
      .insert({
        certificate_id: params.certificate_id,
        action: params.action,
        performed_by: params.performed_by,
        performed_by_name,
        notes: params.notes || null,
        rejection_reason: params.rejection_reason || null,
        approval_notes: params.approval_notes || null,
        verification_level: params.verification_level || null,
        previous_status: params.previous_status || null,
        new_status: params.new_status || null,
        metadata: params.metadata || null
      })

    if (error) {
      console.error('Error creating certificate log:', error)
      // Don't throw - logging should not break the main flow
    }
  } catch (e) {
    console.error('Unexpected error creating certificate log:', e)
    // Don't throw - logging should not break the main flow
  }
}



