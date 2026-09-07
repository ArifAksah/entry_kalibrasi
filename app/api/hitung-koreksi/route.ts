import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { interpolateCorrectionFromPoints, parseCertCorrectionPoints } from '../../../lib/qc-utils'

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

type CorrectionPair = {
    reading: number
    sensorStdId: number
}

async function calculateCorrection(reading: number, sensorStdId: number) {
    const { data, error } = await supabaseAdmin.rpc('hitung_koreksi', {
        reading,
        sensor_std_id: sensorStdId,
    })

    if (error) {
        console.error('Error calling hitung_koreksi RPC:', error)
        throw new Error(error.message)
    }

    const correction = Number(data)
    if (!Number.isFinite(correction)) throw new Error('Invalid correction returned by hitung_koreksi')
    return correction
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function calculateCorrectionWithRetry(reading: number, sensorStdId: number) {
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await calculateCorrection(reading, sensorStdId)
        } catch (error) {
            lastError = error
            if (attempt < 3) await wait(attempt * 150)
        }
    }
    throw lastError
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const pairs = Array.isArray(body?.pairs) ? body.pairs : []

        const uniquePairs = Array.from(
            new Map(
                pairs
                    .map((pair: any) => ({
                        reading: Number(pair?.reading),
                        sensorStdId: Number(pair?.sensorStdId),
                    }))
                    .filter((pair: CorrectionPair) => Number.isFinite(pair.reading) && Number.isFinite(pair.sensorStdId))
                    .map((pair: CorrectionPair) => [`${pair.sensorStdId}:${pair.reading}`, pair])
            ).values()
        ) as CorrectionPair[]

        const results: Record<string, number> = {}
        const errors: Record<string, string> = {}
        const grouped = new Map<number, CorrectionPair[]>()
        uniquePairs.forEach(pair => {
            const group = grouped.get(pair.sensorStdId) || []
            group.push(pair)
            grouped.set(pair.sensorStdId, group)
        })

        // Fetch one certificate per STD sensor, then interpolate all readings in
        // process. This avoids thousands of independent RPC calls and guarantees
        // that every row in a group uses the same certificate snapshot.
        await Promise.all(Array.from(grouped.entries()).map(async ([sensorStdId, sensorPairs]) => {
            const { data: certificates, error } = await supabaseAdmin
                .from('certificate_standard')
                .select('*')
                .eq('sensor_id', sensorStdId)
                .order('calibration_date', { ascending: false })
                .limit(1)

            if (error || !certificates?.[0]) {
                const message = error?.message || `Certificate standard not found for sensor ${sensorStdId}`
                sensorPairs.forEach(pair => {
                    errors[`${sensorStdId}:${pair.reading}`] = message
                })
                return
            }

            const points = parseCertCorrectionPoints(certificates[0])
            if (points.length === 0) {
                sensorPairs.forEach(pair => {
                    errors[`${sensorStdId}:${pair.reading}`] = 'Certificate has no valid correction points'
                })
                return
            }

            sensorPairs.forEach(pair => {
                results[`${sensorStdId}:${pair.reading}`] = interpolateCorrectionFromPoints(points, pair.reading)
            })
        }))

        // If certificate lookup failed for an entire sensor, retain the existing
        // RPC as a narrow fallback instead of failing successful sensor groups.
        const unresolved = uniquePairs.filter(pair => errors[`${pair.sensorStdId}:${pair.reading}`])
        for (let i = 0; i < unresolved.length; i += 5) {
            const retried = await Promise.all(unresolved.slice(i, i + 5).map(async pair => {
                const key = `${pair.sensorStdId}:${pair.reading}`
                try {
                    return { key, correction: await calculateCorrectionWithRetry(pair.reading, pair.sensorStdId) }
                } catch (error: any) {
                    return { key, error: error?.message || errors[key] }
                }
            }))
            retried.forEach(result => {
                if ('correction' in result && typeof result.correction === 'number') {
                    results[result.key] = result.correction
                    delete errors[result.key]
                } else {
                    errors[result.key] = result.error || errors[result.key]
                }
            })
        }

        return NextResponse.json({ corrections: results, errors })
    } catch (e: any) {
        console.error('hitung-koreksi batch route error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
