
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { session_id, data, filename, uploaded_by } = body

        if (!session_id || !data) {
            return NextResponse.json({ error: 'Missing session_id or data' }, { status: 400 })
        }

        const { data: insertedData, error } = await supabase
            .from('raw_data')
            .insert([
                {
                    session_id,
                    data,
                    filename,
                    uploaded_by,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(insertedData)
    } catch (error: any) {
        console.error('Error saving raw data:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
