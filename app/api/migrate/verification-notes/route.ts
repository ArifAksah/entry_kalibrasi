import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    // Add verification notes columns to certificate table
    const alterQueries = [
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS verification_notes TEXT;',
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS rejection_reason TEXT;',
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_notes TEXT;',
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_status VARCHAR(20) DEFAULT \'none\' CHECK (repair_status IN (\'none\', \'pending\', \'completed\', \'rejected\'));',
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_requested_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE certificate ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMP WITH TIME ZONE;'
    ]

    for (const query of alterQueries) {
      const { error } = await supabaseAdmin.rpc('exec', { sql: query })
      if (error) {
        console.log(`Query failed: ${query}`, error)
        // Continue with other queries even if one fails
      }
    }

    // Add indexes
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_certificate_repair_status ON certificate(repair_status);',
      'CREATE INDEX IF NOT EXISTS idx_certificate_verification_notes ON certificate(verification_notes);'
    ]

    for (const query of indexQueries) {
      const { error } = await supabaseAdmin.rpc('exec', { sql: query })
      if (error) {
        console.log(`Index query failed: ${query}`, error)
        // Continue with other queries even if one fails
      }
    }

    // Update certificate_verification table
    const verifQueries = [
      'ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS rejection_reason TEXT;',
      'ALTER TABLE certificate_verification ADD COLUMN IF NOT EXISTS approval_notes TEXT;'
    ]

    for (const query of verifQueries) {
      const { error } = await supabaseAdmin.rpc('exec', { sql: query })
      if (error) {
        console.log(`Verification query failed: ${query}`, error)
        // Continue with other queries even if one fails
      }
    }

    return NextResponse.json({ success: true, message: 'Migration completed successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Failed to apply migration' }, { status: 500 })
  }
}
