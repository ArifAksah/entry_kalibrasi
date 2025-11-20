import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with the service role key for admin access
// This is safe because this API endpoint controls what data is exposed
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ public_id: string }> }
) {
    try {
        const { public_id } = await params

        if (!public_id) {
            return NextResponse.json({ error: 'Public ID is required' }, { status: 400 })
        }

        // 1. Fetch Certificate Details
        const { data: cert, error: certError } = await supabaseAdmin
            .from('certificate')
            .select(`
        id,
        no_certificate,
        no_order,
        no_identification,
        issue_date,
        status,
        authorized_by,
        verifikator_1,
        verifikator_2,
        station,
        instrument,
        pdf_generated_at,
        public_id
      `)
            .eq('public_id', public_id)
            .single()

        if (certError || !cert) {
            return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
        }

        // 2. Fetch Related Data (Station, Instrument, Personel)
        // We do this manually to ensure we get exactly what we need without complex joins if relations aren't perfect

        // Fetch Station Name
        let stationName = '-'
        if (cert.station) {
            const { data: station } = await supabaseAdmin
                .from('station')
                .select('name')
                .eq('id', cert.station)
                .single()
            if (station) stationName = station.name
        }

        // Fetch Instrument Name
        let instrumentName = '-'
        if (cert.instrument) {
            const { data: instrument } = await supabaseAdmin
                .from('instrument')
                .select('name')
                .eq('id', cert.instrument)
                .single()
            if (instrument) instrumentName = instrument.name
        }

        // Fetch Personel Names
        const userIds = [cert.authorized_by, cert.verifikator_1, cert.verifikator_2].filter(Boolean)
        const personelMap: Record<string, string> = {}

        if (userIds.length > 0) {
            const { data: people } = await supabaseAdmin
                .from('personel')
                .select('id, name')
                .in('id', userIds)

            people?.forEach((p: any) => {
                personelMap[p.id] = p.name
            })
        }

        // 3. Construct Response
        const responseData = {
            valid: true,
            certificate: {
                no_certificate: cert.no_certificate,
                no_order: cert.no_order,
                no_identification: cert.no_identification,
                issue_date: cert.issue_date,
                status: cert.status, // e.g., 'completed', 'draft'
                pdf_generated_at: cert.pdf_generated_at,
                station_name: stationName,
                instrument_name: instrumentName,
                signatories: {
                    calibrator: {
                        name: personelMap[cert.authorized_by] || 'Unknown', // Assuming authorized_by is also the creator/calibrator context usually
                        role: 'Calibrator / Authorized By'
                    },
                    verifikator_1: {
                        name: personelMap[cert.verifikator_1] || 'Unknown',
                        role: 'Verifikator 1'
                    },
                    verifikator_2: {
                        name: personelMap[cert.verifikator_2] || 'Unknown',
                        role: 'Verifikator 2'
                    },
                    assignor: {
                        name: personelMap[cert.authorized_by] || 'Unknown', // Usually authorized_by is the assignor (signer)
                        role: 'Assignor'
                    }
                }
            }
        }

        return NextResponse.json(responseData)

    } catch (error: any) {
        console.error('[Public API] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
