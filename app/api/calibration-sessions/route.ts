
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

const buildSessionPayload = (body: any) => ({
    station_id: body.station_id ? parseInt(body.station_id) : null,
    start_date: body.start_date ? new Date(body.start_date).toISOString() : null,
    end_date: body.end_date ? new Date(body.end_date).toISOString() : null,
    place: body.place,
    keterangan: body.notes ? { text: body.notes } : null,
    status: body.status ? { current: body.status } : { current: 'draft' },
    tgl_kalibrasi: body.start_date ? new Date(body.start_date).toISOString() : new Date().toISOString(),
    uut_instrument_id: body.instrument_id ? parseInt(body.instrument_id) : null,
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        console.log('Creating session with body:', body)
        const payload = {
            ...buildSessionPayload(body),
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

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json()
        const { session_id } = body

        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
        }

        const payload = {
            ...buildSessionPayload(body),
            updated_at: new Date().toISOString()
        }

        const { data, error } = await supabaseAdmin
            .from('calibration_session')
            .update(payload)
            .eq('session_id', session_id)
            .select()
            .single()

        if (error) {
            console.error('Supabase error updating session:', error)
            throw error
        }

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Error updating calibration session (catch):', error)
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
