import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/hitung-koreksi?reading=<number>&sensor_std_id=<number>
 *
 * Calls the Supabase `hitung_koreksi(reading, sensor_std_id)` PL/pgSQL function
 * which returns the interpolated correction value from the certificate_standard table.
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

        const { data, error } = await supabaseAdmin.rpc('hitung_koreksi', {
            input_val: reading,
            target_config_id: sensorStdId,
        })

        if (error) {
            console.error('Error calling hitung_koreksi RPC:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // data is the return value (double precision) from the function
        return NextResponse.json({ correction: data ?? 0 })
    } catch (e: any) {
        console.error('hitung-koreksi route error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
