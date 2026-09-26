import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { interpolateCorrectionFromPoints, parseCertCorrectionPoints } from '../../../lib/qc-utils'
import { clientSafeMessage } from '../../../lib/api-error'

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
        const certificateIdStr = searchParams.get('certificate_id')
        const certificateId = certificateIdStr ? parseInt(certificateIdStr, 10) : null

        if (isNaN(reading) || isNaN(sensorStdId)) {
            return NextResponse.json({ error: 'Invalid reading or sensor_std_id' }, { status: 400 })
        }

        // Gunakan certificate standar yang dikunci bila diberikan, agar hasil
        // tidak bergantung pada sertifikat terbaru.
        const { data, error } = await supabaseAdmin.rpc('hitung_koreksi', {
            reading: reading,
            sensor_std_id: sensorStdId,
            p_certificate_id: certificateId && !isNaN(certificateId) ? certificateId : null,
        })

        if (error) {
            console.error('Error calling hitung_koreksi RPC:', error)
            return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
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
    standardCertificateId?: number | null
}

async function calculateCorrection(reading: number, sensorStdId: number, standardCertificateId?: number | null) {
    const { data, error } = await supabaseAdmin.rpc('hitung_koreksi', {
        reading,
        sensor_std_id: sensorStdId,
        p_certificate_id: standardCertificateId ?? null,
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

async function calculateCorrectionWithRetry(reading: number, sensorStdId: number, standardCertificateId?: number | null) {
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await calculateCorrection(reading, sensorStdId, standardCertificateId)
        } catch (error) {
            lastError = error
            if (attempt < 3) await wait(attempt * 150)
        }
    }
    throw lastError
}

const pairKey = (pair: CorrectionPair) =>
    `${pair.standardCertificateId ?? 'latest'}:${pair.sensorStdId}:${pair.reading}`

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const pairs = Array.isArray(body?.pairs) ? body.pairs : []

        const normalizedPairs = pairs
            .map((pair: any) => {
                const certificateId = Number(pair?.standardCertificateId)
                return {
                    reading: Number(pair?.reading),
                    sensorStdId: Number(pair?.sensorStdId),
                    standardCertificateId: Number.isFinite(certificateId) && certificateId > 0
                        ? certificateId
                        : null,
                }
            })
            .filter(
                (pair: CorrectionPair) =>
                    Number.isFinite(pair.reading) && Number.isFinite(pair.sensorStdId),
            )

        const uniquePairs = Array.from(
            new Map(
                normalizedPairs.map(
                    (pair: CorrectionPair) => [pairKey(pair), pair] as const,
                ),
            ).values(),
        ) as CorrectionPair[]

        const results: Record<string, number> = {}
        const errors: Record<string, string> = {}

        // Group per sensor + locked certificate. Memakai certificate yang sama
        // untuk semua reading agar konsisten dengan workbook.
        const grouped = new Map<string, CorrectionPair[]>()
        uniquePairs.forEach(pair => {
            const groupKey = `${pair.sensorStdId}:${pair.standardCertificateId ?? 'latest'}`
            const group = grouped.get(groupKey) || []
            group.push(pair)
            grouped.set(groupKey, group)
        })

        await Promise.all(Array.from(grouped.values()).map(async sensorPairs => {
            const sensorStdId = sensorPairs[0].sensorStdId
            const certificateId = sensorPairs[0].standardCertificateId

            let certificateQuery = supabaseAdmin
                .from('certificate_standard')
                .select('*')
                .eq('sensor_id', sensorStdId)
            certificateQuery = certificateId
                ? certificateQuery.eq('id', certificateId)
                : certificateQuery.order('calibration_date', { ascending: false }).limit(1)

            const { data: certificates, error } = await certificateQuery

            if (error || !certificates?.[0]) {
                const message = error
                    ? clientSafeMessage(error, 'Gagal membaca sertifikat standar')
                    : certificateId
                        ? `Certificate standard ${certificateId} not found`
                        : `Certificate standard not found for sensor ${sensorStdId}`
                sensorPairs.forEach(pair => {
                    errors[pairKey(pair)] = message
                })
                return
            }

            const points = parseCertCorrectionPoints(certificates[0])
            if (points.length === 0) {
                sensorPairs.forEach(pair => {
                    errors[pairKey(pair)] = 'Certificate has no valid correction points'
                })
                return
            }

            sensorPairs.forEach(pair => {
                results[pairKey(pair)] = interpolateCorrectionFromPoints(points, pair.reading)
            })
        }))

        // If certificate lookup failed for an entire group, retain the existing
        // RPC as a narrow fallback instead of failing successful sensor groups.
        const unresolved = uniquePairs.filter(pair => errors[pairKey(pair)])
        for (let i = 0; i < unresolved.length; i += 5) {
            const retried = await Promise.all(unresolved.slice(i, i + 5).map(async pair => {
                const key = pairKey(pair)
                try {
                    return {
                        key,
                        correction: await calculateCorrectionWithRetry(
                            pair.reading,
                            pair.sensorStdId,
                            pair.standardCertificateId,
                        ),
                    }
                } catch (error: any) {
                    return { key, error: clientSafeMessage(error, errors[key] || 'Gagal menghitung koreksi') }
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
