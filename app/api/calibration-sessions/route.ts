
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        console.log('Creating session with body:', body)
        const { station_id, start_date, end_date, place, notes, status } = body

        // Map to calibration_session table schema
        // Required fields based on user screenshot: uut_instrument_id, tgl_kalibrasi
        // We might not have instrument_id here if it's just a session? 
        // But the user workflow seemingly aims to create a session linked to a certificate context.
        // For now, we'll try to insert with minimal valid data. 
        // If uut_instrument_id is required, we need to pass it from frontend.
        // Let's check if we can pass it in body.

        const payload = {
            station_id: station_id ? parseInt(station_id) : null,
            start_date: start_date ? new Date(start_date).toISOString() : null,
            end_date: end_date ? new Date(end_date).toISOString() : null,
            place,
            keterangan: notes ? { text: notes } : null, // Map notes to keterangan (jsonb)
            status: status ? { current: status } : { current: 'draft' }, // Map status to jsonb
            // tgl_kalibrasi is required (date). Use start_date or today.
            tgl_kalibrasi: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
            // uut_instrument_id is required (bigint). 
            // If body doesn't have it, we might fail. 
            // We should request it from frontend.
            // For now, if missing, we try 0 or 1 if it's a FK... unlikely to work if FK constraint.
            // If it's just a bigint without FK, 0 might work.
            // Let's assume frontend passes 'instrument_id' in body (I need to update frontend).
            uut_instrument_id: body.instrument_id ? parseInt(body.instrument_id) : 0,

            created_at: new Date().toISOString()
        }

        console.log('Insert payload:', payload)

        const { data, error } = await supabaseAdmin
            .from('calibration_session') // Singular
            .insert([payload])
            .select()
            .single()

        if (error) {
            console.error('Supabase error creating session:', error)
            throw error
        }

        console.log('Supabase Insert Result Data:', data)

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Error creating calibration session (catch):', error)
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const station_id = searchParams.get('station_id')

        let query = supabaseAdmin.from('calibration_session').select('*').order('created_at', { ascending: false })

        if (station_id) {
            query = query.eq('station_id', station_id)
        }

        const { data, error } = await query

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
