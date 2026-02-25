import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// GET - Ambil semua tipe instrumen dari tabel instrument_types (sudah ada di DB)
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('instrument_types')
            .select('id, name, description')
            .order('id', { ascending: true })

        if (error) {
            console.error('GET /api/instrument-types error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
