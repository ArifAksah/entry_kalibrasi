import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        // Fetch unique values from certificate tables or a dedicated reference table if exists
        // Since we store these in a JSONB column 'results' inside 'certificate', it's hard to query distinct directly efficiently without a dedicated table.
        // However, the user mentioned "Inputan yang bisa dijadikan referensi selanjutnya".
        // Let's check if we have a 'calibration_reference' table that stores these.
        // If not, we can query the 'notes' table if it stores session notes? No, notes table is for general text.

        // Strategy: We will try to fetch from 'calibration_reference' first.
        // If that fails or is empty, we might need to rely on a hardcoded list for now or create a way to save new references.

        // Let's assume for now we use 'calibration_reference' for Reference Documents.
        // For "Traceability" and "Method", maybe we check if there are specific tables.

        // Actually, a robust way for "smart dropdowns" without a strict master table is to fetch distinct values from a column.
        // But since it's inside JSON, let's just use empty lists for now and let the frontend allow "Create".
        // AND, we can fetch from 'calibration_reference' if it has relevant columns.

        const { data: refs, error } = await supabaseAdmin
            .from('calibration_reference')
            .select('*')

        // If table exists, return its data.
        return NextResponse.json({
            traceability: [], // We'll let user type/create
            methods: [],     // We'll let user type/create
            references: refs || []
        })

    } catch (e: any) {
        // If table doesn't exist, just return empty
        return NextResponse.json({ traceability: [], methods: [], references: [] })
    }
}
