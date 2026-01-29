import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const sensor_id = searchParams.get('sensor_id')

        let query = supabaseAdmin
            .from('cert_standard')
            .select('*')
            .order('calibration_date', { ascending: false })

        if (sensor_id) {
            query = query.eq('sensor_id', sensor_id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching standard certs:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
