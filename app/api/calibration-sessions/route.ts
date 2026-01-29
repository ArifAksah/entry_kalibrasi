
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { station_id, start_date, end_date, place, notes, status } = body

        // 1. Create Session
        const { data, error } = await supabase
            .from('calibration_sessions')
            .insert([
                {
                    station_id,
                    start_date,
                    end_date,
                    place,
                    notes,
                    status: status || 'draft',
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Error creating calibration session:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const station_id = searchParams.get('station_id')

        let query = supabase.from('calibration_sessions').select('*').order('created_at', { ascending: false })

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
