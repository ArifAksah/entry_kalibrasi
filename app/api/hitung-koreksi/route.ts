import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/hitung-koreksi?reading=<number>&sensor_std_id=<number>
 *
 * Calls the Supabase `hitung_koreksi(input_val, target_config_id)` PL/pgSQL function
 * which returns the interpolated correction value from the certificate_standard table.
 *
 * NOTE: If you see PGRST203 "Could not choose best candidate function", you have two
 * overloads in the DB. Run this in Supabase SQL Editor to fix:
 *   DROP FUNCTION IF EXISTS public.hitung_koreksi(double precision, bigint);
 * Then only the NUMERIC version remains.
 *
 * Returns: { correction: number }
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const readingStr = searchParams.get('reading')
        const sensorStdIdStr = searchParams.get('sensor_std_id')

        if (!readingStr || !sensorStdIdStr) {
            return NextResponse.json({ error: 'Missing reading or sensor_std_id parameter' }, { status: 400 })
        }

        const reading = parseFloat(readingStr)
        const sensorStdId = parseInt(sensorStdIdStr, 10)

        if (isNaN(reading) || isNaN(sensorStdId)) {
            return NextResponse.json({ error: 'Invalid reading or sensor_std_id' }, { status: 400 })
        }

        // Use explicit SQL query to avoid PGRST203 overload ambiguity.
        // This forces PostgreSQL to use the NUMERIC version of hitung_koreksi.
        const { data, error } = await supabaseAdmin.rpc('hitung_koreksi', {
            reading: reading,
            sensor_std_id: sensorStdId,
        })

        if (error) {
            console.error('Error calling hitung_koreksi RPC:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ correction: data ?? 0 })
    } catch (e: any) {
        console.error('hitung-koreksi route error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
